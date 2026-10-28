import { ReactNode, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMetaQuery } from "../../../redux/api/analyticsAPI";
import { Range } from "../../../types/analytics";
import AdminSidebar from "../AdminSidebar";

// ---------- formatting (₹, Indian digit grouping, IST dates from the API) ----------

const inrFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inr = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `₹${inrFormat.format(n)}`);
export const inrCompact = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : inr(n);
export const num = (n: number | null | undefined) => (n === null || n === undefined ? "–" : inrFormat.format(n));
export const pct = (x: number | null | undefined, dp = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? "–" : `${(x * 100).toFixed(dp)}%`;
export const days = (n: number | null | undefined, dp = 1) => (n === null || n === undefined ? "–" : `${n.toFixed(dp)} d`);

// ---------- date range in the URL (?from=&to=) so every page shares it ----------

const shift = (iso: string, deltaDays: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + deltaDays * 86400000).toISOString().slice(0, 10);

export const PRESETS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "12M", days: 365 },
];

export const useRange = (defaultDays = 30) => {
  const { data: meta } = useMetaQuery();
  const [params, setParams] = useSearchParams();
  // A fresh store has no data yet: anchor ranges on today (IST) so pages still load
  const maxDate = meta ? meta.maxDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null;
  const range = useMemo<Range | null>(() => {
    if (!meta || !maxDate) return null;
    const to = params.get("to") ?? maxDate;
    const from = params.get("from") ?? shift(to, -(defaultDays - 1));
    return { from: meta.minDate && from < meta.minDate ? meta.minDate : from, to };
  }, [meta, maxDate, params, defaultDays]);

  const setRange = (r: Range) => {
    const next = new URLSearchParams(params);
    next.set("from", r.from);
    next.set("to", r.to);
    setParams(next, { replace: true });
  };
  const setPreset = (presetDays: number) => {
    if (!maxDate) return;
    setRange({ from: shift(maxDate, -(presetDays - 1)), to: maxDate });
  };
  return { meta, maxDate, range, setRange, setPreset };
};

export const DateRangeBar = ({ state }: { state: ReturnType<typeof useRange> }) => {
  const { meta, maxDate, range, setRange, setPreset } = state;
  if (!range || !meta) return null;
  const lengthDays = (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1;
  return (
    <div className="range-bar">
      <div className="range-bar__presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={range.to === maxDate && lengthDays === p.days ? "is-active" : ""}
            onClick={() => setPreset(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label>
        From
        <input
          type="date"
          value={range.from}
          min={meta.minDate ?? undefined}
          max={range.to}
          onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={range.to}
          min={range.from}
          max={maxDate ?? undefined}
          onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })}
        />
      </label>
      <span className="range-bar__note">IST · ₹</span>
    </div>
  );
};

// ---------- layout ----------

export const AnalyticsLayout = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const { data: meta } = useMetaQuery();
  return (
    <div className="admin-container">
      <AdminSidebar />
      <main className="analytics">
        <header className="analytics__head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {meta?.simulated && (
            <span className="sim-badge" title={`Database: ${meta.database}`}>
              Simulated data
            </span>
          )}
        </header>
        {actions}
        {children}
      </main>
    </div>
  );
};

export const Panel = ({ title, note, children, wide }: { title: string; note?: ReactNode; children: ReactNode; wide?: boolean }) => (
  <section className={`panel ${wide ? "panel--wide" : ""}`}>
    <header>
      <h2>{title}</h2>
      {note && <p className="panel__note">{note}</p>}
    </header>
    {children}
  </section>
);

export const KpiCard = ({
  label,
  value,
  change,
  invert,
  hint,
}: {
  label: string;
  value: string;
  change: number | null;
  /** true when a decrease is good (e.g. cart abandonment) */
  invert?: boolean;
  hint?: string;
}) => {
  const good = change === null ? null : invert ? change < 0 : change > 0;
  return (
    <div className="kpi" title={hint}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      <span className={`kpi__change ${good === null ? "" : good ? "up" : "down"}`}>
        {change === null ? "no prior data" : `${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change))} vs prev.`}
      </span>
    </div>
  );
};

export const Loading = ({ error }: { error?: unknown }) => (
  <div className="analytics__state">{error ? "Couldn't load this report. Check you're logged in as an admin." : "Crunching numbers…"}</div>
);
