import { Request, Response } from "express";
import mongoose from "mongoose";
import { myCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import {
  FunnelFilters,
  Range,
  fullRange,
  getCohorts,
  getCoupons,
  getExperimentResults,
  getFunnel,
  getKpiDaily,
  getKpis,
  getMeta,
  getPayments,
  getProducts,
  getRepeatInterval,
  getRfm,
  getSearch,
} from "../analytics/service.js";
import { ROW_BUILDERS, TABLES, csvLine } from "../analytics/warehouse.js";
import { DEVICES } from "../analytics/constants.js";
import ErrorHandler from "../utils/utility-class.js";

const CACHE_SECONDS = 300;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST, inclusive); defaults to the whole dataset
const parseRange = async (req: Request): Promise<Range> => {
  const all = await fullRange();
  const from = typeof req.query.from === "string" && ISO_DAY.test(req.query.from) ? req.query.from : all.from;
  const to = typeof req.query.to === "string" && ISO_DAY.test(req.query.to) ? req.query.to : all.to;
  if (from > to) throw new ErrorHandler("from must be on or before to", 400);
  return { from, to };
};

// Analytics results are cached per URL; ?nocache=1 bypasses (used for latency benchmarks)
const cached = <T>(handler: (req: Request) => Promise<T>) =>
  TryCatch(async (req: Request, res: Response) => {
    const key = `analytics:${mongoose.connection.db?.databaseName}:${req.originalUrl.replace(/[?&]nocache=1/, "")}`;
    const started = performance.now();
    if (req.query.nocache !== "1" && myCache.has(key)) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(JSON.parse(myCache.get(key) as string));
    }
    const data = await handler(req);
    const body = { success: true, data };
    myCache.set(key, JSON.stringify(body), CACHE_SECONDS);
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Server-Timing", `analytics;dur=${(performance.now() - started).toFixed(1)}`);
    return res.status(200).json(body);
  });

export const meta = cached(() => getMeta());
export const kpis = cached(async (req) => getKpis(await parseRange(req)));
export const kpiDaily = cached(async (req) => getKpiDaily(await parseRange(req)));

export const funnel = cached(async (req) => {
  const filters: FunnelFilters = {};
  if (typeof req.query.category === "string" && req.query.category) filters.category = req.query.category;
  if (typeof req.query.device === "string" && (DEVICES as readonly string[]).includes(req.query.device))
    filters.device = req.query.device;
  if (req.query.customerType === "new" || req.query.customerType === "returning") filters.customerType = req.query.customerType;
  return getFunnel(await parseRange(req), filters);
});

export const customers = cached(async () => {
  const [cohorts, rfm, repeatInterval] = await Promise.all([getCohorts(), getRfm(), getRepeatInterval()]);
  return { cohorts, rfm, repeatInterval };
});

export const products = cached(async (req) => getProducts(await parseRange(req)));
export const payments = cached(async (req) => getPayments(await parseRange(req)));
export const search = cached(async (req) => getSearch(await parseRange(req)));
export const coupons = cached(async (req) => getCoupons(await parseRange(req)));

export const experimentResults = cached(async (req) => {
  const mde = Number(req.query.mde);
  const result = await getExperimentResults(req.params.key, { mde: mde > 0 && mde < 1 ? mde : undefined });
  if (!result) throw new ErrorHandler("Unknown experiment", 404);
  return result;
});

// CSV download of a star-schema table (or kpi_daily), streamed row by row. No PII.
export const exportTable = TryCatch(async (req, res, next) => {
  const table = req.params.table;
  if (table !== "kpi_daily" && !(table in TABLES)) return next(new ErrorHandler("Unknown table", 404));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);

  if (table === "kpi_daily") {
    const rows = await getKpiDaily(await fullRange());
    if (rows.length) res.write(Object.keys(rows[0]).join(",") + "\n");
    for (const row of rows) res.write(csvLine(Object.values(row)));
    return res.end();
  }

  res.write(TABLES[table].columns.map(([c]) => c).join(",") + "\n");
  for await (const row of ROW_BUILDERS[table as keyof typeof TABLES](mongoose.connection.db!)) {
    if (!res.write(csvLine(row))) await new Promise((r) => res.once("drain", r));
  }
  res.end();
});
