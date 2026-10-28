import { useMemo, useState } from "react";
import { useProductsQuery } from "../../../redux/api/analyticsAPI";
import { BarsChart, COLORS, TrendChart } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, DateRangeBar, Loading, Panel, inrCompact, num, pct, useRange } from "../../../components/admin/analytics/ui";
import { ProductRow } from "../../../types/analytics";

type SortKey = "rank" | "views" | "addToCartRate" | "viewToOrderRate" | "returnRate" | "daysOfCover";

const AnalyticsProducts = () => {
  const rangeState = useRange(90);
  const { range } = rangeState;
  const { data, error, isFetching } = useProductsQuery(range!, { skip: !range });
  const [sort, setSort] = useState<SortKey>("rank");
  const [abc, setAbc] = useState("");

  const rows = useMemo(() => {
    const list = (data?.products ?? []).filter((p) => !abc || p.abcClass === abc);
    const value = (p: ProductRow) => (sort === "daysOfCover" ? p.daysOfCover ?? Infinity : p[sort]);
    return [...list].sort((a, b) => (sort === "rank" || sort === "daysOfCover" ? value(a) - value(b) : value(b) - value(a)));
  }, [data, sort, abc]);

  const alerts = data?.products.filter((p) => p.alert) ?? [];
  const th = (key: SortKey, label: string) => (
    <th className={`num sortable ${sort === key ? "is-sorted" : ""}`} onClick={() => setSort(key)}>
      {label}
    </th>
  );

  return (
    <AnalyticsLayout title="Product performance" subtitle="Engagement, conversion, Pareto/ABC and stock cover" actions={<DateRangeBar state={rangeState} />}>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className={`panel-grid ${isFetching ? "is-fetching" : ""}`}>
          <Panel title="Pareto curve" note="Cumulative share of revenue by product rank. A = first 80% of revenue, B = next 15%, C = rest.">
            <TrendChart
              height={220}
              labels={data.products.map((p) => String(p.rank))}
              series={[
                { label: "Cumulative revenue share", data: data.products.map((p) => p.cumulativeShare), color: COLORS.primary },
                { label: "80% line", data: data.products.map(() => 0.8), color: COLORS.secondary, dashed: true },
              ]}
              yFormat={(v) => pct(v, 0)}
            />
          </Panel>
          <Panel title="ABC classes">
            <BarsChart
              height={220}
              labels={data.classes.map((c) => `${c.abcClass} (${c.products} SKUs)`)}
              series={[{ label: "Revenue share", data: data.classes.map((c) => c.revenueShare), color: COLORS.primary }]}
              format={(v) => pct(v, 0)}
            />
            <p className="muted small">
              {data.classes[0]?.products} of {data.products.length} SKUs ({pct((data.classes[0]?.products ?? 0) / data.products.length, 0)}) earn{" "}
              {pct(data.classes[0]?.revenueShare ?? 0, 0)} of revenue ({inrCompact(data.totalRevenue)} total).
            </p>
          </Panel>

          {alerts.length > 0 && (
            <Panel title={`Stock alerts (${alerts.length})`} wide note="Low stock = under 10 units or under 14 days of cover at the last 30 days' sales rate.">
              <ul className="alert-list">
                {alerts.map((p) => (
                  <li key={p.productId}>
                    <span className={`abc abc--${p.abcClass}`}>{p.abcClass}</span>
                    <strong>{p.name}</strong>
                    <span>{p.alert}</span>
                    <span className="muted">{num(p.stock)} in stock</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="All products" wide note="Click a column to sort. Rates use product views as the denominator.">
            <div className="filters">
              <select value={abc} onChange={(e) => setAbc(e.target.value)} aria-label="ABC class">
                <option value="">All classes</option>
                <option value="A">Class A</option>
                <option value="B">Class B</option>
                <option value="C">Class C</option>
              </select>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {th("rank", "#")}
                    <th>Product</th>
                    <th>ABC</th>
                    {th("views", "Views")}
                    {th("addToCartRate", "Add-to-cart")}
                    {th("viewToOrderRate", "View → order")}
                    <th className="num">Units</th>
                    <th className="num">Revenue</th>
                    {th("returnRate", "Return/RTO")}
                    <th className="num">Stock</th>
                    {th("daysOfCover", "Days cover")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.productId} className={p.alert ? "has-alert" : ""}>
                      <td className="num">{p.rank}</td>
                      <td>
                        {p.name}
                        <small className="muted"> · {p.category}</small>
                      </td>
                      <td>
                        <span className={`abc abc--${p.abcClass}`}>{p.abcClass}</span>
                      </td>
                      <td className="num">{num(p.views)}</td>
                      <td className="num">{pct(p.addToCartRate)}</td>
                      <td className="num">{pct(p.viewToOrderRate, 2)}</td>
                      <td className="num">{num(p.units)}</td>
                      <td className="num">{inrCompact(p.revenue)}</td>
                      <td className="num">{pct(p.returnRate)}</td>
                      <td className="num">{num(p.stock)}</td>
                      <td className="num">{p.daysOfCover === null ? "–" : Math.round(p.daysOfCover)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </AnalyticsLayout>
  );
};

export default AnalyticsProducts;
