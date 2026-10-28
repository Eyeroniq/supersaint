// Runs every query in analytics/sql against the DuckDB warehouse, prints a preview and
// saves each result to analytics/results/<name>.csv.
//
// Usage: npm run sql            (all queries)
//        npm run sql -- 05_rfm  (queries whose file name contains "05_rfm")
import { DuckDBInstance } from "@duckdb/node-api";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ANALYTICS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../analytics");
const SQL_DIR = path.join(ANALYTICS_DIR, "sql");
const RESULTS_DIR = path.join(ANALYTICS_DIR, "results");
const sqlPath = (p: string) => p.replace(/\\/g, "/");

export const readQuery = (file: string) =>
  fs.readFileSync(path.join(SQL_DIR, file), "utf8").trim().replace(/;\s*$/, "");

export const queryFiles = () => fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql")).sort();

const main = async () => {
  const filter = process.argv[2];
  const duck = await DuckDBInstance.create(path.join(ANALYTICS_DIR, "warehouse.duckdb"), { access_mode: "READ_ONLY" });
  const conn = await duck.connect();
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  for (const file of queryFiles().filter((f) => !filter || f.includes(filter))) {
    const name = file.replace(/\.sql$/, "");
    const sql = readQuery(file);
    const started = Date.now();
    const reader = await conn.runAndReadAll(sql);
    const ms = Date.now() - started;
    const rows = reader.getRowObjectsJson();
    await conn.run(`COPY (${sql}) TO '${sqlPath(path.join(RESULTS_DIR, `${name}.csv`))}' (HEADER, DELIMITER ',')`);
    console.log(`\n== ${name}  (${rows.length} rows, ${ms} ms)`);
    console.table(rows.slice(0, 8));
  }
  conn.closeSync();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
