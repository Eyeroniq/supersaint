import { useState } from "react";
import { useFunnelQuery, useKpiDailyQuery, useKpisQuery } from "../../../redux/api/analyticsAPI";
import { BarsChart, COLORS, TrendChart } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, DateRangeBar, KpiCard, Loading, Panel, inr, inrCompact, num, pct, useRange } from "../../../components/admin/analytics/ui";

const STEP_LABELS: Record<string, string> = {
  product_view: "Viewed product",
  add_to_cart: "Added to cart",
  checkout_started: "Started checkout",
  payment_attempted: "Attempted payment",
  order_placed: "Placed order",
};

const Overview = () => {
  const rangeState = useRange(30);
  const { range, meta } = rangeState;
  const skip = !range;
  const { data: kpis, error: kpiError } = useKpisQuery(range!, { skip });
  const { data: daily } = useKpiDailyQuery(range!, { skip });

  const [category, setCategory] = useState("");
  const [device, setDevice] = useState("");
  const [customerType, setCustomerType] = useState("");
  const { data: funnel, isFetching: funnelLoading } = useFunnelQuery(
    { ...range!, category, device, customerType },
    { skip }
  );

  const c = kpis?.current;
  return (
    <AnalyticsLayout title="Analytics overview" subtitle="Headline KPIs and the purchase funnel" actions={<DateRangeBar state={rangeState} />}>
      {!kpis || !c ? (
        <Loading error={kpiError} />
      ) : (
        <div className="kpi-grid">
          <KpiCard label="GMV" value={inrCompact(c.gmv)} change={kpis.change.gmv} hint="Sum of order totals placed in the period (gross)" />
          <KpiCard label="Orders" value={num(c.orders)} change={kpis.change.orders} />
          <KpiCard label="AOV" value={inr(c.aov)} change={kpis.change.aov} hint="GMV / orders" />
          <KpiCard label="Conversion rate" value={pct(c.conversionRate, 2)} change={kpis.change.conversionRate} hint="Sessions that placed an order / sessions" />
          <KpiCard label="Repeat rate" value={pct(c.repeatRate)} change={kpis.change.repeatRate} hint="Buyers in the period with 2+ lifetime orders" />
          <KpiCard label="Cart abandonment" value={pct(c.cartAbandonmentRate)} change={kpis.change.cartAbandonmentRate} invert hint="1 − ordered sessions / sessions that added to cart" />
        </div>
      )}
      {kpis && (
        <p className="analytics__caption">
          Compared with {kpis.previousRange.from} → {kpis.previousRange.to}. Sessions: {num(c?.sessions)} · Net revenue (after cancellations, RTO, returns): {inrCompact(c?.netRevenue ?? 0)}
        </p>
      )}

      <div className="panel-grid">
        <Panel title="GMV and orders by day" wide>
          {daily ? (
            <TrendChart
              labels={daily.map((d) => d.date.slice(5))}
              series={[
                { label: "GMV (₹)", data: daily.map((d) => d.gmv), color: COLORS.primary },
                { label: "Orders", data: daily.map((d) => d.orders), color: COLORS.secondary, yAxis: "y1" },
              ]}
              yFormat={(v) => inrCompact(v)}
            />
          ) : (
            <Loading />
          )}
        </Panel>

        <Panel title="Conversion rate by day" wide>
          {daily ? (
            <TrendChart
              labels={daily.map((d) => d.date.slice(5))}
              series={[
                { label: "Conversion rate", data: daily.map((d) => d.conversion_rate), color: COLORS.good },
                { label: "Cart abandonment", data: daily.map((d) => d.cart_abandonment_rate), color: COLORS.bad, yAxis: "y1", dashed: true },
              ]}
              yFormat={(v) => pct(v)}
              y1Format={(v) => pct(v, 0)}
            />
          ) : (
            <Loading />
          )}
        </Panel>

        <Panel
          title="Conversion funnel"
          wide
          note="A session reaches a step only if it completed every earlier step."
        >
          <div className="filters">
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {meta?.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Device">
              <option value="">All devices</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
            </select>
            <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} aria-label="Customer type">
              <option value="">New + returning</option>
              <option value="new">New customers</option>
              <option value="returning">Returning customers</option>
            </select>
            {funnelLoading && <span className="muted">Updating…</span>}
          </div>
          {funnel ? (
            <div className="funnel">
              {funnel.steps.map((s, i) => (
                <div className="funnel__row" key={s.step}>
                  <span className="funnel__label">{STEP_LABELS[s.step]}</span>
                  <div className="funnel__bar">
                    <span style={{ width: `${Math.max(s.conversionFromView * 100, 0.6)}%` }} />
                  </div>
                  <span className="funnel__num">{num(s.sessions)}</span>
                  <span className="funnel__pct">{pct(s.conversionFromView, 2)}</span>
                  <span className={`funnel__drop ${i ? "" : "muted"}`}>{i ? `−${pct(s.dropOff)} drop-off` : "of viewers"}</span>
                </div>
              ))}
            </div>
          ) : (
            <Loading />
          )}
          {funnel && funnel.byDevice.length > 1 && !device && (
            <BarsChart
              height={220}
              labels={funnel.steps.map((s) => STEP_LABELS[s.step])}
              series={funnel.byDevice.map((d, i) => ({
                label: d.device,
                data: d.steps.map((s) => s.conversionFromView),
                color: [COLORS.primary, COLORS.secondary, COLORS.control][i % 3],
              }))}
              format={(v) => pct(v, 1)}
            />
          )}
        </Panel>
      </div>
    </AnalyticsLayout>
  );
};

export default Overview;
