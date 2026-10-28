import { useCouponsQuery, useSearchQuery } from "../../../redux/api/analyticsAPI";
import { BarsChart, COLORS } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, DateRangeBar, Loading, Panel, inr, inrCompact, num, pct, useRange } from "../../../components/admin/analytics/ui";

const Marketing = () => {
  const rangeState = useRange(90);
  const { range } = rangeState;
  const { data: search, error } = useSearchQuery(range!, { skip: !range });
  const { data: coupons } = useCouponsQuery(range!, { skip: !range });

  return (
    <AnalyticsLayout title="Search & coupons" subtitle="What shoppers look for, what we can't show them, and what discounts return" actions={<DateRangeBar state={rangeState} />}>
      {!search ? (
        <Loading error={error} />
      ) : (
        <div className="panel-grid">
          <Panel title="Search → purchase" note={`${num(search.totalSearches)} searches; ${pct(search.zeroResultRate)} returned nothing.`}>
            <BarsChart
              height={220}
              labels={search.conversionBySearch.map((b) => b.behaviour)}
              series={[{ label: "Session conversion", data: search.conversionBySearch.map((b) => b.conversionRate), color: COLORS.primary }]}
              format={(v) => pct(v, 1)}
            />
            <table className="data-table compact">
              <tbody>
                {search.conversionBySearch.map((b) => (
                  <tr key={b.behaviour}>
                    <td>{b.behaviour}</td>
                    <td className="num">{num(b.sessions)} sessions</td>
                    <td className="num">{pct(b.sessionShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Zero-result searches" note="Demand we can't serve today: candidates for new products or search synonyms.">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th className="num">Searches</th>
                  <th className="num">Share of all searches</th>
                </tr>
              </thead>
              <tbody>
                {search.zeroResultTerms.map((t) => (
                  <tr key={t.term}>
                    <td>“{t.term}”</td>
                    <td className="num">{num(t.zeroResultSearches)}</td>
                    <td className="num">{pct(t.shareOfSearches)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Top searches" wide>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th className="num">Searches</th>
                  <th className="num">Sessions</th>
                  <th className="num">Search → purchase</th>
                </tr>
              </thead>
              <tbody>
                {search.topSearches.map((t) => (
                  <tr key={t.term}>
                    <td>“{t.term}”</td>
                    <td className="num">{num(t.searches)}</td>
                    <td className="num">{num(t.sessions)}</td>
                    <td className="num">{pct(t.searchToPurchaseRate, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {coupons && (
            <Panel
              title="Coupon performance"
              wide
              note={`Coupons used on ${pct(coupons.couponOrderShare)} of orders. Incremental AOV compares with orders without a coupon (${inr(coupons.aovWithoutCoupon)}); it is observational, not causal.`}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th className="num">Orders</th>
                    <th className="num">Applied → ordered</th>
                    <th className="num">Discount cost</th>
                    <th className="num">GMV</th>
                    <th className="num">AOV</th>
                    <th className="num">Incremental AOV</th>
                    <th className="num">GMV per ₹1 discount</th>
                    <th className="num">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.coupons.map((c) => (
                    <tr key={c.code}>
                      <td>
                        <strong>{c.code}</strong>
                      </td>
                      <td className="num">{num(c.orders)}</td>
                      <td className="num">{pct(c.redemptionRate)}</td>
                      <td className="num">{inrCompact(c.discountCost)}</td>
                      <td className="num">{inrCompact(c.gmv)}</td>
                      <td className="num">{inr(c.aov)}</td>
                      <td className={`num ${c.incrementalAov >= 0 ? "pos" : "neg"}`}>
                        {c.incrementalAov >= 0 ? "+" : "−"}
                        {inr(Math.abs(c.incrementalAov))}
                      </td>
                      <td className="num">₹{c.gmvPerRupeeDiscount.toFixed(1)}</td>
                      <td className="num">{pct(c.cancellationRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      )}
    </AnalyticsLayout>
  );
};

export default Marketing;
