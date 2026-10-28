// Client-side copy of Backend/src/analytics/stats.ts requiredSampleSize, for the
// interactive calculator (the backend version is the unit-tested one).

const normalCdf = (z: number) => {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
};

// Bisection is plenty precise for a calculator
const normalQuantile = (p: number) => {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

export const requiredSampleSize = (baselineRate: number, relativeMde: number, alpha = 0.05, power = 0.8) => {
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + relativeMde);
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1 || p1 === p2) return null;
  const pBar = (p1 + p2) / 2;
  const n =
    (normalQuantile(1 - alpha / 2) * Math.sqrt(2 * pBar * (1 - pBar)) +
      normalQuantile(power) * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 /
    (p2 - p1) ** 2;
  return Math.ceil(n);
};
