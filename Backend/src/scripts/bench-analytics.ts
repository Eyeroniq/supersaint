// Measures analytics endpoint latency over HTTP (cache bypassed with ?nocache=1).
// Start the API on the simulated data first (npm run start:sim), then: npm run bench
import { config } from "dotenv";

config({ path: "./.env" });

const API = `http://localhost:${process.env.PORT || 4000}/api/v1`;
const RUNS = 3;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const main = async () => {
  const login = await fetch(`${API}/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  }).then((r) => r.json() as Promise<{ token?: string; message?: string }>);
  if (!login.token) throw new Error(`Admin login failed: ${login.message}`);
  const headers = { Authorization: `Bearer ${login.token}` };

  const meta = await fetch(`${API}/analytics/meta?nocache=1`, { headers }).then(
    (r) => r.json() as Promise<{ data: { database: string; maxDate: string } }>
  );
  const to = meta.data.maxDate;
  const minus = (days: number) =>
    new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const ranges = { "30 days": `from=${minus(30)}&to=${to}`, "90 days": `from=${minus(90)}&to=${to}`, "365 days": "" };

  const endpoints = ["kpis", "funnel", "products", "payments", "search", "coupons"];
  const once = ["customers", "experiments/free_shipping_threshold", "experiments/coupon_offer"];

  console.log(`Database: ${meta.data.database}; median of ${RUNS} uncached runs (ms)\n`);
  const table: Record<string, Record<string, number>> = {};
  for (const ep of endpoints) {
    table[ep] = {};
    for (const [label, q] of Object.entries(ranges)) {
      const times: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const started = performance.now();
        const res = await fetch(`${API}/analytics/${ep}?${q}&nocache=1`, { headers });
        await res.arrayBuffer();
        if (!res.ok) throw new Error(`${ep} ${res.status}`);
        times.push(performance.now() - started);
      }
      table[ep][label] = Math.round(median(times));
    }
  }
  for (const ep of once) {
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      await fetch(`${API}/analytics/${ep}?nocache=1`, { headers }).then((r) => r.arrayBuffer());
      times.push(performance.now() - started);
    }
    table[ep] = { "all data": Math.round(median(times)) };
  }
  console.table(table);

  // Cached response time for the dashboard's default view
  await fetch(`${API}/analytics/kpis?${ranges["30 days"]}`, { headers });
  const started = performance.now();
  await fetch(`${API}/analytics/kpis?${ranges["30 days"]}`, { headers }).then((r) => r.arrayBuffer());
  console.log(`\nkpis (30 days), cached: ${Math.round(performance.now() - started)} ms`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
