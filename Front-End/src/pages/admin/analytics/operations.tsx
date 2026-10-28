import { usePaymentsQuery } from "../../../redux/api/analyticsAPI";
import { BarsChart, COLORS } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, DateRangeBar, Loading, Panel, days, inr, inrCompact, num, pct, useRange } from "../../../components/admin/analytics/ui";

const METHOD_LABEL = { COD: "Cash on Delivery", ONLINE: "Prepaid (online)" } as const;

const Operations = () => {
  const rangeState = useRange(90);
  const { range } = rangeState;
  const { data, error } = usePaymentsQuery(range!, { skip: !range });

  const cod = data?.byMethod.find((m) => m.method === "COD");
  const online = data?.byMethod.find((m) => m.method === "ONLINE");

  return (
    <AnalyticsLayout title="Payments & operations" subtitle="COD vs prepaid, cancellations, RTO and delivery speed" actions={<DateRangeBar state={rangeState} />}>
      {!data || !cod || !online ? (
        <Loading error={error} />
      ) : (
        <div className="panel-grid">
          <Panel title="Payment mix">
            <BarsChart
              height={200}
              labels={data.byMethod.map((m) => METHOD_LABEL[m.method])}
              series={[{ label: "Share of orders", data: data.byMethod.map((m) => m.orderShare), color: COLORS.primary }]}
              format={(v) => pct(v, 0)}
            />
            <p className="callout">
              COD orders are lost (cancelled, RTO or returned) {(cod.lostOrderRate / Math.max(online.lostOrderRate, 1e-9)).toFixed(1)}× as often as prepaid:{" "}
              {pct(cod.lostOrderRate)} vs {pct(online.lostOrderRate)}, worth {inrCompact(cod.lostGmv)} of COD GMV.
            </p>
          </Panel>

          <Panel title="Outcome rates by payment method">
            <BarsChart
              height={240}
              labels={["Cancelled", "RTO", "Returned"]}
              series={data.byMethod.map((m) => ({
                label: METHOD_LABEL[m.method],
                data: [m.cancellationRate, m.rtoRate, m.returnRate],
                color: m.method === "COD" ? COLORS.secondary : COLORS.primary,
              }))}
              format={(v) => pct(v, 1)}
            />
          </Panel>

          <Panel title="Method comparison" wide>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Orders</th>
                  <th className="num">GMV</th>
                  <th className="num">AOV</th>
                  <th className="num">Cancelled</th>
                  <th className="num">RTO</th>
                  <th className="num">Returned</th>
                  <th className="num">Hours to ship</th>
                  <th className="num">Days to deliver</th>
                </tr>
              </thead>
              <tbody>
                {data.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td>
                      <strong>{METHOD_LABEL[m.method]}</strong>
                    </td>
                    <td className="num">{num(m.orders)}</td>
                    <td className="num">{inrCompact(m.gmv)}</td>
                    <td className="num">{inr(m.aov)}</td>
                    <td className="num">{pct(m.cancellationRate)}</td>
                    <td className="num">{pct(m.rtoRate)}</td>
                    <td className="num">{pct(m.returnRate)}</td>
                    <td className="num">{m.avgHoursToShip?.toFixed(1) ?? "–"}</td>
                    <td className="num">{days(m.avgDaysToDeliver)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Order status timeline" note="Average time from order placed to each status, for orders that reached it.">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="num">Orders</th>
                  <th className="num">Avg. days after order</th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.map((t) => (
                  <tr key={t.status}>
                    <td>{t.status}</td>
                    <td className="num">{num(t.orders)}</td>
                    <td className="num">{days(t.avgDaysFromOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel
            title="Where COD RTO costs the most"
            note={`Estimated at ₹${data.rtoCostAssumption} per RTO (forward + reverse logistics; an assumption).`}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th className="num">COD share</th>
                  <th className="num">COD RTO</th>
                  <th className="num">Prepaid RTO</th>
                  <th className="num">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {data.cities.slice(0, 10).map((c) => (
                  <tr key={c.city}>
                    <td>
                      {c.city} <small className="muted">{c.state}</small>
                    </td>
                    <td className="num">{pct(c.codShare, 0)}</td>
                    <td className="num">{pct(c.codRtoRate)}</td>
                    <td className="num">{pct(c.prepaidRtoRate)}</td>
                    <td className="num">{inr(c.estCodRtoCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </AnalyticsLayout>
  );
};

export default Operations;
