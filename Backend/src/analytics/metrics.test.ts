import { describe, expect, it } from "vitest";
import { couponDiscount } from "../utils/pricing.js";
import { assignVariant, fnv1a } from "./experiments.js";
import { abcClass, frequencyScore, ntile, pctChange, rate, rfmSegment, scoreRfm } from "./metrics.js";

describe("ntile", () => {
  it("matches SQL NTILE bucket sizes", () => {
    const sizes = (n: number, k: number) => {
      const counts = new Map<number, number>();
      for (const b of ntile(n, k)) counts.set(b, (counts.get(b) ?? 0) + 1);
      return [...counts.values()];
    };
    expect(sizes(13, 5)).toEqual([3, 3, 3, 2, 2]);
    expect(sizes(10, 5)).toEqual([2, 2, 2, 2, 2]);
    expect(ntile(3, 5)).toEqual([1, 2, 3]);
  });
});

describe("RFM", () => {
  it("bins frequency 1, 2, 3, 4-5, 6+", () => {
    expect([1, 2, 3, 4, 5, 6, 12].map(frequencyScore)).toEqual([1, 2, 3, 4, 4, 5, 5]);
  });

  it("maps R/F scores to segments", () => {
    expect(rfmSegment(5, 5)).toBe("Champions");
    expect(rfmSegment(4, 2)).toBe("Potential Loyalists");
    expect(rfmSegment(5, 1)).toBe("New Customers");
    expect(rfmSegment(3, 4)).toBe("Loyal");
    expect(rfmSegment(3, 1)).toBe("Need Attention");
    expect(rfmSegment(1, 3)).toBe("At Risk");
    expect(rfmSegment(2, 1)).toBe("Hibernating");
  });

  it("scores the most recent and highest spender 5/5 with deterministic tie-breaks", () => {
    const customers = Array.from({ length: 10 }, (_, i) => ({
      customerId: `c${i}`,
      recencyDays: 100 - i * 10,
      frequency: i < 2 ? 6 : 1,
      monetary: i * 1000,
    }));
    const scored = scoreRfm(customers);
    const last = scored.find((c) => c.customerId === "c9")!;
    expect(last.r).toBe(5);
    expect(last.m).toBe(5);
    expect(scored.find((c) => c.customerId === "c0")!.r).toBe(1);
    // ties on recency fall back to customer id order
    const tied = scoreRfm([
      { customerId: "b", recencyDays: 5, frequency: 1, monetary: 1 },
      { customerId: "a", recencyDays: 5, frequency: 1, monetary: 1 },
    ]);
    expect(tied.find((c) => c.customerId === "a")!.r).toBe(1);
  });
});

describe("rates and classes", () => {
  it("guards against division by zero", () => {
    expect(rate(1, 0)).toBe(0);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(110, 100)).toBeCloseTo(0.1);
  });

  it("classifies ABC on revenue share before the product", () => {
    expect(abcClass(0, 100)).toBe("A");
    expect(abcClass(79.9, 100)).toBe("A");
    expect(abcClass(80, 100)).toBe("B");
    expect(abcClass(95, 100)).toBe("C");
  });
});

describe("experiment assignment", () => {
  it("is deterministic and roughly 50/50", () => {
    expect(assignVariant("free_shipping_threshold", "visitor-1")).toBe(assignVariant("free_shipping_threshold", "visitor-1"));
    let treatment = 0;
    for (let i = 0; i < 20000; i++) if (assignVariant("free_shipping_threshold", `v-${i}`) === "treatment") treatment++;
    expect(treatment / 20000).toBeGreaterThan(0.48);
    expect(treatment / 20000).toBeLessThan(0.52);
  });

  it("splits experiments independently", () => {
    let same = 0;
    for (let i = 0; i < 20000; i++)
      if (assignVariant("free_shipping_threshold", `v-${i}`) === assignVariant("coupon_offer", `v-${i}`)) same++;
    expect(same / 20000).toBeGreaterThan(0.47);
    expect(same / 20000).toBeLessThan(0.53);
  });

  it("uses FNV-1a", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });
});

describe("coupon discount", () => {
  it("applies flat and capped percent coupons, never above the subtotal", () => {
    expect(couponDiscount({ type: "flat", amount: 150 }, 999)).toBe(150);
    expect(couponDiscount({ type: "percent", amount: 10, maxDiscount: 300 }, 1999)).toBe(200);
    expect(couponDiscount({ type: "percent", amount: 10, maxDiscount: 300 }, 4999)).toBe(300);
    expect(couponDiscount({ type: "flat", amount: 500 }, 300)).toBe(300);
  });
});
