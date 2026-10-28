import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useExperimentResultsQuery, useExperimentsQuery, useSetExperimentStatusMutation } from "../../../redux/api/analyticsAPI";
import { COLORS, TrendChart } from "../../../components/admin/analytics/charts";
import { AnalyticsLayout, Loading, Panel, inr, num, pct } from "../../../components/admin/analytics/ui";
import { MeanTest, ProportionTest } from "../../../types/analytics";
import { requiredSampleSize } from "../../../utils/sample-size";

const VERDICT_CLASS = { ship: "good", dont_ship: "bad", keep_running: "warn", investigate: "bad" } as const;

const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const pValue = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));
const signed = (x: number, fmt: (v: number) => string) => `${x >= 0 ? "+" : "−"}${fmt(Math.abs(x))}`;

const TestRow = ({ name, test, fmt, primary }: { name: string; test: ProportionTest | MeanTest; fmt: (v: number) => string; primary?: boolean }) => {
  const control = "controlRate" in test ? test.controlRate : test.controlMean;
  const treatment = "treatmentRate" in test ? test.treatmentRate : test.treatmentMean;
  const significant = test.pValue < 0.05;
  return (
    <tr className={primary ? "is-primary" : ""}>
      <td>
        {name}
        {primary && <small className="muted"> · primary</small>}
      </td>
      <td className="num">{fmt(control)}</td>
      <td className="num">{fmt(treatment)}</td>
      <td className="num">{signed(test.absoluteLift, fmt)}</td>
      <td className="num">{signed(test.relativeLift, (v) => pct(v))}</td>
      <td className="num">
        [{signed(test.ci95[0], fmt)}, {signed(test.ci95[1], fmt)}]
      </td>
      <td className={`num ${significant ? "sig" : ""}`}>{pValue(test.pValue)}</td>
    </tr>
  );
};

const Experiments = () => {
  const { data: list, error } = useExperimentsQuery();
  const [selected, setSelected] = useState("free_shipping_threshold");
  const [mde, setMde] = useState(0.05);
  const { data, isFetching } = useExperimentResultsQuery({ key: selected, mde });
  const [setStatus, { isLoading: toggling }] = useSetExperimentStatusMutation();

  // Calculator inputs default to the selected experiment's control conversion
  const [baseline, setBaseline] = useState(0.38);
  const [calcMde, setCalcMde] = useState(0.05);
  useEffect(() => {
    const control = data?.variants.find((v) => v.variant === "control");
    if (control?.conversionRate) setBaseline(Number(control.conversionRate.toFixed(3)));
  }, [data]);
  const calculated = requiredSampleSize(baseline, calcMde);

  const toggle = async (key: string, running: boolean) => {
    const res = await setStatus({ key, status: running ? "stopped" : "running" });
    if ("data" in res && res.data) toast.success(res.data.message);
    else toast.error("Couldn't change the experiment");
  };

  return (
    <AnalyticsLayout title="A/B tests" subtitle="Deterministic 50/50 assignment by visitor id; exposure logged when the cart is shown">
      {!list ? (
        <Loading error={error} />
      ) : (
        <div className="panel-grid">
          <Panel title="Experiments" wide>
            <div className="experiment-list">
              {list.map((e) => (
                <div key={e.key} className={`experiment-card ${selected === e.key ? "is-selected" : ""}`} onClick={() => setSelected(e.key)}>
                  <div>
                    <strong>{e.name}</strong>
                    <p className="muted small">{e.hypothesis}</p>
                    <p className="small">
                      Control: {e.variants.control.label} · Treatment: {e.variants.treatment.label}
                    </p>
                  </div>
                  <div className="experiment-card__side">
                    <span className={`pill ${e.status === "running" ? "pill--live" : ""}`}>{e.status}</span>
                    <button
                      className="btn-small"
                      disabled={toggling}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggle(e.key, e.status === "running");
                      }}
                    >
                      {e.status === "running" ? "Stop" : "Start"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="muted small">
              Stopped experiments show everyone the control experience (free shipping over ₹999, no cart offer).
            </p>
          </Panel>

          {!data ? (
            <Loading />
          ) : (
            <>
              <Panel title="Verdict" wide>
                <div className={`verdict verdict--${VERDICT_CLASS[data.verdict.decision]} ${isFetching ? "is-fetching" : ""}`}>
                  <strong>{data.verdict.headline}</strong>
                  <ul>
                    {data.verdict.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                    <li>
                      Guardrail ({data.experiment.guardrail.toLowerCase()}): {pct(data.tests.cancellation.controlRate)} →{" "}
                      {pct(data.tests.cancellation.treatmentRate)}, p = {pValue(data.tests.cancellation.pValue)}.
                    </li>
                    <li>
                      Sample-ratio check: {num(data.variants[0].exposedSessions)} vs {num(data.variants[1].exposedSessions)} sessions, χ² p ={" "}
                      {pValue(data.srm.pValue)} {data.srm.mismatch ? "— MISMATCH" : "(OK)"}.
                    </li>
                  </ul>
                  {data.experiment.startedAt && (
                    <p className="muted small">
                      Ran {istDay(data.experiment.startedAt)} → {data.experiment.stoppedAt ? istDay(data.experiment.stoppedAt) : "now"} (IST)
                      {data.experiment.simulated && " · simulated data"}
                    </p>
                  )}
                </div>
              </Panel>

              <Panel title="Results by variant" wide note="95% confidence intervals are for the difference (treatment − control). Conversion: two-proportion z-test. AOV and revenue per session: Welch's t-test.">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th className="num">Exposed sessions</th>
                        <th className="num">Converted</th>
                        <th className="num">Conversion</th>
                        <th className="num">Orders</th>
                        <th className="num">AOV</th>
                        <th className="num">Revenue / session</th>
                        <th className="num">Cancelled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.variants.map((v) => (
                        <tr key={v.variant}>
                          <td>
                            <strong>{v.variant}</strong> <small className="muted">{v.label}</small>
                          </td>
                          <td className="num">{num(v.exposedSessions)}</td>
                          <td className="num">{num(v.convertedSessions)}</td>
                          <td className="num">{pct(v.conversionRate, 2)}</td>
                          <td className="num">{num(v.orders)}</td>
                          <td className="num">{inr(v.aov)}</td>
                          <td className="num">{inr(v.revenuePerSession)}</td>
                          <td className="num">{pct(v.cancellationRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th className="num">Control</th>
                        <th className="num">Treatment</th>
                        <th className="num">Abs. lift</th>
                        <th className="num">Rel. lift</th>
                        <th className="num">95% CI</th>
                        <th className="num">p-value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <TestRow name="Conversion rate" test={data.tests.conversion} fmt={(v) => pct(v, 2)} primary />
                      <TestRow name="AOV" test={data.tests.aov} fmt={inr} />
                      <TestRow name="Revenue per session" test={data.tests.revenuePerSession} fmt={inr} />
                      <TestRow name="Cancellation rate (guardrail)" test={data.tests.cancellation} fmt={(v) => pct(v, 2)} />
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Cumulative conversion by day" note="If the lines are still crossing, the result isn't stable yet.">
                <TrendChart
                  height={230}
                  labels={data.daily.days.map((d) => d.slice(5))}
                  series={[
                    { label: "Control", data: data.daily.control, color: COLORS.control },
                    { label: "Treatment", data: data.daily.treatment, color: COLORS.treatment },
                  ]}
                  yFormat={(v) => pct(v, 0)}
                />
              </Panel>

              <Panel title="Power & sample size">
                <label className="field-inline">
                  Minimum detectable effect (relative) for the verdict
                  <select value={mde} onChange={(e) => setMde(Number(e.target.value))}>
                    {[0.02, 0.05, 0.1, 0.15].map((m) => (
                      <option key={m} value={m}>
                        {pct(m, 0)}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Needs <strong>{num(data.power.requiredPerArm)}</strong> sessions per arm at α = 0.05, power = 80%; has{" "}
                  <strong>{num(data.power.samplePerArm)}</strong> ({pct(data.power.samplePerArm / Math.max(data.power.requiredPerArm, 1), 0)}).
                </p>
                <hr />
                <h3>Calculator</h3>
                <div className="calc">
                  <label>
                    Baseline conversion
                    <input type="number" step={0.001} min={0.001} max={0.99} value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} />
                  </label>
                  <label>
                    Relative MDE
                    <input type="number" step={0.01} min={0.01} max={1} value={calcMde} onChange={(e) => setCalcMde(Number(e.target.value))} />
                  </label>
                  <output>{calculated ? `${num(calculated)} per arm` : "–"}</output>
                </div>
              </Panel>
            </>
          )}
        </div>
      )}
    </AnalyticsLayout>
  );
};

export default Experiments;
