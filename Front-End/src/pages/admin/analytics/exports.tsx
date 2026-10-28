import { useState } from "react";
import toast from "react-hot-toast";
import { authHeaders } from "../../../redux/api/baseQuery";
import { AnalyticsLayout, Panel } from "../../../components/admin/analytics/ui";

const TABLES = [
  { name: "kpi_daily", grain: "One row per IST day", use: "Trend lines, KPI cards, MoM %" },
  { name: "fact_orders", grain: "One row per order", use: "GMV, AOV, COD vs prepaid, cancellations, RTO, delivery time" },
  { name: "fact_order_items", grain: "One row per order line", use: "Product revenue, Pareto / ABC" },
  { name: "fact_events", grain: "One row per tracked event (large)", use: "Funnel, search, experiments" },
  { name: "dim_customers", grain: "One row per customer (hashed contact)", use: "Cohorts, repeat rate, city" },
  { name: "dim_products", grain: "One row per SKU", use: "Category, price, stock" },
  { name: "dim_date", grain: "One row per IST day", use: "Date slicers, weekday/weekend, sale days" },
];

const Exports = () => {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (table: string) => {
    setBusy(table);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER}/api/v1/analytics/export/${table}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Couldn't export ${table}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnalyticsLayout title="Exports" subtitle="Power BI / Excel-ready CSVs: ISO dates, IST timestamps, ₹ amounts, no personal data">
      <Panel title="Star-schema tables" wide note="Relationships and DAX measures are documented in docs/powerbi.md.">
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Grain</th>
              <th>Use it for</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TABLES.map((t) => (
              <tr key={t.name}>
                <td>
                  <code>{t.name}.csv</code>
                </td>
                <td>{t.grain}</td>
                <td>{t.use}</td>
                <td className="num">
                  <button className="btn-small" disabled={busy !== null} onClick={() => download(t.name)}>
                    {busy === t.name ? "Preparing…" : "Download"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Emails and phone numbers are exported only as salted SHA-256 hashes; names and street addresses are never exported.
        </p>
      </Panel>
    </AnalyticsLayout>
  );
};

export default Exports;
