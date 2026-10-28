// Checks that the live API (MongoDB aggregations) and the SQL layer (DuckDB) report the same
// numbers on the simulated dataset. Requires: npm run seed:sim && npm run export:warehouse.
import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { config } from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SIM_DB_NAME } from "../scripts/sim/world.js";
import {
  Range,
  fullRange,
  getCohorts,
  getCoupons,
  getExperimentResults,
  getFunnel,
  getKpiDaily,
  getPayments,
  getProducts,
  getRepeatInterval,
  getRfm,
  getSearch,
} from "./service.js";

config({ path: "./.env" });

const ANALYTICS_DIR = path.resolve(__dirname, "../../../analytics");
const WAREHOUSE = path.join(ANALYTICS_DIR, "warehouse.duckdb");
const ready = fs.existsSync(WAREHOUSE) && Boolean(process.env.MONGO_URI);

type Row = Record<string, string | number | boolean | null>;
let conn: DuckDBConnection;
let range: Range;

const sql = async (file: string): Promise<Row[]> => {
  const text = fs.readFileSync(path.join(ANALYTICS_DIR, "sql", file), "utf8").trim().replace(/;\s*$/, "");
  const reader = await conn.runAndReadAll(text);
  return reader.getRowObjectsJson() as Row[];
};
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

describe.skipIf(!ready)("SQL warehouse and live API agree on the simulated data", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI!, { dbName: SIM_DB_NAME });
    const duck = await DuckDBInstance.create(WAREHOUSE, { access_mode: "READ_ONLY" });
    conn = await duck.connect();
    range = await fullRange();
  }, 60_000);

  afterAll(async () => {
    conn?.closeSync();
    await mongoose.disconnect();
  });

  it("daily KPIs (00_kpi_daily)", async () => {
    const [expected, actual] = await Promise.all([sql("00_kpi_daily.sql"), getKpiDaily(range)]);
    expect(actual.length).toBe(expected.length);
    expected.forEach((e, i) => {
      const a = actual[i];
      expect(a.date).toBe(e.date);
      expect({ d: a.date, sessions: a.sessions, orders: a.orders, converted: a.converted_sessions, cart: a.cart_sessions, new: a.new_customers, repeat: a.repeat_customers, cancelled: a.cancelled_orders, rto: a.rto_orders })
        .toEqual({ d: e.date, sessions: n(e.sessions), orders: n(e.orders), converted: n(e.converted_sessions), cart: n(e.cart_sessions), new: n(e.new_customers), repeat: n(e.repeat_customers), cancelled: n(e.cancelled_orders), rto: n(e.rto_orders) });
      expect(a.gmv).toBeCloseTo(n(e.gmv)!, 2);
      expect(a.net_revenue).toBeCloseTo(n(e.net_revenue)!, 2);
    });
  }, 120_000);

  it("funnel overall and by device (03_funnel)", async () => {
    const [expected, actual] = await Promise.all([sql("03_funnel.sql"), getFunnel(range)]);
    const api = [
      ...actual.steps.map((s) => ({ segment: "all", step: s.step, sessions: s.sessions })),
      ...actual.byDevice.flatMap((d) => d.steps.map((s) => ({ segment: d.device, step: s.step, sessions: s.sessions }))),
    ];
    for (const e of expected) {
      const a = api.find((x) => x.segment === e.segment && x.step === e.step);
      expect(a?.sessions, `${e.segment} ${e.step}`).toBe(n(e.sessions));
    }
  }, 120_000);

  it("cohort retention (04_cohort_retention)", async () => {
    const [expected, actual] = await Promise.all([sql("04_cohort_retention.sql"), getCohorts()]);
    for (const e of expected) {
      const cohort = actual.cohorts.find((c) => c.cohort === e.cohort)!;
      expect(cohort.size).toBe(n(e.cohort_size));
      expect(cohort.retention[Number(e.month_number)]?.customers, `${e.cohort} m${e.month_number}`).toBe(n(e.active_customers));
    }
    const cells = actual.cohorts.reduce((s, c) => s + c.retention.filter((r) => r && r.customers > 0).length, 0);
    expect(cells).toBe(expected.length);
  }, 60_000);

  it("RFM segments (05_rfm_segments)", async () => {
    const [expected, actual] = await Promise.all([sql("05_rfm_segments.sql"), getRfm()]);
    expect(actual.segments.length).toBe(expected.length);
    for (const e of expected) {
      const a = actual.segments.find((s) => s.segment === e.segment)!;
      expect(a.customers, String(e.segment)).toBe(n(e.customers));
      expect(a.revenue).toBeCloseTo(n(e.revenue)!, 2);
      expect(a.revenueShare).toBeCloseTo(n(e.revenue_share)!, 4);
    }
  }, 60_000);

  it("product performance and ABC (06_product_performance_abc)", async () => {
    const [expected, actual] = await Promise.all([sql("06_product_performance_abc.sql"), getProducts(range)]);
    for (const e of expected) {
      const a = actual.products.find((p) => p.productId === e.product_id)!;
      expect({ id: a.productId, rank: a.rank, units: a.units, views: a.views, abc: a.abcClass })
        .toEqual({ id: e.product_id, rank: n(e.revenue_rank), units: n(e.units), views: n(e.views), abc: e.abc_class });
      expect(a.revenue).toBeCloseTo(n(e.revenue)!, 2);
      expect(a.addToCartRate).toBeCloseTo(n(e.add_to_cart_rate) ?? 0, 4);
      expect(a.viewToOrderRate).toBeCloseTo(n(e.view_to_order_rate) ?? 0, 4);
      expect(a.returnRate).toBeCloseTo(n(e.return_rate) ?? 0, 4);
    }
  }, 120_000);

  it("repeat purchase interval (07_repeat_purchase_interval)", async () => {
    const [expected, actual] = await Promise.all([sql("07_repeat_purchase_interval.sql"), getRepeatInterval()]);
    const all = expected.find((e) => e.scope === "all repeat orders")!;
    const first = expected.find((e) => e.scope === "first to second order")!;
    expect(actual.allRepeatOrders.repeatOrders).toBe(n(all.repeat_orders));
    expect(actual.allRepeatOrders.median).toBeCloseTo(n(all.median_days)!, 6);
    expect(actual.allRepeatOrders.avgDays!).toBeCloseTo(n(all.avg_days)!, 1);
    expect(actual.firstToSecond.repeatOrders).toBe(n(first.repeat_orders));
    expect(actual.firstToSecond.median).toBeCloseTo(n(first.median_days)!, 6);
  }, 60_000);

  it("COD vs prepaid (08_payment_cancellation_rto) and city RTO (09_cod_rto_by_city)", async () => {
    const [methods, cities, actual] = await Promise.all([
      sql("08_payment_cancellation_rto.sql"),
      sql("09_cod_rto_by_city.sql"),
      getPayments(range),
    ]);
    for (const e of methods) {
      const a = actual.byMethod.find((m) => m.method === e.payment_method)!;
      expect(a.orders).toBe(n(e.orders));
      expect(a.cancellationRate).toBeCloseTo(n(e.cancellation_rate)!, 4);
      expect(a.rtoRate).toBeCloseTo(n(e.rto_rate)!, 4);
      expect(a.returnRate).toBeCloseTo(n(e.return_rate)!, 4);
      expect(a.avgDaysToDeliver!).toBeCloseTo(n(e.avg_days_to_deliver)!, 1);
    }
    for (const e of cities) {
      const a = actual.cities.find((c) => c.city === e.city)!;
      expect({ city: a.city, orders: a.orders, codRto: a.codRtoOrders }).toEqual({ city: e.city, orders: n(e.orders), codRto: n(e.cod_rto_orders) });
    }
  }, 60_000);

  it("coupon ROI (10_coupon_roi)", async () => {
    const [expected, actual] = await Promise.all([sql("10_coupon_roi.sql"), getCoupons(range)]);
    for (const e of expected) {
      const a = actual.coupons.find((c) => c.code === e.coupon_code)!;
      expect({ code: a.code, orders: a.orders, applies: a.applySessions }).toEqual({ code: e.coupon_code, orders: n(e.orders), applies: n(e.apply_sessions) });
      expect(a.discountCost).toBeCloseTo(n(e.discount_cost)!, 2);
      expect(a.incrementalAov).toBeCloseTo(n(e.incremental_aov)!, 1);
    }
  }, 60_000);

  it("search terms and search conversion (11_search_terms, 12_search_conversion)", async () => {
    const [terms, behaviour, actual] = await Promise.all([sql("11_search_terms.sql"), sql("12_search_conversion.sql"), getSearch(range)]);
    for (const e of terms) {
      const a = actual.terms.find((t) => t.term === e.search_term)!;
      expect({ term: a.term, searches: a.searches, zero: a.zeroResultSearches, sessions: a.sessions, converting: a.convertingSessions })
        .toEqual({ term: e.search_term, searches: n(e.searches), zero: n(e.zero_result_searches), sessions: n(e.sessions), converting: n(e.converting_sessions) });
    }
    for (const e of behaviour) {
      const a = actual.conversionBySearch.find((b) => b.behaviour === e.search_behaviour)!;
      expect(a.sessions).toBe(n(e.sessions));
      expect(a.conversionRate).toBeCloseTo(n(e.conversion_rate)!, 4);
    }
  }, 120_000);

  it("experiment results (13_experiment_results)", async () => {
    const expected = await sql("13_experiment_results.sql");
    for (const key of ["free_shipping_threshold", "coupon_offer"]) {
      const actual = (await getExperimentResults(key))!;
      for (const e of expected.filter((x) => x.experiment === key)) {
        const a = actual.variants.find((v) => v.variant === e.variant)!;
        expect({ k: key, v: a.variant, exposed: a.exposedSessions, converted: a.convertedSessions, orders: a.orders })
          .toEqual({ k: key, v: e.variant, exposed: n(e.exposed_sessions), converted: n(e.converted_sessions), orders: n(e.orders) });
        expect(a.aov).toBeCloseTo(n(e.aov)!, 2);
        expect(a.aovVariance).toBeCloseTo(n(e.aov_variance)!, 0);
        if (e.variant === "treatment") expect(actual.tests.conversion.z).toBeCloseTo(n(e.z_vs_control)!, 3);
      }
    }
  }, 60_000);
});
