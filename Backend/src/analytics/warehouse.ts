// Star-schema definitions and row builders shared by the DuckDB export script and the
// admin CSV export. Rows carry no PII: emails/phones are salted SHA-256 hashes, addresses
// are reduced to city, state and a 3-digit PIN prefix.
import crypto from "crypto";
import type { Db, Document } from "mongodb";
import { saleOn, dateKey, istDate, istTimestamp, istDayStart } from "./calendar.js";
import { LOST_STATUSES } from "./constants.js";

export type ColumnType = "VARCHAR" | "INTEGER" | "DOUBLE" | "BOOLEAN" | "DATE" | "TIMESTAMP";
export type Cell = string | number | boolean | null;

export type TableDef = {
  name: string;
  description: string;
  columns: [name: string, type: ColumnType][];
};

export const TABLES: Record<string, TableDef> = {
  dim_date: {
    name: "dim_date",
    description: "One row per IST calendar day in the data range",
    columns: [
      ["date_key", "INTEGER"], ["date", "DATE"], ["year", "INTEGER"], ["quarter", "INTEGER"],
      ["month", "INTEGER"], ["month_name", "VARCHAR"], ["year_month", "VARCHAR"], ["iso_week", "INTEGER"],
      ["day_of_week", "INTEGER"], ["day_name", "VARCHAR"], ["is_weekend", "BOOLEAN"], ["sale_event", "VARCHAR"],
    ],
  },
  dim_products: {
    name: "dim_products",
    description: "Catalogue: one row per SKU (product + colour)",
    columns: [
      ["product_id", "VARCHAR"], ["product_name", "VARCHAR"], ["product_line", "VARCHAR"], ["color", "VARCHAR"],
      ["category", "VARCHAR"], ["price", "DOUBLE"], ["compare_price", "DOUBLE"], ["stock", "INTEGER"],
      ["is_simulated", "BOOLEAN"],
    ],
  },
  dim_customers: {
    name: "dim_customers",
    description: "Customers with hashed contact details (no names, emails or addresses)",
    columns: [
      ["customer_id", "VARCHAR"], ["email_hash", "VARCHAR"], ["phone_hash", "VARCHAR"], ["signup_date", "DATE"],
      ["first_order_date", "DATE"], ["city", "VARCHAR"], ["state", "VARCHAR"], ["is_simulated", "BOOLEAN"],
    ],
  },
  fact_orders: {
    name: "fact_orders",
    description: "One row per order, with outcome flags and delivery timings",
    columns: [
      ["order_id", "VARCHAR"], ["order_date_key", "INTEGER"], ["order_date", "DATE"], ["order_ts_ist", "TIMESTAMP"],
      ["customer_id", "VARCHAR"], ["session_id", "VARCHAR"], ["anon_id", "VARCHAR"], ["device", "VARCHAR"],
      ["payment_method", "VARCHAR"], ["status", "VARCHAR"], ["coupon_code", "VARCHAR"], ["item_count", "INTEGER"],
      ["subtotal", "DOUBLE"], ["shipping_charges", "DOUBLE"], ["discount", "DOUBLE"], ["total", "DOUBLE"],
      ["is_cancelled", "BOOLEAN"], ["is_rto", "BOOLEAN"], ["is_returned", "BOOLEAN"], ["is_delivered", "BOOLEAN"],
      ["is_lost", "BOOLEAN"], ["shipped_ts_ist", "TIMESTAMP"], ["delivered_ts_ist", "TIMESTAMP"],
      ["hours_to_ship", "DOUBLE"], ["days_to_deliver", "DOUBLE"], ["city", "VARCHAR"], ["state", "VARCHAR"],
      ["pin_prefix", "VARCHAR"], ["exp_free_shipping_variant", "VARCHAR"], ["is_simulated", "BOOLEAN"],
    ],
  },
  fact_order_items: {
    name: "fact_order_items",
    description: "One row per order line",
    columns: [
      ["order_item_id", "VARCHAR"], ["order_id", "VARCHAR"], ["order_date_key", "INTEGER"], ["product_id", "VARCHAR"],
      ["size", "VARCHAR"], ["quantity", "INTEGER"], ["unit_price", "DOUBLE"], ["line_revenue", "DOUBLE"],
    ],
  },
  fact_events: {
    name: "fact_events",
    description: "One row per tracked storefront event",
    columns: [
      ["event_id", "VARCHAR"], ["event_ts_ist", "TIMESTAMP"], ["date_key", "INTEGER"], ["session_id", "VARCHAR"],
      ["anon_id", "VARCHAR"], ["customer_id", "VARCHAR"], ["event_type", "VARCHAR"], ["product_id", "VARCHAR"],
      ["device", "VARCHAR"], ["is_returning", "BOOLEAN"], ["search_term", "VARCHAR"], ["results_count", "INTEGER"],
      ["coupon_code", "VARCHAR"], ["experiment", "VARCHAR"], ["variant", "VARCHAR"],
    ],
  },
};

const SALT = () => process.env.WAREHOUSE_SALT || "supersaint-warehouse-v1";
export const hashPii = (value?: string | null) =>
  value ? crypto.createHash("sha256").update(`${SALT()}:${value.trim().toLowerCase()}`).digest("hex") : null;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const isoWeek = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
};

const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

type RowStream = AsyncGenerator<Cell[]>;

async function* dimDate(db: Db): RowStream {
  const range = await db
    .collection("events")
    .aggregate([{ $group: { _id: null, min: { $min: "$timestamp" }, max: { $max: "$timestamp" } } }])
    .toArray();
  const orders = await db
    .collection("orders")
    .aggregate([{ $group: { _id: null, min: { $min: "$createdAt" }, max: { $max: "$createdAt" } } }])
    .toArray();
  const mins = [range[0]?.min, orders[0]?.min].filter(Boolean) as Date[];
  const maxs = [range[0]?.max, orders[0]?.max].filter(Boolean) as Date[];
  if (!mins.length) return;
  let day = istDayStart(istDate(new Date(Math.min(...mins.map((d) => d.getTime())))));
  const last = istDate(new Date(Math.max(...maxs.map((d) => d.getTime()))));
  while (istDate(day) <= last) {
    const iso = istDate(day);
    const [y, m, d] = iso.split("-").map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
    yield [
      dateKey(day), iso, y, Math.ceil(m / 3), m, MONTHS[m - 1], iso.slice(0, 7), isoWeek(y, m, d),
      dow + 1, DAYS[dow], dow >= 5, saleOn(iso),
    ];
    day = new Date(day.getTime() + 86400000);
  }
}

async function* dimProducts(db: Db): RowStream {
  for await (const p of db.collection("products").find({})) {
    const [line, color] = String(p.name).split(" - ");
    yield [
      String(p._id), p.name, line, p.color || color || null, p.category, num(p.price),
      num(p.comparePrice) ?? 0, num(p.stock) ?? 0, Boolean(p.simulated),
    ];
  }
}

async function* dimCustomers(db: Db): RowStream {
  // First order per customer gives first_order_date and the city to attribute them to
  const firsts = new Map<string, Document>();
  for await (const o of db
    .collection("orders")
    .find({}, { projection: { user: 1, createdAt: 1, "shippingInfo.city": 1, "shippingInfo.state": 1 } })
    .sort({ createdAt: 1 })) {
    if (!firsts.has(o.user)) firsts.set(o.user, o);
  }
  for await (const u of db.collection("users").find({ role: { $ne: "admin" } })) {
    const first = firsts.get(String(u._id));
    yield [
      String(u._id), hashPii(u.email), hashPii(u.phone), u.createdAt ? istDate(u.createdAt) : null,
      first ? istDate(first.createdAt) : null, first?.shippingInfo?.city ?? null,
      first?.shippingInfo?.state ?? null, Boolean(u.simulated),
    ];
  }
}

const historyAt = (history: { status: string; at: Date }[] | undefined, status: string) =>
  history?.find((h) => h.status === status)?.at ?? null;

async function* factOrders(db: Db): RowStream {
  for await (const o of db.collection("orders").find({}).sort({ createdAt: 1 })) {
    const placed: Date = o.createdAt;
    const shipped = historyAt(o.statusHistory, "Shipped");
    const delivered = historyAt(o.statusHistory, "Delivered");
    const status: string = o.status;
    const experiments = (o.experiments ?? {}) as Record<string, string>;
    yield [
      String(o._id), dateKey(placed), istDate(placed), istTimestamp(placed), str(o.user), str(o.sessionId),
      str(o.anonId), o.device ?? "desktop", o.paymentMethod, status, str(o.couponCode),
      (o.orderItems ?? []).reduce((n: number, i: Document) => n + (i.quantity ?? 0), 0),
      num(o.subtotal), num(o.shippingCharges) ?? 0, num(o.discount) ?? 0, num(o.total),
      status === "Cancelled", status === "RTO", status === "Returned",
      Boolean(delivered), (LOST_STATUSES as string[]).includes(status),
      shipped ? istTimestamp(shipped) : null, delivered ? istTimestamp(delivered) : null,
      shipped ? round((shipped.getTime() - placed.getTime()) / 3600000) : null,
      delivered ? round((delivered.getTime() - placed.getTime()) / 86400000) : null,
      o.shippingInfo?.city ?? null, o.shippingInfo?.state ?? null,
      o.shippingInfo?.pinCode ? String(o.shippingInfo.pinCode).slice(0, 3) : null,
      experiments.free_shipping_threshold ?? null, Boolean(o.simulated),
    ];
  }
}

async function* factOrderItems(db: Db): RowStream {
  for await (const o of db.collection("orders").find({}, { projection: { orderItems: 1, createdAt: 1 } })) {
    for (const [i, item] of (o.orderItems ?? []).entries()) {
      yield [
        item._id ? String(item._id) : `${o._id}-${i}`, String(o._id), dateKey(o.createdAt), String(item.productId),
        str(item.size), item.quantity, item.price, round(item.price * item.quantity),
      ];
    }
  }
}

async function* factEvents(db: Db): RowStream {
  for await (const e of db.collection("events").find({}).sort({ timestamp: 1 })) {
    const m = (e.metadata ?? {}) as Record<string, unknown>;
    yield [
      String(e._id), istTimestamp(e.timestamp), dateKey(e.timestamp), e.session_id, e.anon_id, str(e.user_id),
      e.type, e.product_id ? String(e.product_id) : null, e.device ?? "desktop", Boolean(e.is_returning),
      typeof m.term === "string" ? m.term.toLowerCase() : null, num(m.results),
      typeof m.code === "string" ? m.code : null, str(e.experiment), str(e.variant),
    ];
  }
}

export const ROW_BUILDERS: Record<keyof typeof TABLES, (db: Db) => RowStream> = {
  dim_date: dimDate,
  dim_products: dimProducts,
  dim_customers: dimCustomers,
  fact_orders: factOrders,
  fact_order_items: factOrderItems,
  fact_events: factEvents,
};

// RFC 4180 CSV
export const csvCell = (v: Cell) => {
  if (v === null) return "";
  const s = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvLine = (cells: Cell[]) => cells.map(csvCell).join(",") + "\n";
