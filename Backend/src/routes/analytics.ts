import express from "express";
import {
  coupons,
  customers,
  experimentResults,
  exportTable,
  funnel,
  kpiDaily,
  kpis,
  meta,
  payments,
  products,
  search,
} from "../controllers/analytics.js";
import { adminOnly } from "../middlewares/auth.js";

const app = express.Router();

// Every analytics route is admin-only
app.use(adminOnly);

// route - /api/v1/analytics/...  (date params: ?from=YYYY-MM-DD&to=YYYY-MM-DD, IST)
app.get("/meta", meta);
app.get("/kpis", kpis);
app.get("/kpi-daily", kpiDaily);
app.get("/funnel", funnel);
app.get("/customers", customers);
app.get("/products", products);
app.get("/payments", payments);
app.get("/search", search);
app.get("/coupons", coupons);
app.get("/experiments/:key", experimentResults);
app.get("/export/:table", exportTable);

export default app;
