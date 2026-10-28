// Metric helpers shared by the API. Each mirrors a definition in analytics/sql so the
// live dashboard and the warehouse agree (checked by consistency.test.ts).

export const rate = (numerator: number, denominator: number) => (denominator ? numerator / denominator : 0);

export const pctChange = (current: number, previous: number) =>
  previous ? (current - previous) / previous : null;

// Same bucket sizes as SQL NTILE(k): the first (n mod k) buckets get one extra row
export const ntile = (n: number, buckets: number) => {
  const base = Math.floor(n / buckets);
  const extra = n % buckets;
  const out: number[] = new Array(n);
  let i = 0;
  for (let b = 1; b <= buckets; b++) {
    const size = base + (b <= extra ? 1 : 0);
    for (let j = 0; j < size; j++) out[i++] = b;
  }
  return out;
};

// SQL orders VARCHAR byte-wise; for ASCII ids this matches plain < comparison
const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const frequencyScore = (orders: number) => (orders >= 6 ? 5 : orders >= 4 ? 4 : orders);

export const RFM_SEGMENTS = {
  Champions: "Reward them: early access to drops, referral codes. No discounts needed.",
  Loyal: "Upsell packs and new lines; invite to a loyalty tier.",
  "Potential Loyalists": "Nudge the next order with a time-bound bundle or free shipping.",
  "New Customers": "Onboarding series: fit guide, care tips, second-order incentive within 30 days.",
  "Need Attention": "Personalised recommendations based on last purchase; limited-time offer.",
  "At Risk": "Win-back campaign with a meaningful offer before they churn.",
  Hibernating: "Low-cost reactivation (sale announcements); suppress from paid retargeting if no response.",
} as const;
export type RfmSegment = keyof typeof RFM_SEGMENTS;

export const rfmSegment = (r: number, f: number): RfmSegment => {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 4 && f >= 2) return "Potential Loyalists";
  if (r >= 4) return "New Customers";
  if (r === 3 && f >= 4) return "Loyal";
  if (r === 3) return "Need Attention";
  if (f >= 3) return "At Risk";
  return "Hibernating";
};

export type CustomerRfmInput = { customerId: string; recencyDays: number; frequency: number; monetary: number };
export type CustomerRfm = CustomerRfmInput & { r: number; f: number; m: number; segment: RfmSegment };

// R: NTILE(5) over recency descending (5 = most recent); M: NTILE(5) over spend ascending
export const scoreRfm = (customers: CustomerRfmInput[]): CustomerRfm[] => {
  const n = customers.length;
  const buckets = ntile(n, 5);
  const r = new Map<string, number>();
  const m = new Map<string, number>();
  [...customers]
    .sort((a, b) => b.recencyDays - a.recencyDays || byId(a.customerId, b.customerId))
    .forEach((c, i) => r.set(c.customerId, buckets[i]));
  [...customers]
    .sort((a, b) => a.monetary - b.monetary || byId(a.customerId, b.customerId))
    .forEach((c, i) => m.set(c.customerId, buckets[i]));
  return customers.map((c) => {
    const rs = r.get(c.customerId)!;
    const fs = frequencyScore(c.frequency);
    return { ...c, r: rs, f: fs, m: m.get(c.customerId)!, segment: rfmSegment(rs, fs) };
  });
};

// A = first 80% of revenue, B = next 15%, C = the rest (share *before* adding this product)
export const abcClass = (cumulativeBefore: number, total: number) => {
  const share = total ? cumulativeBefore / total : 1;
  return share < 0.8 ? "A" : share < 0.95 ? "B" : "C";
};

export const round = (v: number, dp = 4) => Math.round(v * 10 ** dp) / 10 ** dp;
