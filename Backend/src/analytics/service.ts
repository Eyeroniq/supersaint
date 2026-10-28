// Live analytics over MongoDB. Each function follows the definition in the matching
// analytics/sql file; consistency.test.ts checks they agree on the simulated dataset.
import mongoose from "mongoose";
import type { Document } from "mongodb";
import { istDate, istDayStart } from "./calendar.js";
import { FUNNEL_STEPS, IST_TZ, LOST_STATUSES } from "./constants.js";
import { EXPERIMENTS, Variant } from "./experiments.js";
import {
  CustomerRfmInput,
  RFM_SEGMENTS,
  RfmSegment,
  abcClass,
  pctChange,
  rate,
  round,
  scoreRfm,
} from "./metrics.js";
import { requiredSampleSize, srmTest, twoProportionZTest, verdict, welchTTest } from "./stats.js";

const DAY_MS = 86400000;
const db = () => mongoose.connection.db!;
const events = () => db().collection("events");
const orders = () => db().collection("orders");
const agg = { allowDiskUse: true };

export type Range = { from: string; to: string };

const between = ({ from, to }: Range) => ({
  $gte: istDayStart(from),
  $lt: new Date(istDayStart(to).getTime() + DAY_MS),
});

const addDays = (isoDay: string, days: number) =>
  istDate(new Date(istDayStart(isoDay).getTime() + days * DAY_MS));

const daysBetween = (a: string, b: string) =>
  Math.round((istDayStart(b).getTime() - istDayStart(a).getTime()) / DAY_MS);

const isLost = (status: string) => (LOST_STATUSES as readonly string[]).includes(status);

const istDayExpr = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: IST_TZ } });

// ---------------------------------------------------------------- meta

// First/last activity via indexed sorts (cheap even on millions of events)
const edge = async (collection: string, field: string, direction: 1 | -1) => {
  const [doc] = await db()
    .collection(collection)
    .find({}, { projection: { [field]: 1 } })
    .sort({ [field]: direction })
    .limit(1)
    .toArray();
  return (doc?.[field] as Date | undefined) ?? null;
};

export const getMeta = async () => {
  const [firstOrder, lastOrder, firstEvent, lastEvent, simulated, categories] = await Promise.all([
    edge("orders", "createdAt", 1),
    edge("orders", "createdAt", -1),
    edge("events", "timestamp", 1),
    edge("events", "timestamp", -1),
    orders().findOne({ simulated: true }, { projection: { _id: 1 } }),
    db().collection("products").distinct("category"),
  ]);
  const dates = [firstOrder, lastOrder, firstEvent, lastEvent].filter((d): d is Date => d !== null);
  return {
    database: db().databaseName,
    simulated: Boolean(simulated),
    minDate: dates.length ? istDate(new Date(Math.min(...dates.map((d) => d.getTime())))) : null,
    maxDate: dates.length ? istDate(new Date(Math.max(...dates.map((d) => d.getTime())))) : null,
    categories: (categories as string[]).sort(),
  };
};

export const fullRange = async (): Promise<Range> => {
  const meta = await getMeta();
  const today = istDate(new Date());
  return { from: meta.minDate ?? today, to: meta.maxDate ?? today };
};

// ---------------------------------------------------------------- KPIs

const sessionTotals = async (range: Range) => {
  const [row] = await events()
    .aggregate(
      [
        { $match: { timestamp: between(range) } },
        {
          $group: {
            _id: "$session_id",
            cart: { $max: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } },
            ordered: { $max: { $cond: [{ $eq: ["$type", "order_placed"] }, 1, 0] } },
          },
        },
        { $group: { _id: null, sessions: { $sum: 1 }, cart: { $sum: "$cart" }, ordered: { $sum: "$ordered" } } },
      ],
      agg
    )
    .toArray();
  return { sessions: row?.sessions ?? 0, cartSessions: row?.cart ?? 0, convertedSessions: row?.ordered ?? 0 };
};

const orderTotals = async (range: Range) => {
  const [row] = await orders()
    .aggregate([
      { $match: { createdAt: between(range) } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          gmv: { $sum: "$total" },
          netRevenue: { $sum: { $cond: [{ $in: ["$status", LOST_STATUSES] }, 0, "$total"] } },
        },
      },
    ])
    .toArray();
  return { orders: row?.orders ?? 0, gmv: row?.gmv ?? 0, netRevenue: row?.netRevenue ?? 0 };
};

// Buyers in the range (non-cancelled order) whose lifetime non-cancelled orders up to the
// end of the range number two or more
const repeatTotals = async (range: Range) => {
  const span = between(range);
  const [row] = await orders()
    .aggregate([
      { $match: { status: { $ne: "Cancelled" }, createdAt: { $lt: span.$lt } } },
      {
        $group: {
          _id: "$user",
          orders: { $sum: 1 },
          inRange: { $max: { $cond: [{ $gte: ["$createdAt", span.$gte] }, 1, 0] } },
        },
      },
      { $match: { inRange: 1 } },
      { $group: { _id: null, buyers: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gte: ["$orders", 2] }, 1, 0] } } } },
    ])
    .toArray();
  return { buyers: row?.buyers ?? 0, repeatBuyers: row?.repeat ?? 0 };
};

const kpiSet = async (range: Range) => {
  const [s, o, r] = await Promise.all([sessionTotals(range), orderTotals(range), repeatTotals(range)]);
  return {
    ...s,
    ...o,
    ...r,
    aov: rate(o.gmv, o.orders),
    conversionRate: rate(s.convertedSessions, s.sessions),
    repeatRate: rate(r.repeatBuyers, r.buyers),
    cartAbandonmentRate: s.cartSessions ? 1 - s.convertedSessions / s.cartSessions : 0,
  };
};

export const getKpis = async (range: Range) => {
  const length = daysBetween(range.from, range.to) + 1;
  const previous = { from: addDays(range.from, -length), to: addDays(range.from, -1) };
  const [current, prior] = await Promise.all([kpiSet(range), kpiSet(previous)]);
  const keys = ["gmv", "orders", "aov", "conversionRate", "repeatRate", "cartAbandonmentRate", "sessions", "netRevenue"] as const;
  const change = Object.fromEntries(keys.map((k) => [k, pctChange(current[k], prior[k])]));
  return { range, previousRange: previous, current, previous: prior, change };
};

// Same columns as analytics/sql/00_kpi_daily.sql
export const getKpiDaily = async (range: Range) => {
  const span = between(range);
  const [sessionRows, orderRows, firstOrders] = await Promise.all([
    events()
      .aggregate(
        [
          { $match: { timestamp: span } },
          {
            $group: {
              _id: { day: istDayExpr("$timestamp"), session: "$session_id" },
              cart: { $max: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } },
              ordered: { $max: { $cond: [{ $eq: ["$type", "order_placed"] }, 1, 0] } },
            },
          },
          { $group: { _id: "$_id.day", sessions: { $sum: 1 }, cart: { $sum: "$cart" }, ordered: { $sum: "$ordered" } } },
        ],
        agg
      )
      .toArray(),
    orders()
      .find({ createdAt: span }, { projection: { createdAt: 1, total: 1, status: 1, discount: 1, paymentMethod: 1, user: 1 } })
      .toArray(),
    orders().aggregate([{ $group: { _id: "$user", first: { $min: "$createdAt" } } }]).toArray(),
  ]);

  const firstByUser = new Map(firstOrders.map((f) => [String(f._id), (f.first as Date).getTime()]));
  type Day = {
    sessions: number; cart: number; converted: number; orders: number; gmv: number; net: number; discount: number;
    cod: number; cancelled: number; rto: number; newCustomers: Set<string>; repeatCustomers: Set<string>;
  };
  const days = new Map<string, Day>();
  const day = (d: string) => {
    let v = days.get(d);
    if (!v) {
      v = { sessions: 0, cart: 0, converted: 0, orders: 0, gmv: 0, net: 0, discount: 0, cod: 0, cancelled: 0, rto: 0, newCustomers: new Set(), repeatCustomers: new Set() };
      days.set(d, v);
    }
    return v;
  };
  for (const r of sessionRows) Object.assign(day(r._id), { sessions: r.sessions, cart: r.cart, converted: r.ordered });
  for (const o of orderRows) {
    const d = day(istDate(o.createdAt));
    d.orders++;
    d.gmv += o.total;
    if (!isLost(o.status)) d.net += o.total;
    d.discount += o.discount ?? 0;
    if (o.paymentMethod === "COD") d.cod++;
    if (o.status === "Cancelled") d.cancelled++;
    if (o.status === "RTO") d.rto++;
    const first = firstByUser.get(String(o.user));
    if (first === o.createdAt.getTime()) d.newCustomers.add(String(o.user));
    else if (first !== undefined && o.createdAt.getTime() > first) d.repeatCustomers.add(String(o.user));
  }

  const rows = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const v = day(d);
    rows.push({
      date: d,
      date_key: Number(d.replace(/-/g, "")),
      sessions: v.sessions,
      cart_sessions: v.cart,
      converted_sessions: v.converted,
      orders: v.orders,
      gmv: round(v.gmv, 2),
      net_revenue: round(v.net, 2),
      aov: v.orders ? round(v.gmv / v.orders, 2) : null,
      conversion_rate: v.sessions ? round(v.converted / v.sessions) : null,
      cart_abandonment_rate: v.cart ? round(1 - v.converted / v.cart) : null,
      discount_cost: round(v.discount, 2),
      cod_orders: v.cod,
      cancelled_orders: v.cancelled,
      rto_orders: v.rto,
      new_customers: v.newCustomers.size,
      repeat_customers: v.repeatCustomers.size,
    });
  }
  return rows;
};

// ---------------------------------------------------------------- funnel

export type FunnelFilters = { category?: string; device?: string; customerType?: "new" | "returning" };

export const getFunnel = async (range: Range, filters: FunnelFilters = {}) => {
  const categoryIds = filters.category
    ? (await db().collection("products").find({ category: filters.category }, { projection: { _id: 1 } }).toArray()).map((p) => p._id)
    : null;
  const flag = (type: string) => ({ $max: { $cond: [{ $eq: ["$type", type] }, 1, 0] } });

  const postFilter: Document = {};
  if (filters.device) postFilter.device = filters.device;
  if (filters.customerType) postFilter.returning = filters.customerType === "returning" ? 1 : 0;
  if (categoryIds) postFilter.inCategory = 1;

  const rows = await events()
    .aggregate(
      [
        { $match: { timestamp: between(range) } },
        {
          $group: {
            _id: "$session_id",
            // Device is fixed for a session (one browser), so any event's device works
            device: { $first: "$device" },
            returning: { $max: { $cond: ["$is_returning", 1, 0] } },
            ...(categoryIds
              ? { inCategory: { $max: { $cond: [{ $and: [{ $eq: ["$type", "product_view"] }, { $in: ["$product_id", categoryIds] }] }, 1, 0] } } }
              : {}),
            v: flag("product_view"), a: flag("add_to_cart"), c: flag("checkout_started"), p: flag("payment_attempted"), o: flag("order_placed"),
          },
        },
        ...(Object.keys(postFilter).length ? [{ $match: postFilter }] : []),
        {
          $project: {
            device: 1,
            s1: "$v",
            s2: { $multiply: ["$v", "$a"] },
            s3: { $multiply: ["$v", "$a", "$c"] },
            s4: { $multiply: ["$v", "$a", "$c", "$p"] },
            s5: { $multiply: ["$v", "$a", "$c", "$p", "$o"] },
          },
        },
        { $group: { _id: "$device", s1: { $sum: "$s1" }, s2: { $sum: "$s2" }, s3: { $sum: "$s3" }, s4: { $sum: "$s4" }, s5: { $sum: "$s5" } } },
      ],
      agg
    )
    .toArray();

  const toSteps = (counts: number[]) =>
    FUNNEL_STEPS.map((step, i) => ({
      step,
      sessions: counts[i],
      stepConversion: i ? rate(counts[i], counts[i - 1]) : null,
      dropOff: i ? 1 - rate(counts[i], counts[i - 1]) : null,
      conversionFromView: rate(counts[i], counts[0]),
    }));
  const countsOf = (r: Document) => [r.s1, r.s2, r.s3, r.s4, r.s5] as number[];
  const total = [0, 1, 2, 3, 4].map((i) => rows.reduce((s, r) => s + countsOf(r)[i], 0));

  return {
    range,
    filters,
    steps: toSteps(total),
    byDevice: rows
      .map((r) => ({ device: String(r._id), steps: toSteps(countsOf(r)) }))
      .sort((a, b) => b.steps[0].sessions - a.steps[0].sessions),
  };
};

// ---------------------------------------------------------------- customers: cohorts, RFM, repeat interval

const keptOrders = async () =>
  orders()
    .find({ status: { $ne: "Cancelled" } }, { projection: { user: 1, createdAt: 1, total: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

export const getCohorts = async () => {
  const rows = await keptOrders();
  const month = (d: Date) => istDate(d).slice(0, 7);
  const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

  const cohortOf = new Map<string, string>();
  const active = new Map<string, Set<string>>(); // cohort|n -> customers
  let maxMonth = "";
  for (const o of rows) {
    const m = month(o.createdAt);
    if (m > maxMonth) maxMonth = m;
    const user = String(o.user);
    if (!cohortOf.has(user)) cohortOf.set(user, m);
  }
  for (const o of rows) {
    const user = String(o.user);
    const cohort = cohortOf.get(user)!;
    const n = monthIndex(month(o.createdAt)) - monthIndex(cohort);
    if (n < 0 || n > 6) continue;
    const key = `${cohort}|${n}`;
    if (!active.has(key)) active.set(key, new Set());
    active.get(key)!.add(user);
  }
  const sizes = new Map<string, number>();
  for (const c of cohortOf.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);

  const cohorts = [...sizes.keys()].sort().map((cohort) => ({
    cohort,
    size: sizes.get(cohort)!,
    retention: [0, 1, 2, 3, 4, 5, 6].map((n) =>
      monthIndex(cohort) + n > monthIndex(maxMonth)
        ? null
        : { month: n, customers: active.get(`${cohort}|${n}`)?.size ?? 0, rate: rate(active.get(`${cohort}|${n}`)?.size ?? 0, sizes.get(cohort)!) }
    ),
  }));

  // Size-weighted average retention per month across cohorts that reached it
  const average = [1, 2, 3, 4, 5, 6].map((n) => {
    const eligible = cohorts.filter((c) => c.retention[n]);
    const customers = eligible.reduce((s, c) => s + (c.retention[n]?.customers ?? 0), 0);
    const base = eligible.reduce((s, c) => s + c.size, 0);
    return { month: n, rate: rate(customers, base) };
  });
  return { cohorts, average };
};

export const getRepeatInterval = async () => {
  const rows = await keptOrders();
  const last = new Map<string, { day: string; n: number }>();
  const all: number[] = [];
  const firstToSecond: number[] = [];
  for (const o of rows) {
    const user = String(o.user);
    const day = istDate(o.createdAt);
    const prev = last.get(user);
    if (prev) {
      const gap = daysBetween(prev.day, day);
      all.push(gap);
      if (prev.n === 1) firstToSecond.push(gap);
    }
    last.set(user, { day, n: (prev?.n ?? 0) + 1 });
  }
  // Linear interpolation, same as SQL quantile_cont
  const quantile = (sorted: number[], q: number) => {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo);
  };
  const summary = (gaps: number[]) => {
    const s = [...gaps].sort((a, b) => a - b);
    return {
      repeatOrders: s.length,
      avgDays: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null,
      p25: quantile(s, 0.25),
      median: quantile(s, 0.5),
      p75: quantile(s, 0.75),
      within30: rate(s.filter((g) => g <= 30).length, s.length),
      within60: rate(s.filter((g) => g <= 60).length, s.length),
      within90: rate(s.filter((g) => g <= 90).length, s.length),
    };
  };
  return { allRepeatOrders: summary(all), firstToSecond: summary(firstToSecond) };
};

export const getRfm = async () => {
  const rows = await orders()
    .aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: "$user", last: { $max: "$createdAt" }, frequency: { $sum: 1 }, monetary: { $sum: "$total" } } },
    ])
    .toArray();
  if (!rows.length) return { referenceDate: null, totalCustomers: 0, totalRevenue: 0, segments: [] };

  const lastDays = rows.map((r) => istDate(r.last));
  const reference = addDays(lastDays.reduce((a, b) => (a > b ? a : b)), 1);
  const input: CustomerRfmInput[] = rows.map((r, i) => ({
    customerId: String(r._id),
    recencyDays: daysBetween(lastDays[i], reference),
    frequency: r.frequency,
    monetary: r.monetary,
  }));
  const scored = scoreRfm(input);
  const totalRevenue = scored.reduce((s, c) => s + c.monetary, 0);

  const bySegment = new Map<RfmSegment, typeof scored>();
  for (const c of scored) {
    if (!bySegment.has(c.segment)) bySegment.set(c.segment, []);
    bySegment.get(c.segment)!.push(c);
  }
  const segments = [...bySegment.entries()]
    .map(([segment, list]) => {
      const revenue = list.reduce((s, c) => s + c.monetary, 0);
      return {
        segment,
        customers: list.length,
        customerShare: rate(list.length, scored.length),
        revenue: round(revenue, 2),
        revenueShare: rate(revenue, totalRevenue),
        avgRecencyDays: list.reduce((s, c) => s + c.recencyDays, 0) / list.length,
        avgOrders: list.reduce((s, c) => s + c.frequency, 0) / list.length,
        avgSpend: revenue / list.length,
        action: RFM_SEGMENTS[segment],
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // R x F grid for a heatmap
  const grid = [5, 4, 3, 2, 1].map((r) => ({
    r,
    cells: [1, 2, 3, 4, 5].map((f) => scored.filter((c) => c.r === r && c.f === f).length),
  }));
  return { referenceDate: reference, totalCustomers: scored.length, totalRevenue: round(totalRevenue, 2), segments, grid };
};

// ---------------------------------------------------------------- products

export const getProducts = async (range?: Range) => {
  const r = range ?? (await fullRange());
  const span = between(r);
  const [engagement, sales, products] = await Promise.all([
    events()
      .aggregate(
        [
          // No product_id null-check here: it would force document fetches and defeat the
          // covering index. Null products are dropped after grouping instead.
          { $match: { type: { $in: ["product_view", "add_to_cart"] }, timestamp: span } },
          // Event counts per product: two keys per product, so this stays fast at any range
          {
            $group: {
              _id: "$product_id",
              views: { $sum: { $cond: [{ $eq: ["$type", "product_view"] }, 1, 0] } },
              addToCarts: { $sum: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } },
            },
          },
          { $match: { _id: { $ne: null } } },
        ],
        agg
      )
      .toArray(),
    orders()
      .find({ createdAt: span }, { projection: { orderItems: 1, status: 1, sessionId: 1, createdAt: 1 } })
      .toArray(),
    db().collection("products").find({}).toArray(),
  ]);

  const recentFrom = istDayStart(addDays(r.to, -29)).getTime();
  type Sales = { units: number; revenue: number; returned: number; recentUnits: number; orders: number };
  const byProduct = new Map<string, Sales>();
  for (const o of sales) {
    const cancelled = o.status === "Cancelled";
    for (const item of o.orderItems ?? []) {
      const id = String(item.productId);
      let s = byProduct.get(id);
      if (!s) byProduct.set(id, (s = { units: 0, revenue: 0, returned: 0, recentUnits: 0, orders: 0 }));
      if (!cancelled) {
        s.units += item.quantity;
        s.revenue += item.price * item.quantity;
        s.orders++;
        if (o.createdAt.getTime() >= recentFrom) s.recentUnits += item.quantity;
      }
      if (o.status === "Returned" || o.status === "RTO") s.returned += item.quantity;
    }
  }
  const eng = new Map(engagement.map((e) => [String(e._id), e]));

  const rows = products
    .map((p) => {
      const id = String(p._id);
      const e = eng.get(id);
      const s = byProduct.get(id);
      const units = s?.units ?? 0;
      const dailyRate = (s?.recentUnits ?? 0) / 30;
      return {
        productId: id,
        name: p.name as string,
        category: p.category as string,
        price: p.price as number,
        photo: p.photo as string,
        stock: (p.stock as number) ?? 0,
        views: e?.views ?? 0,
        addToCarts: e?.addToCarts ?? 0,
        addToCartRate: rate(e?.addToCarts ?? 0, e?.views ?? 0),
        orders: s?.orders ?? 0,
        viewToOrderRate: rate(s?.orders ?? 0, e?.views ?? 0),
        units,
        revenue: round(s?.revenue ?? 0, 2),
        returnRate: rate(s?.returned ?? 0, units),
        daysOfCover: dailyRate ? round(((p.stock as number) ?? 0) / dailyRate, 1) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || (a.productId < b.productId ? -1 : 1));

  const total = rows.reduce((s, p) => s + p.revenue, 0);
  let cumulative = 0;
  const ranked = rows.map((p, i) => {
    const abc = abcClass(cumulative, total);
    cumulative += p.revenue;
    const lowStock = p.stock < 10 || (p.daysOfCover !== null && p.daysOfCover < 14);
    return {
      ...p,
      rank: i + 1,
      revenueShare: rate(p.revenue, total),
      cumulativeShare: rate(cumulative, total),
      abcClass: abc,
      alert: p.stock === 0 ? "Out of stock" : lowStock && p.units ? `Low stock: ${p.daysOfCover ?? 0} days of cover` : null,
    };
  });
  const classes = ["A", "B", "C"].map((c) => {
    const list = ranked.filter((p) => p.abcClass === c);
    return { abcClass: c, products: list.length, revenueShare: rate(list.reduce((s, p) => s + p.revenue, 0), total) };
  });
  return { range: r, totalRevenue: round(total, 2), classes, products: ranked };
};

// ---------------------------------------------------------------- payments & operations

const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600000;

export const getPayments = async (range: Range) => {
  const rows = await orders()
    .find({ createdAt: between(range) }, { projection: { paymentMethod: 1, status: 1, total: 1, statusHistory: 1, createdAt: 1, "shippingInfo.city": 1, "shippingInfo.state": 1 } })
    .toArray();

  const byMethod = ["ONLINE", "COD"].map((method) => {
    const list = rows.filter((o) => o.paymentMethod === method);
    const shipHours: number[] = [];
    const deliverDays: number[] = [];
    for (const o of list) {
      const shipped = o.statusHistory?.find((h: Document) => h.status === "Shipped")?.at;
      const delivered = o.statusHistory?.find((h: Document) => h.status === "Delivered")?.at;
      if (shipped) shipHours.push(hoursBetween(o.createdAt, shipped));
      if (delivered) deliverDays.push(hoursBetween(o.createdAt, delivered) / 24);
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const count = (status: string) => list.filter((o) => o.status === status).length;
    return {
      method,
      orders: list.length,
      orderShare: rate(list.length, rows.length),
      gmv: round(list.reduce((s, o) => s + o.total, 0), 2),
      aov: rate(list.reduce((s, o) => s + o.total, 0), list.length),
      cancellationRate: rate(count("Cancelled"), list.length),
      rtoRate: rate(count("RTO"), list.length),
      returnRate: rate(count("Returned"), list.length),
      lostOrderRate: rate(list.filter((o) => isLost(o.status)).length, list.length),
      lostGmv: round(list.filter((o) => isLost(o.status)).reduce((s, o) => s + o.total, 0), 2),
      avgHoursToShip: avg(shipHours),
      avgDaysToDeliver: avg(deliverDays),
    };
  });

  // Average time from order placed to each later status
  const timeline = ["Shipped", "Delivered", "Cancelled", "RTO", "Returned"].map((status) => {
    const hours = rows.flatMap((o) => {
      const at = o.statusHistory?.find((h: Document) => h.status === status)?.at;
      return at ? [hoursBetween(o.createdAt, at)] : [];
    });
    return { status, orders: hours.length, avgDaysFromOrder: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length / 24 : null };
  });

  const cityMap = new Map<string, { city: string; state: string; orders: number; cod: number; codRto: number; prepaid: number; prepaidRto: number }>();
  for (const o of rows) {
    const key = `${o.shippingInfo?.city}|${o.shippingInfo?.state}`;
    let c = cityMap.get(key);
    if (!c) cityMap.set(key, (c = { city: o.shippingInfo?.city, state: o.shippingInfo?.state, orders: 0, cod: 0, codRto: 0, prepaid: 0, prepaidRto: 0 }));
    c.orders++;
    if (o.paymentMethod === "COD") {
      c.cod++;
      if (o.status === "RTO") c.codRto++;
    } else {
      c.prepaid++;
      if (o.status === "RTO") c.prepaidRto++;
    }
  }
  // Assumption: ₹180 forward + reverse logistics per RTO (same as 09_cod_rto_by_city.sql)
  const RTO_COST = 180;
  const cities = [...cityMap.values()]
    .map((c) => ({
      city: c.city,
      state: c.state,
      orders: c.orders,
      codShare: rate(c.cod, c.orders),
      codRtoRate: rate(c.codRto, c.cod),
      prepaidRtoRate: rate(c.prepaidRto, c.prepaid),
      codRtoOrders: c.codRto,
      estCodRtoCost: c.codRto * RTO_COST,
    }))
    .sort((a, b) => b.codRtoOrders - a.codRtoOrders || a.city.localeCompare(b.city));

  return { range, totalOrders: rows.length, byMethod, timeline, cities, rtoCostAssumption: RTO_COST };
};

// ---------------------------------------------------------------- search

export const getSearch = async (range: Range) => {
  const span = between(range);
  const [terms, ordered, sessionGroups] = await Promise.all([
    events()
      .aggregate(
        [
          { $match: { timestamp: span, type: { $in: ["search", "search_zero_results"] }, "metadata.term": { $type: "string" } } },
          {
            $group: {
              _id: { term: { $toLower: "$metadata.term" }, session: "$session_id" },
              searches: { $sum: 1 },
              zero: { $sum: { $cond: [{ $eq: ["$type", "search_zero_results"] }, 1, 0] } },
            },
          },
        ],
        agg
      )
      .toArray(),
    events().distinct("session_id", { timestamp: span, type: "order_placed" }),
    events()
      .aggregate(
        [
          { $match: { timestamp: span } },
          {
            $group: {
              _id: "$session_id",
              results: { $max: { $cond: [{ $eq: ["$type", "search"] }, 1, 0] } },
              zero: { $max: { $cond: [{ $eq: ["$type", "search_zero_results"] }, 1, 0] } },
              ordered: { $max: { $cond: [{ $eq: ["$type", "order_placed"] }, 1, 0] } },
            },
          },
          {
            $group: {
              _id: {
                $cond: [{ $eq: ["$results", 1] }, "searched, saw results", { $cond: [{ $eq: ["$zero", 1] }, "searched, zero results only", "did not search"] }],
              },
              sessions: { $sum: 1 },
              converted: { $sum: "$ordered" },
            },
          },
        ],
        agg
      )
      .toArray(),
  ]);

  const orderedSet = new Set(ordered as string[]);
  const byTerm = new Map<string, { searches: number; zero: number; sessions: number; converting: number }>();
  for (const t of terms) {
    const term = String(t._id.term);
    let v = byTerm.get(term);
    if (!v) byTerm.set(term, (v = { searches: 0, zero: 0, sessions: 0, converting: 0 }));
    v.searches += t.searches;
    v.zero += t.zero;
    v.sessions++;
    if (orderedSet.has(t._id.session)) v.converting++;
  }
  const totalSearches = [...byTerm.values()].reduce((s, v) => s + v.searches, 0);
  const termRows = [...byTerm.entries()]
    .map(([term, v]) => ({
      term,
      searches: v.searches,
      zeroResultSearches: v.zero,
      zeroResultRate: rate(v.zero, v.searches),
      sessions: v.sessions,
      convertingSessions: v.converting,
      searchToPurchaseRate: rate(v.converting, v.sessions),
      shareOfSearches: rate(v.searches, totalSearches),
    }))
    .sort((a, b) => b.searches - a.searches || a.term.localeCompare(b.term));

  const totalSessions = sessionGroups.reduce((s, g) => s + g.sessions, 0);
  return {
    range,
    totalSearches,
    zeroResultRate: rate(termRows.reduce((s, t) => s + t.zeroResultSearches, 0), totalSearches),
    topSearches: termRows.filter((t) => t.zeroResultSearches < t.searches).slice(0, 15),
    zeroResultTerms: termRows.filter((t) => t.zeroResultSearches > 0).sort((a, b) => b.zeroResultSearches - a.zeroResultSearches),
    terms: termRows,
    conversionBySearch: sessionGroups
      .map((g) => ({ behaviour: String(g._id), sessions: g.sessions, sessionShare: rate(g.sessions, totalSessions), conversionRate: rate(g.converted, g.sessions) }))
      .sort((a, b) => b.sessions - a.sessions),
  };
};

// ---------------------------------------------------------------- coupons

export const getCoupons = async (range: Range) => {
  const span = between(range);
  const [rows, applies] = await Promise.all([
    orders().find({ createdAt: span }, { projection: { couponCode: 1, total: 1, discount: 1, status: 1, sessionId: 1 } }).toArray(),
    events()
      .aggregate([
        { $match: { timestamp: span, type: "coupon_applied" } },
        { $group: { _id: { code: "$metadata.code", s: "$session_id" } } },
        { $group: { _id: "$_id.code", sessions: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const noCoupon = rows.filter((o) => !o.couponCode && o.status !== "Cancelled");
  const aovWithout = rate(noCoupon.reduce((s, o) => s + o.total, 0), noCoupon.length);
  const applyMap = new Map(applies.map((a) => [String(a._id), a.sessions as number]));

  const codes = [...new Set(rows.filter((o) => o.couponCode).map((o) => String(o.couponCode)))];
  const coupons = codes
    .map((code) => {
      const list = rows.filter((o) => o.couponCode === code);
      const gmv = list.reduce((s, o) => s + o.total, 0);
      const discountCost = list.reduce((s, o) => s + (o.discount ?? 0), 0);
      const aov = rate(gmv, list.length);
      return {
        code,
        orders: list.length,
        shareOfAllOrders: rate(list.length, rows.length),
        applySessions: applyMap.get(code) ?? 0,
        redemptionRate: rate(list.length, applyMap.get(code) ?? 0),
        discountCost: round(discountCost, 2),
        avgDiscount: rate(discountCost, list.length),
        gmv: round(gmv, 2),
        aov,
        incrementalAov: aov - aovWithout,
        gmvPerRupeeDiscount: rate(gmv, discountCost),
        cancellationRate: rate(list.filter((o) => o.status === "Cancelled").length, list.length),
      };
    })
    .sort((a, b) => b.gmv - a.gmv);
  return { range, aovWithoutCoupon: aovWithout, couponOrderShare: rate(rows.filter((o) => o.couponCode).length, rows.length), coupons };
};

// ---------------------------------------------------------------- experiments

export const getExperimentResults = async (key: string, opts: { mde?: number } = {}) => {
  const config = EXPERIMENTS[key];
  if (!config) return null;
  const state = await db().collection("experiments").findOne({ key });

  const exposures = await events()
    .aggregate(
      [
        { $match: { type: "experiment_exposure", experiment: key } },
        { $group: { _id: { session: "$session_id", variant: "$variant" }, first: { $min: "$timestamp" } } },
      ],
      agg
    )
    .toArray();
  const sessions = exposures.map((e) => String(e._id.session));
  const sessionOrders = await orders()
    .find({ sessionId: { $in: sessions } }, { projection: { sessionId: 1, total: 1, status: 1, createdAt: 1 } })
    .toArray();
  const ordersBySession = new Map<string, Document[]>();
  for (const o of sessionOrders) {
    if (!ordersBySession.has(o.sessionId)) ordersBySession.set(o.sessionId, []);
    ordersBySession.get(o.sessionId)!.push(o);
  }

  type Arm = { exposed: number; converted: number; totals: number[]; revenuePerSession: number[]; cancelled: number; daily: Map<string, { exposed: number; converted: number }> };
  const arms: Record<Variant, Arm> = {
    control: { exposed: 0, converted: 0, totals: [], revenuePerSession: [], cancelled: 0, daily: new Map() },
    treatment: { exposed: 0, converted: 0, totals: [], revenuePerSession: [], cancelled: 0, daily: new Map() },
  };
  for (const e of exposures) {
    const arm = arms[e._id.variant as Variant];
    if (!arm) continue;
    const after = (ordersBySession.get(e._id.session) ?? []).filter((o) => o.createdAt >= e.first);
    arm.exposed++;
    if (after.length) arm.converted++;
    for (const o of after) {
      arm.totals.push(o.total);
      if (o.status === "Cancelled") arm.cancelled++;
    }
    arm.revenuePerSession.push(after.reduce((s, o) => s + o.total, 0));
    const day = istDate(e.first);
    const d = arm.daily.get(day) ?? { exposed: 0, converted: 0 };
    d.exposed++;
    if (after.length) d.converted++;
    arm.daily.set(day, d);
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const variance = (xs: number[]) => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  };
  const summary = (variant: Variant) => {
    const a = arms[variant];
    return {
      variant,
      label: config.variants[variant].label,
      exposedSessions: a.exposed,
      convertedSessions: a.converted,
      conversionRate: rate(a.converted, a.exposed),
      orders: a.totals.length,
      aov: mean(a.totals),
      aovVariance: variance(a.totals),
      revenue: round(a.totals.reduce((s, x) => s + x, 0), 2),
      revenuePerSession: rate(a.totals.reduce((s, x) => s + x, 0), a.exposed),
      cancellationRate: rate(a.cancelled, a.totals.length),
    };
  };
  const control = summary("control");
  const treatment = summary("treatment");

  const conversion = twoProportionZTest(
    { conversions: control.convertedSessions, n: control.exposedSessions },
    { conversions: treatment.convertedSessions, n: treatment.exposedSessions }
  );
  const aov = welchTTest(
    { mean: control.aov, variance: control.aovVariance, n: Math.max(control.orders, 2) },
    { mean: treatment.aov, variance: treatment.aovVariance, n: Math.max(treatment.orders, 2) }
  );
  const rps = welchTTest(
    { mean: mean(arms.control.revenuePerSession), variance: variance(arms.control.revenuePerSession), n: Math.max(control.exposedSessions, 2) },
    { mean: mean(arms.treatment.revenuePerSession), variance: variance(arms.treatment.revenuePerSession), n: Math.max(treatment.exposedSessions, 2) }
  );
  const cancellation = twoProportionZTest(
    { conversions: arms.control.cancelled, n: Math.max(control.orders, 1) },
    { conversions: arms.treatment.cancelled, n: Math.max(treatment.orders, 1) }
  );
  const srm = srmTest(control.exposedSessions, treatment.exposedSessions);
  const mde = opts.mde ?? 0.05;
  const requiredPerArm = control.conversionRate
    ? requiredSampleSize({ baselineRate: control.conversionRate, minimumDetectableEffect: mde })
    : 0;
  const samplePerArm = Math.min(control.exposedSessions, treatment.exposedSessions);

  // Cumulative conversion by exposure day, for the "is it stable yet?" chart
  const days = [...new Set([...arms.control.daily.keys(), ...arms.treatment.daily.keys()])].sort();
  const cumulative = (variant: Variant) => {
    let exposed = 0;
    let converted = 0;
    return days.map((d) => {
      const v = arms[variant].daily.get(d);
      exposed += v?.exposed ?? 0;
      converted += v?.converted ?? 0;
      return rate(converted, exposed);
    });
  };

  return {
    experiment: {
      ...config,
      status: state?.status ?? "stopped",
      startedAt: state?.startedAt ?? null,
      stoppedAt: state?.stoppedAt ?? null,
      simulated: Boolean(state?.simulated),
    },
    variants: [control, treatment],
    tests: { conversion, aov, revenuePerSession: rps, cancellation },
    srm,
    power: { minimumDetectableEffect: mde, requiredPerArm, samplePerArm },
    verdict: verdict({
      primary: conversion,
      guardrail: { worse: cancellation.absoluteLift > 0, pValue: cancellation.pValue },
      srm,
      samplePerArm,
      requiredPerArm,
    }),
    daily: { days, control: cumulative("control"), treatment: cumulative("treatment") },
  };
};

