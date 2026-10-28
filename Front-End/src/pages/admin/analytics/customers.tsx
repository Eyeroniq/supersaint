import { useCustomersQuery } from "../../../redux/api/analyticsAPI";
import { BarsChart, COLORS } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, Loading, Panel, inrCompact, num, pct } from "../../../components/admin/analytics/ui";

// Blue scale for retention cells; month 0 is always 100% so it gets the darkest shade
const heat = (rate: number) => {
  const t = Math.min(rate / 0.15, 1);
  return `rgba(31, 58, 147, ${0.08 + t * 0.85})`;
};

const AnalyticsCustomers = () => {
  const { data, error } = useCustomersQuery();
  if (!data)
    return (
      <AnalyticsLayout title="Customers">
        <Loading error={error} />
      </AnalyticsLayout>
    );
  const { cohorts, rfm, repeatInterval } = data;
  const top = rfm.segments[0];

  return (
    <AnalyticsLayout title="Customers" subtitle="Cohort retention, RFM segments and repeat-purchase timing (all data)">
      <div className="panel-grid">
        <Panel
          title="Cohort retention"
          wide
          note="Share of each first-order month's customers who ordered again N months later. Blank = not enough time has passed yet."
        >
          <div className="heatmap-wrap">
            <table className="heatmap">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Customers</th>
                  {[1, 2, 3, 4, 5, 6].map((m) => (
                    <th key={m}>M{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.cohorts.map((c) => (
                  <tr key={c.cohort}>
                    <th>{c.cohort}</th>
                    <td className="num">{num(c.size)}</td>
                    {c.retention.slice(1).map((cell, i) =>
                      cell ? (
                        <td key={i} style={{ background: heat(cell.rate), color: cell.rate > 0.09 ? "#fff" : "#111" }} title={`${cell.customers} customers`}>
                          {pct(cell.rate)}
                        </td>
                      ) : (
                        <td key={i} className="empty" />
                      )
                    )}
                  </tr>
                ))}
                <tr className="heatmap__avg">
                  <th>Weighted avg.</th>
                  <td />
                  {cohorts.average.map((a) => (
                    <td key={a.month}>{pct(a.rate)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="RFM segments"
          wide
          note={`${num(rfm.totalCustomers)} customers scored as of ${rfm.referenceDate}. R and M are quintiles (NTILE 5); F is binned 1 / 2 / 3 / 4–5 / 6+ orders.`}
        >
          {top && (
            <p className="callout">
              <strong>{top.segment}</strong> bring in {pct(top.revenueShare)} of revenue from {pct(top.customerShare)} of customers.
            </p>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th className="num">Customers</th>
                <th className="num">Share</th>
                <th className="num">Revenue</th>
                <th className="num">Revenue share</th>
                <th className="num">Avg. orders</th>
                <th className="num">Avg. recency</th>
                <th>Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {rfm.segments.map((s) => (
                <tr key={s.segment}>
                  <td>
                    <strong>{s.segment}</strong>
                  </td>
                  <td className="num">{num(s.customers)}</td>
                  <td className="num">{pct(s.customerShare)}</td>
                  <td className="num">{inrCompact(s.revenue)}</td>
                  <td className="num">
                    <span className="share-bar" style={{ width: `${s.revenueShare * 100}%` }} />
                    {pct(s.revenueShare)}
                  </td>
                  <td className="num">{s.avgOrders.toFixed(2)}</td>
                  <td className="num">{Math.round(s.avgRecencyDays)} d</td>
                  <td className="action">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="R × F grid (customers)" note="Rows: recency score (5 = most recent). Columns: frequency score.">
          <table className="heatmap heatmap--grid">
            <thead>
              <tr>
                <th>R \ F</th>
                {[1, 2, 3, 4, 5].map((f) => (
                  <th key={f}>F{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfm.grid.map((row) => {
                const max = Math.max(...rfm.grid.flatMap((r) => r.cells));
                return (
                  <tr key={row.r}>
                    <th>R{row.r}</th>
                    {row.cells.map((n, i) => (
                      <td key={i} style={{ background: `rgba(226, 132, 58, ${n ? 0.12 + (0.8 * n) / max : 0.03})` }}>
                        {num(n)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Time to repurchase" note="Days between consecutive non-cancelled orders.">
          <dl className="stat-list">
            <div>
              <dt>Median, first → second order</dt>
              <dd>{repeatInterval.firstToSecond.median ?? "–"} days</dd>
            </div>
            <div>
              <dt>Median, any repeat order</dt>
              <dd>{repeatInterval.allRepeatOrders.median ?? "–"} days</dd>
            </div>
            <div>
              <dt>Middle 50%</dt>
              <dd>
                {repeatInterval.allRepeatOrders.p25}–{repeatInterval.allRepeatOrders.p75} days
              </dd>
            </div>
            <div>
              <dt>Repeat orders analysed</dt>
              <dd>{num(repeatInterval.allRepeatOrders.repeatOrders)}</dd>
            </div>
          </dl>
          <BarsChart
            height={170}
            labels={["≤ 30 days", "≤ 60 days", "≤ 90 days"]}
            series={[
              {
                label: "Share of repeat orders",
                data: [repeatInterval.allRepeatOrders.within30, repeatInterval.allRepeatOrders.within60, repeatInterval.allRepeatOrders.within90],
                color: COLORS.primary,
              },
            ]}
            format={(v) => pct(v, 0)}
          />
        </Panel>
      </div>
    </AnalyticsLayout>
  );
};

export default AnalyticsCustomers;
