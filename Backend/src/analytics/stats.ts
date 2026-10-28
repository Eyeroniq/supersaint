// Statistics for A/B tests. Pure functions, unit-tested against SciPy reference values.

// Complementary error function (Numerical Recipes erfcc, |relative error| < 1.2e-7)
const erfc = (x: number) => {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
};

export const normalCdf = (z: number) => 0.5 * erfc(-z / Math.SQRT2);

// Inverse normal CDF (Acklam's algorithm, refined with one Halley step)
export const normalQuantile = (p: number) => {
  if (p <= 0 || p >= 1) throw new RangeError("p must be in (0, 1)");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  let x: number;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - low) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
};

// ln Γ(x), Lanczos approximation
const logGamma = (x: number): number => {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const coef of g) ser += coef / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
};

// Continued fraction for the incomplete beta function (Numerical Recipes betacf)
const betaContinuedFraction = (a: number, b: number, x: number) => {
  const tiny = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
};

// Regularized incomplete beta I_x(a, b)
export const incompleteBeta = (x: number, a: number, b: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
};

// Two-sided p-value for Student's t with (possibly fractional) degrees of freedom
export const tTwoSidedP = (t: number, df: number) => incompleteBeta(df / (df + t * t), df / 2, 0.5);

export const twoSidedP = (z: number) => 2 * (1 - normalCdf(Math.abs(z)));

export type ProportionTest = {
  controlRate: number;
  treatmentRate: number;
  absoluteLift: number;
  relativeLift: number;
  z: number;
  pValue: number;
  ci95: [number, number];
};

// Pooled two-proportion z-test; CI for the difference uses the unpooled (Wald) standard error
export const twoProportionZTest = (
  control: { conversions: number; n: number },
  treatment: { conversions: number; n: number },
  alpha = 0.05
): ProportionTest => {
  const p1 = control.conversions / control.n;
  const p2 = treatment.conversions / treatment.n;
  const pooled = (control.conversions + treatment.conversions) / (control.n + treatment.n);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / control.n + 1 / treatment.n));
  const z = sePooled === 0 ? 0 : (p2 - p1) / sePooled;
  const seDiff = Math.sqrt((p1 * (1 - p1)) / control.n + (p2 * (1 - p2)) / treatment.n);
  const crit = normalQuantile(1 - alpha / 2);
  const diff = p2 - p1;
  return {
    controlRate: p1,
    treatmentRate: p2,
    absoluteLift: diff,
    relativeLift: p1 === 0 ? 0 : diff / p1,
    z,
    pValue: twoSidedP(z),
    ci95: [diff - crit * seDiff, diff + crit * seDiff],
  };
};

export type MeanTest = {
  controlMean: number;
  treatmentMean: number;
  absoluteLift: number;
  relativeLift: number;
  t: number;
  df: number;
  pValue: number;
  ci95: [number, number];
};

// Welch's unequal-variance t-test from summary statistics (sample variances)
export const welchTTest = (
  control: { mean: number; variance: number; n: number },
  treatment: { mean: number; variance: number; n: number },
  alpha = 0.05
): MeanTest => {
  const v1 = control.variance / control.n;
  const v2 = treatment.variance / treatment.n;
  const se = Math.sqrt(v1 + v2);
  const diff = treatment.mean - control.mean;
  const t = se === 0 ? 0 : diff / se;
  // Welch–Satterthwaite degrees of freedom
  const df = (v1 + v2) ** 2 / (v1 ** 2 / (control.n - 1) + v2 ** 2 / (treatment.n - 1));
  // t critical value by bisection on the CDF
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  const crit = (lo + hi) / 2;
  return {
    controlMean: control.mean,
    treatmentMean: treatment.mean,
    absoluteLift: diff,
    relativeLift: control.mean === 0 ? 0 : diff / control.mean,
    t,
    df,
    pValue: tTwoSidedP(t, df),
    ci95: [diff - crit * se, diff + crit * se],
  };
};

// Sample-ratio mismatch: chi-square goodness of fit (1 df) against the planned split
export const srmTest = (controlN: number, treatmentN: number, expectedControlShare = 0.5) => {
  const total = controlN + treatmentN;
  const e1 = total * expectedControlShare;
  const e2 = total - e1;
  const chi2 = (controlN - e1) ** 2 / e1 + (treatmentN - e2) ** 2 / e2;
  const pValue = twoSidedP(Math.sqrt(chi2));
  return { chi2, pValue, mismatch: pValue < 0.001 };
};

// Sessions needed per arm to detect a relative lift in a conversion rate
export const requiredSampleSize = ({
  baselineRate,
  minimumDetectableEffect,
  alpha = 0.05,
  power = 0.8,
}: {
  baselineRate: number;
  /** relative, e.g. 0.05 = detect a 5% relative change */
  minimumDetectableEffect: number;
  alpha?: number;
  power?: number;
}) => {
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);
  const pBar = (p1 + p2) / 2;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const n =
    (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 /
    (p2 - p1) ** 2;
  return Math.ceil(n);
};

export type Verdict = { decision: "ship" | "dont_ship" | "keep_running" | "investigate"; headline: string; reasons: string[] };

// Plain-English decision rule, applied in this order:
// 1. Sample-ratio mismatch -> results untrustworthy, investigate.
// 2. Guardrail significantly worse -> don't ship.
// 3. Primary metric significantly better -> ship; significantly worse -> don't ship.
// 4. Not significant and still under the planned sample size -> keep running.
// 5. Not significant at full sample -> no detectable effect; don't ship (keep control).
export const verdict = (input: {
  primary: ProportionTest;
  guardrail: { worse: boolean; pValue: number };
  srm: { mismatch: boolean };
  samplePerArm: number;
  requiredPerArm: number;
  alpha?: number;
}): Verdict => {
  const alpha = input.alpha ?? 0.05;
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  const { primary } = input;
  const reasons = [
    `Conversion ${pct(primary.controlRate)} (control) vs ${pct(primary.treatmentRate)} (treatment), ` +
      `relative lift ${(primary.relativeLift * 100).toFixed(1)}%, p = ${primary.pValue.toFixed(4)}.`,
    `Sample ${input.samplePerArm.toLocaleString("en-IN")} per arm vs ${input.requiredPerArm.toLocaleString("en-IN")} needed.`,
  ];
  if (input.srm.mismatch)
    return { decision: "investigate", headline: "Investigate: traffic split doesn't match 50/50 (sample-ratio mismatch)", reasons };
  if (input.guardrail.worse && input.guardrail.pValue < alpha)
    return { decision: "dont_ship", headline: "Don't ship: the guardrail metric got significantly worse", reasons };
  if (primary.pValue < alpha)
    return primary.absoluteLift > 0
      ? { decision: "ship", headline: "Ship: treatment significantly improves conversion", reasons }
      : { decision: "dont_ship", headline: "Don't ship: treatment significantly lowers conversion", reasons };
  if (input.samplePerArm < input.requiredPerArm)
    return { decision: "keep_running", headline: "Keep running: not enough data yet to detect the target effect", reasons };
  return { decision: "dont_ship", headline: "Don't ship: no detectable effect on conversion at full sample", reasons };
};
