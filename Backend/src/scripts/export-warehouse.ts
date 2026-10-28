// Loads MongoDB data into a DuckDB star schema (analytics/warehouse.duckdb) and writes the
// same tables as CSV (analytics/warehouse/*.csv) for Power BI / Excel.
//
// Usage: npm run export:warehouse            (simulated database)
//        DB_NAME=Ecommerce_24 npm run export:warehouse   (live store)
import { DuckDBInstance } from "@duckdb/node-api";
import { config } from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { ROW_BUILDERS, TABLES, csvLine } from "../analytics/warehouse.js";
import { SIM_DB_NAME } from "./sim/world.js";

config({ path: "./.env" });

export const ANALYTICS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../analytics");
export const WAREHOUSE_FILE = path.join(ANALYTICS_DIR, "warehouse.duckdb");
const CSV_DIR = path.join(ANALYTICS_DIR, "warehouse");
const SQL_DIR = path.join(ANALYTICS_DIR, "sql");

// DuckDB wants forward slashes, even on Windows
const sqlPath = (p: string) => p.replace(/\\/g, "/");

const writeCsv = async (table: keyof typeof TABLES, db: mongoose.mongo.Db) => {
  const def = TABLES[table];
  const file = path.join(CSV_DIR, `${table}.csv`);
  const out = fs.createWriteStream(file);
  out.write(def.columns.map(([c]) => c).join(",") + "\n");
  let rows = 0;
  for await (const row of ROW_BUILDERS[table](db)) {
    if (!out.write(csvLine(row))) await new Promise((r) => out.once("drain", r));
    rows++;
  }
  await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  return { file, rows };
};

const main = async () => {
  const dbName = process.env.DB_NAME || SIM_DB_NAME;
  await mongoose.connect(process.env.MONGO_URI!, { dbName });
  const db = mongoose.connection.db!;
  fs.mkdirSync(CSV_DIR, { recursive: true });
  console.log(`Exporting "${dbName}" → ${sqlPath(path.relative(process.cwd(), ANALYTICS_DIR))}`);

  if (fs.existsSync(WAREHOUSE_FILE)) fs.rmSync(WAREHOUSE_FILE);
  const duck = await DuckDBInstance.create(WAREHOUSE_FILE);
  const conn = await duck.connect();

  for (const table of Object.keys(TABLES) as (keyof typeof TABLES)[]) {
    const started = Date.now();
    const { file, rows } = await writeCsv(table, db);
    const columns = TABLES[table].columns.map(([c, t]) => `'${c}': '${t}'`).join(", ");
    await conn.run(
      `CREATE TABLE ${table} AS SELECT * FROM read_csv('${sqlPath(file)}', header = true, ` +
        `columns = {${columns}}, nullstr = '', dateformat = '%Y-%m-%d', timestampformat = '%Y-%m-%d %H:%M:%S')`
    );
    console.log(`  ${table.padEnd(17)} ${String(rows).padStart(9)} rows  ${Date.now() - started} ms`);
  }

  // Daily KPI table is defined in SQL so Power BI, Excel and the report all use one definition
  const kpiSql = fs.readFileSync(path.join(SQL_DIR, "00_kpi_daily.sql"), "utf8").replace(/;\s*$/, "");
  await conn.run(`CREATE TABLE kpi_daily AS ${kpiSql}`);
  await conn.run(`COPY kpi_daily TO '${sqlPath(path.join(CSV_DIR, "kpi_daily.csv"))}' (HEADER, DELIMITER ',')`);
  const kpiRows = await conn.runAndReadAll("SELECT COUNT(*) AS n FROM kpi_daily");
  console.log(`  ${"kpi_daily".padEnd(17)} ${String(kpiRows.getRowObjectsJson()[0].n).padStart(9)} rows`);

  conn.closeSync();
  await mongoose.disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
