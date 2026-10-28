import { describe, expect, it } from "vitest";
import {
  normalCdf,
  normalQuantile,
  requiredSampleSize,
  srmTest,
  tTwoSidedP,
  twoProportionZTest,
  verdict,
  welchTTest,
} from "./stats.js";

// Reference values computed with SciPy 1.16 (scipy.stats.norm / t / ttest_ind / chisquare)
describe("normal distribution", () => {
  it("matches scipy norm.cdf and norm.ppf", () => {
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 6);
    expect(normalQuantile(0.8)).toBeCloseTo(0.8416212335729143, 6);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232306167813, 5);
  });
});

describe("Student t", () => {
  it("matches scipy two-sided p-values, including fractional df", () => {
    expect(tTwoSidedP(2, 10)).toBeCloseTo(0.0733880347707404, 6);
    expect(tTwoSidedP(2.228, 10)).toBeCloseTo(0.05001177181711131, 6);
    expect(tTwoSidedP(1.5, 3.7)).toBeCloseTo(0.2135981692020133, 6);
  });
});

describe("two-proportion z-test", () => {
  it("matches the pooled z and p-value", () => {
    const r = twoProportionZTest({ conversions: 200, n: 1000 }, { conversions: 250, n: 1000 });
    expect(r.z).toBeCloseTo(2.677397763008329, 6);
    expect(r.pValue).toBeCloseTo(0.007419649261025686, 6);
    expect(r.absoluteLift).toBeCloseTo(0.05, 10);
    expect(r.relativeLift).toBeCloseTo(0.25, 10);
  });

  it("builds a 95% CI around the difference that excludes 0 when significant", () => {
    const r = twoProportionZTest({ conversions: 200, n: 1000 }, { conversions: 250, n: 1000 });
    const se = Math.sqrt((0.2 * 0.8) / 1000 + (0.25 * 0.75) / 1000);
    expect(r.ci95[0]).toBeCloseTo(0.05 - 1.959964 * se, 6);
    expect(r.ci95[1]).toBeCloseTo(0.05 + 1.959964 * se, 6);
    expect(r.ci95[0]).toBeGreaterThan(0);
  });
});

describe("Welch t-test", () => {
  it("matches scipy ttest_ind(equal_var=False) from summary stats", () => {
    // a = [19.7, 20.4, 21.1, 18.9, 20.0], b = [22.1, 23.0, 21.5, 24.2, 22.8, 21.9]
    const r = welchTTest(
      { mean: 20.02, variance: 0.6670000000000014, n: 5 },
      { mean: 22.583333333333332, variance: 0.9416666666666664, n: 6 }
    );
    expect(r.t).toBeCloseTo(4.757166203305003, 6);
    expect(r.df).toBeCloseTo(8.991795468723675, 6);
    expect(r.pValue).toBeCloseTo(0.0010363801219951125, 6);
    expect(r.ci95[0]).toBeLessThan(r.absoluteLift);
    expect(r.ci95[1]).toBeGreaterThan(r.absoluteLift);
  });
});

describe("sample-ratio mismatch", () => {
  it("flags a 52/48 split on 10,000 sessions", () => {
    const r = srmTest(5200, 4800);
    expect(r.pValue).toBeCloseTo(6.334248366623988e-5, 8);
    expect(r.mismatch).toBe(true);
  });
  it("passes an even split", () => {
    expect(srmTest(5000, 5000).pValue).toBeCloseTo(1, 6);
    expect(srmTest(5000, 5000).mismatch).toBe(false);
  });
});

describe("minimum sample size", () => {
  it("matches the standard formula: 10% baseline, 10% relative MDE", () => {
    expect(requiredSampleSize({ baselineRate: 0.1, minimumDetectableEffect: 0.1 })).toBe(14751);
  });
  it("needs more sample for smaller effects", () => {
    const big = requiredSampleSize({ baselineRate: 0.4, minimumDetectableEffect: 0.1 });
    const small = requiredSampleSize({ baselineRate: 0.4, minimumDetectableEffect: 0.05 });
    expect(small).toBeGreaterThan(big * 3.5);
  });
});

describe("verdict", () => {
  const base = { guardrail: { worse: false, pValue: 0.5 }, srm: { mismatch: false } };
  const sig = twoProportionZTest({ conversions: 200, n: 1000 }, { conversions: 250, n: 1000 });
  const flat = twoProportionZTest({ conversions: 200, n: 1000 }, { conversions: 205, n: 1000 });

  it("ships a significant win", () => {
    expect(verdict({ ...base, primary: sig, samplePerArm: 1000, requiredPerArm: 900 }).decision).toBe("ship");
  });
  it("keeps running when underpowered", () => {
    expect(verdict({ ...base, primary: flat, samplePerArm: 1000, requiredPerArm: 9000 }).decision).toBe("keep_running");
  });
  it("blocks on SRM before anything else", () => {
    expect(
      verdict({ ...base, srm: { mismatch: true }, primary: sig, samplePerArm: 1000, requiredPerArm: 900 }).decision
    ).toBe("investigate");
  });
  it("blocks on a significantly worse guardrail", () => {
    expect(
      verdict({ ...base, guardrail: { worse: true, pValue: 0.01 }, primary: sig, samplePerArm: 1000, requiredPerArm: 900 }).decision
    ).toBe("dont_ship");
  });
});
