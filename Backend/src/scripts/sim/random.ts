// Seeded pseudo-random helpers so every simulator run produces identical data.

// mulberry32: tiny, fast, good enough statistical quality for simulation
export const createRng = (seed: number) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const chance = (p: number) => next() < p;
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];

  const weighted = <T>(items: readonly T[], weight: (item: T) => number) => {
    const total = items.reduce((s, i) => s + weight(i), 0);
    let r = next() * total;
    for (const item of items) {
      r -= weight(item);
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  };

  // Knuth's method; fine for the small lambdas used here
  const poisson = (lambda: number) => {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= next();
    } while (p > l);
    return k - 1;
  };

  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(next(), 1e-12);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const exponential = (mean: number) => -mean * Math.log(Math.max(next(), 1e-12));

  const hex = (length: number) => {
    let s = "";
    while (s.length < length) s += Math.floor(next() * 16).toString(16);
    return s;
  };

  return { next, int, chance, pick, weighted, poisson, normal, exponential, hex };
};

export type Rng = ReturnType<typeof createRng>;
