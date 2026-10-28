// Builds the charts and headline numbers for docs/analysis_report.md from the SQL results
// (analytics/results/*.csv, produced by `npm run sql`). Usage: npm run report
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { twoProportionZTest, welchTTest } from "../analytics/stats.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RESULTS = path.join(ROOT, "analytics", "results");
const CHARTS = path.join(ROOT, "docs", "charts");

type Row = Record<string, string>;

// Minimal RFC 4180 reader (quoted fields may contain commas)
const readCsv = (name: string): Row[] => {
  const text = fs.readFileSync(path.join(RESULTS, `${name}.csv`), "utf8").trim();
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") out.push(cur), (cur = "");
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const [header, ...lines] = text.split(/\r?\n/);
  const cols = parseLine(header);
  return lines.map((l) => Object.fromEntries(parseLine(l).map((v, i) => [cols[i], v])));
};
const n = (v: string | undefined) => Number(v);

// ---------- tiny SVG chart helpers (static images for the markdown report) ----------

const FONT = "font-family='Segoe UI, Helvetica, Arial, sans-serif'";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

type BarSeries = { name: string; values: number[]; color: string };

const barChart = (o: { title: string; subtitle?: string; labels: string[]; series: BarSeries[]; format: (v: number) => string; width?: number }) => {
  const width = o.width ?? 760;
  const rowH = 22 * o.series.length + 14;
  const left = 230;
  const top = o.subtitle ? 74 : 56;
  const height = top + o.labels.length * rowH + 40;
  const max = Math.max(...o.series.flatMap((s) => s.values)) * 1.15;
  const scale = (v: number) => ((width - left - 40) * v) / max;
  let body = "";
  o.labels.forEach((label, i) => {
    const y = top + i * rowH;
    body += `<text x='${left - 10}' y='${y + (rowH - 14) / 2 + 4}' text-anchor='end' font-size='13' fill='#222'>${esc(label)}</text>`;
    o.series.forEach((s, j) => {
      const by = y + j * 22;
      const w = Math.max(scale(s.values[i]), 1);
      body += `<rect x='${left}' y='${by}' width='${w}' height='18' rx='3' fill='${s.color}'/>`;
      body += `<text x='${left + w + 6}' y='${by + 13}' font-size='12' fill='#333'>${esc(o.format(s.values[i]))}</text>`;
    });
  });
  const legend =
    o.series.length > 1
      ? o.series.map((s, j) => `<rect x='${left + j * 170}' y='${height - 26}' width='12' height='12' fill='${s.color}'/><text x='${left + j * 170 + 18}' y='${height - 16}' font-size='12' fill='#333'>${esc(s.name)}</text>`).join("")
      : "";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' ${FONT}>
<rect width='100%' height='100%' fill='#fff'/>
<text x='20' y='30' font-size='17' font-weight='700' fill='#111'>${esc(o.title)}</text>
${o.subtitle ? `<text x='20' y='52' font-size='12.5' fill='#666'>${esc(o.subtitle)}</text>` : ""}
${body}${legend}
</svg>`;
};

const columnChart = (o: { title: string; subtitle?: string; labels: string[]; values: number[]; highlight?: number[]; format: (v: number) => string }) => {
  const width = 820;
  const height = 340;
  const left = 60;
  const top = 70;
  const bottom = 50;
  const max = Math.max(...o.values) * 1.15;
  const slot = (width - left - 20) / o.values.length;
  const ch = height - top - bottom;
  let body = "";
  o.values.forEach((v, i) => {
    const h = (ch * v) / max;
    const x = left + i * slot + slot * 0.15;
    const color = o.highlight?.includes(i) ? "#e2843a" : "#1f3a93";
    body += `<rect x='${x}' y='${top + ch - h}' width='${slot * 0.7}' height='${h}' rx='3' fill='${color}'/>`;
    body += `<text x='${x + slot * 0.35}' y='${top + ch - h - 6}' text-anchor='middle' font-size='10.5' fill='#333'>${esc(o.format(v))}</text>`;
    body += `<text x='${x + slot * 0.35}' y='${height - bottom + 18}' text-anchor='middle' font-size='11' fill='#444'>${esc(o.labels[i])}</text>`;
  });
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' ${FONT}>
<rect width='100%' height='100%' fill='#fff'/>
<text x='20' y='30' font-size='17' font-weight='700' fill='#111'>${esc(o.title)}</text>
${o.subtitle ? `<text x='20' y='52' font-size='12.5' fill='#666'>${esc(o.subtitle)}</text>` : ""}
<line x1='${left}' y1='${top + ch}' x2='${width - 20}' y2='${top + ch}' stroke='#ccc'/>
${body}
</svg>`;
};

// Difference with 95% CI on a horizontal axis centred on zero
const ciChart = (o: { title: string; subtitle: string; rows: { label: string; diff: number; lo: number; hi: number; text: string }[] }) => {
  const width = 760;
  const rowH = 46;
  const top = 80;
  const height = top + o.rows.length * rowH + 30;
  const left = 230;
  const right = width - 150;
  let body = `<line x1='${(left + right) / 2}' y1='${top - 10}' x2='${(left + right) / 2}' y2='${height - 30}' stroke='#999' stroke-dasharray='4 4'/>`;
  body += `<text x='${(left + right) / 2}' y='${top - 16}' text-anchor='middle' font-size='11' fill='#777'>no difference</text>`;
  o.rows.forEach((r, i) => {
    const bound = Math.max(Math.abs(r.lo), Math.abs(r.hi)) * 1.2;
    const x = (v: number) => (left + right) / 2 + ((right - left) / 2) * (v / bound);
    const y = top + i * rowH + 14;
    const sig = r.lo > 0 || r.hi < 0;
    const color = sig ? "#2f7d4f" : "#6b7280";
    body += `<text x='${left - 12}' y='${y + 4}' text-anchor='end' font-size='13' fill='#222'>${esc(r.label)}</text>`;
    body += `<line x1='${x(r.lo)}' y1='${y}' x2='${x(r.hi)}' y2='${y}' stroke='${color}' stroke-width='3'/>`;
    body += `<circle cx='${x(r.diff)}' cy='${y}' r='6' fill='${color}'/>`;
    body += `<text x='${right + 12}' y='${y + 4}' font-size='12' fill='${color}'>${esc(r.text)}</text>`;
  });
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' ${FONT}>
<rect width='100%' height='100%' fill='#fff'/>
<text x='20' y='30' font-size='17' font-weight='700' fill='#111'>${esc(o.title)}</text>
<text x='20' y='52' font-size='12.5' fill='#666'>${esc(o.subtitle)}</text>
${body}
</svg>`;
};

const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

const lakh = (v: number) => `₹${(v / 1e5).toFixed(1)}L`;

// ---------- build ----------

fs.mkdirSync(CHARTS, { recursive: true });
const write = (name: string, svg: string) => fs.writeFileSync(path.join(CHARTS, name), svg);
const numbers: Record<string, unknown> = {};

// 1. Funnel
const funnel = readCsv("03_funnel");
const all = funnel.filter((r) => r.segment === "all");
write("funnel.svg", barChart({
  title: "Purchase funnel (sessions), 12 months",
  subtitle: "Strict sequential funnel. Simulated data.",
  labels: all.map((r) => r.step.replace(/_/g, " ")),
  series: [{ name: "Sessions", values: all.map((r) => n(r.sessions)), color: "#1f3a93" }],
  format: (v) => `${v.toLocaleString("en-IN")} (${pct(v / n(all[0].sessions), 2)})`,
}));
const byDevice = (d: string) => funnel.find((r) => r.segment === d && r.step === "order_placed")!;
numbers.funnel = {
  viewSessions: n(all[0].sessions),
  orders: n(all[4].sessions),
  viewToOrder: n(all[4].conversion_from_view),
  viewToCartDropOff: n(all[1].step_drop_off),
  mobileViewToOrder: n(byDevice("mobile").conversion_from_view),
  desktopViewToOrder: n(byDevice("desktop").conversion_from_view),
};

// 2. COD vs prepaid
const pay = readCsv("08_payment_cancellation_rto");
const cod = pay.find((r) => r.payment_method === "COD")!;
const online = pay.find((r) => r.payment_method === "ONLINE")!;
write("cod_vs_prepaid.svg", barChart({
  title: "Order outcomes: Cash on Delivery vs prepaid",
  subtitle: "Share of orders placed with each method. Simulated data.",
  labels: ["Cancelled", "RTO (returned to origin)", "Customer return", "Lost (any of the above)"],
  series: [
    { name: "Cash on Delivery", values: ["cancellation_rate", "rto_rate", "return_rate", "lost_order_rate"].map((k) => n(cod[k])), color: "#e2843a" },
    { name: "Prepaid", values: ["cancellation_rate", "rto_rate", "return_rate", "lost_order_rate"].map((k) => n(online[k])), color: "#1f3a93" },
  ],
  format: (v) => pct(v),
}));
const rtoTest = twoProportionZTest(
  { conversions: Math.round(n(online.rto_rate) * n(online.orders)), n: n(online.orders) },
  { conversions: Math.round(n(cod.rto_rate) * n(cod.orders)), n: n(cod.orders) }
);
const cities = readCsv("09_cod_rto_by_city");
numbers.payments = {
  codShare: n(cod.order_share),
  codRto: n(cod.rto_rate),
  prepaidRto: n(online.rto_rate),
  codCancel: n(cod.cancellation_rate),
  prepaidCancel: n(online.cancellation_rate),
  codLost: n(cod.lost_order_rate),
  prepaidLost: n(online.lost_order_rate),
  codLostGmv: n(cod.lost_gmv),
  rtoZ: rtoTest.z,
  rtoP: rtoTest.pValue,
  codRtoOrders: cities.reduce((s, c) => s + n(c.cod_rto_orders), 0),
  codRtoCost: cities.reduce((s, c) => s + n(c.est_cod_rto_cost_inr), 0),
  top5CityShareOfCodRto: n(cities[4].cumulative_share_of_cod_rto),
  top5Cities: cities.slice(0, 5).map((c) => c.city),
};

// 3. Monthly GMV
const monthly = readCsv("02_monthly_gmv_mom");
write("monthly_gmv.svg", columnChart({
  title: "Monthly GMV",
  subtitle: "Orange = Big Saint Days festive sale month (Sep 2026). Oct 2025 is a partial month (4 days). Simulated data.",
  labels: monthly.map((m) => m.month.slice(2)),
  values: monthly.map((m) => n(m.gmv)),
  highlight: [monthly.findIndex((m) => m.month === "2026-09")],
  format: lakh,
}));
const sep = monthly.find((m) => m.month === "2026-09")!;
numbers.monthly = { saleMonthGmv: n(sep.gmv), saleMonthMoM: n(sep.gmv_mom_pct) / 100, totalGmv: monthly.reduce((s, m) => s + n(m.gmv), 0) };

// 4. RFM
const rfm = readCsv("05_rfm_segments");
write("rfm_segments.svg", barChart({
  title: "RFM segments: share of customers vs share of revenue",
  subtitle: "Non-cancelled orders, 12 months. Simulated data.",
  labels: rfm.map((r) => r.segment),
  series: [
    { name: "Share of customers", values: rfm.map((r) => n(r.customer_share)), color: "#9aa8d6" },
    { name: "Share of revenue", values: rfm.map((r) => n(r.revenue_share)), color: "#1f3a93" },
  ],
  format: (v) => pct(v),
}));
const seg = (s: string) => rfm.find((r) => r.segment === s)!;
numbers.rfm = Object.fromEntries(rfm.map((r) => [r.segment, { customers: n(r.customers), customerShare: n(r.customer_share), revenueShare: n(r.revenue_share), avgOrders: n(r.avg_orders), avgSpend: n(r.avg_spend) }]));
const repeatSegments = ["Champions", "Loyal", "Potential Loyalists", "At Risk"];
numbers.rfmRepeatGroup = {
  customerShare: repeatSegments.reduce((s, k) => s + n(seg(k).customer_share), 0),
  revenueShare: repeatSegments.reduce((s, k) => s + n(seg(k).revenue_share), 0),
};

// 5. Cohorts (size-weighted average retention)
const cohorts = readCsv("04_cohort_retention");
const sizes = new Map(cohorts.map((c) => [c.cohort, n(c.cohort_size)]));
const avg = [1, 2, 3, 4, 5, 6].map((m) => {
  const cells = cohorts.filter((c) => n(c.month_number) === m);
  const active = cells.reduce((s, c) => s + n(c.active_customers), 0);
  // cohorts old enough to have reached month m
  const lastCohortMonth = [...sizes.keys()].sort().at(-1)!;
  const eligible = [...sizes.entries()].filter(([c]) => {
    const [y, mo] = c.split("-").map(Number);
    const [ly, lm] = lastCohortMonth.split("-").map(Number);
    return (ly - y) * 12 + (lm - mo) >= m;
  });
  return active / eligible.reduce((s, [, v]) => s + v, 0);
});
write("cohort_retention.svg", columnChart({
  title: "Average cohort retention by months since first order",
  subtitle: "Size-weighted across cohorts that reached each month. Simulated data.",
  labels: ["M1", "M2", "M3", "M4", "M5", "M6"],
  values: avg,
  format: (v) => pct(v),
}));
const interval = readCsv("07_repeat_purchase_interval").find((r) => r.scope === "first to second order")!;
numbers.retention = { m1: avg[0], m3: avg[2], m6: avg[5], medianDaysToSecondOrder: n(interval.median_days), within30: n(interval.share_within_30d), within60: n(interval.share_within_60d) };

// 6. Search
const search = readCsv("12_search_conversion");
write("search_conversion.svg", barChart({
  title: "Session conversion by search behaviour",
  subtitle: "Sessions whose only searches returned nothing convert far worse. Simulated data.",
  labels: search.map((s) => s.search_behaviour),
  series: [{ name: "Conversion", values: search.map((s) => n(s.conversion_rate)), color: "#1f3a93" }],
  format: (v) => pct(v, 2),
}));
const terms = readCsv("11_search_terms");
const zeroTerms = terms.filter((t) => n(t.zero_result_searches) > 0);
const results = search.find((s) => s.search_behaviour.includes("saw results"))!;
const zero = search.find((s) => s.search_behaviour.includes("zero"))!;
const searchTest = twoProportionZTest(
  { conversions: n(zero.converted_sessions), n: n(zero.sessions) },
  { conversions: n(results.converted_sessions), n: n(results.sessions) }
);
numbers.search = {
  zeroShareOfSearches: zeroTerms.reduce((s, t) => s + n(t.share_of_searches), 0),
  zeroSessions: n(zero.sessions),
  zeroConversion: n(zero.conversion_rate),
  resultsConversion: n(results.conversion_rate),
  p: searchTest.pValue,
  topZeroTerms: zeroTerms.slice(0, 4).map((t) => ({ term: t.search_term, searches: n(t.searches), share: n(t.share_of_searches) })),
  // If zero-result sessions converted like sessions that found results
  extraOrdersIfFixed: Math.round(n(zero.sessions) * (n(results.conversion_rate) - n(zero.conversion_rate))),
};

// 7. Experiments
const exp = readCsv("13_experiment_results");
const arm = (e: string, v: string) => exp.find((r) => r.experiment === e && r.variant === v)!;
const experimentNumbers = (key: string) => {
  const c = arm(key, "control");
  const t = arm(key, "treatment");
  const conversion = twoProportionZTest({ conversions: n(c.converted_sessions), n: n(c.exposed_sessions) }, { conversions: n(t.converted_sessions), n: n(t.exposed_sessions) });
  const aov = welchTTest({ mean: n(c.aov), variance: n(c.aov_variance), n: n(c.orders) }, { mean: n(t.aov), variance: n(t.aov_variance), n: n(t.orders) });
  return { control: c, treatment: t, conversion, aov };
};
const ship = experimentNumbers("free_shipping_threshold");
write("ab_free_shipping.svg", ciChart({
  title: "A/B test: free shipping over ₹1,499 vs ₹999",
  subtitle: `Treatment − control with 95% CI. ${n(ship.control.exposed_sessions).toLocaleString("en-IN")} vs ${n(ship.treatment.exposed_sessions).toLocaleString("en-IN")} exposed sessions. Simulated data.`,
  rows: [
    { label: "Conversion (pp)", diff: ship.conversion.absoluteLift * 100, lo: ship.conversion.ci95[0] * 100, hi: ship.conversion.ci95[1] * 100, text: `${(ship.conversion.absoluteLift * 100).toFixed(2)} pp, p=${ship.conversion.pValue.toFixed(2)}` },
    { label: "AOV (₹)", diff: ship.aov.absoluteLift, lo: ship.aov.ci95[0], hi: ship.aov.ci95[1], text: `+₹${ship.aov.absoluteLift.toFixed(0)}, p=${ship.aov.pValue.toFixed(4)}` },
  ],
}));
const coupon = experimentNumbers("coupon_offer");
const coupons = readCsv("10_coupon_roi");
const redeemed = (code: string) => n(coupons.find((c) => c.coupon_code === code)?.orders);
const redemption = twoProportionZTest(
  { conversions: redeemed("SAINT10"), n: n(coupon.control.exposed_sessions) },
  { conversions: redeemed("FLAT150"), n: n(coupon.treatment.exposed_sessions) }
);
write("ab_coupon_redemption.svg", barChart({
  title: "A/B test: 10% off (SAINT10) vs flat ₹150 off (FLAT150)",
  subtitle: `Redemption per exposed session. z-test p ${redemption.pValue < 0.0001 ? "< 0.0001" : "= " + redemption.pValue.toFixed(4)}. Simulated data.`,
  labels: ["Code redeemed", "Converted (any order)"],
  series: [
    { name: "Control: 10% off", values: [redemption.controlRate, coupon.conversion.controlRate], color: "#6b7280" },
    { name: "Treatment: ₹150 off", values: [redemption.treatmentRate, coupon.conversion.treatmentRate], color: "#1f3a93" },
  ],
  format: (v) => pct(v),
}));
const couponRow = (code: string) => coupons.find((c) => c.coupon_code === code)!;
numbers.experiments = {
  freeShipping: {
    exposed: [n(ship.control.exposed_sessions), n(ship.treatment.exposed_sessions)],
    conversion: [ship.conversion.controlRate, ship.conversion.treatmentRate],
    conversionLiftPp: ship.conversion.absoluteLift,
    conversionRelLift: ship.conversion.relativeLift,
    conversionP: ship.conversion.pValue,
    conversionCi: ship.conversion.ci95,
    aov: [n(ship.control.aov), n(ship.treatment.aov)],
    aovLift: ship.aov.absoluteLift,
    aovRelLift: ship.aov.relativeLift,
    aovP: ship.aov.pValue,
    aovCi: ship.aov.ci95,
    rps: [n(ship.control.revenue_per_session), n(ship.treatment.revenue_per_session)],
    cancellation: [n(ship.control.cancellation_rate), n(ship.treatment.cancellation_rate)],
  },
  couponOffer: {
    exposed: [n(coupon.control.exposed_sessions), n(coupon.treatment.exposed_sessions)],
    redemption: [redemption.controlRate, redemption.treatmentRate],
    redemptionP: redemption.pValue,
    conversion: [coupon.conversion.controlRate, coupon.conversion.treatmentRate],
    conversionP: coupon.conversion.pValue,
    discountPerOrder: [n(couponRow("SAINT10").avg_discount), n(couponRow("FLAT150").avg_discount)],
  },
  welcome: { aov: n(couponRow("WELCOME100").aov), incrementalAov: n(couponRow("WELCOME100").incremental_aov), share: n(couponRow("WELCOME100").share_of_all_orders) },
  bigSaint: { aov: n(couponRow("BIGSAINT200").aov), incrementalAov: n(couponRow("BIGSAINT200").incremental_aov) },
};

// Pareto
const products = readCsv("06_product_performance_abc");
numbers.pareto = {
  products: products.length,
  aProducts: products.filter((p) => p.abc_class === "A").length,
  lowCover: products.filter((p) => p.days_of_cover && n(p.days_of_cover) < 14 && p.abc_class === "A").map((p) => `${p.product_name} (${n(p.days_of_cover)} days)`),
};

fs.writeFileSync(path.join(ROOT, "docs", "report_numbers.json"), JSON.stringify(numbers, null, 2) + "\n");
console.log(`Wrote ${fs.readdirSync(CHARTS).length} charts to docs/charts and docs/report_numbers.json`);
console.log(JSON.stringify(numbers, null, 1));

