-- Q: Did the experiment variant beat control?
-- Unit of analysis: exposed session (first experiment_exposure event per session).
--   conversion            exposed sessions with an order placed at/after first exposure
--   aov                   mean total of those orders; aov_variance feeds Welch's t-test
--   revenue_per_session   order revenue / exposed sessions
--   cancellation_rate     guardrail: cancelled orders / orders
-- z_vs_control is the pooled two-proportion z statistic for conversion. p-values, confidence
-- intervals, SRM and the verdict are computed from these same columns in the API
-- (Backend/src/analytics/stats.ts) because DuckDB has no normal CDF.
WITH exposures AS (
    SELECT experiment, variant, session_id, MIN(event_ts_ist) AS first_exposure
    FROM fact_events
    WHERE event_type = 'experiment_exposure'
    GROUP BY experiment, variant, session_id
),
outcomes AS (
    SELECT e.experiment, e.variant, e.session_id, o.order_id, o.total, o.is_cancelled
    FROM exposures AS e
    LEFT JOIN fact_orders AS o
      ON o.session_id = e.session_id
     AND o.order_ts_ist >= e.first_exposure
),
by_variant AS (
    SELECT
        experiment,
        variant,
        COUNT(DISTINCT session_id)                                     AS exposed_sessions,
        COUNT(DISTINCT session_id) FILTER (WHERE order_id IS NOT NULL) AS converted_sessions,
        COUNT(order_id)                                                AS orders,
        AVG(total)                                                     AS aov,
        var_samp(total)                                                AS aov_variance,
        COALESCE(SUM(total), 0)                                        AS revenue,
        AVG(is_cancelled::INT)                                         AS cancellation_rate
    FROM outcomes
    GROUP BY experiment, variant
),
with_control AS (
    SELECT
        *,
        converted_sessions / exposed_sessions AS conversion_rate,
        MAX(CASE WHEN variant = 'control' THEN converted_sessions END) OVER (PARTITION BY experiment) AS c_x,
        MAX(CASE WHEN variant = 'control' THEN exposed_sessions END)   OVER (PARTITION BY experiment) AS c_n
    FROM by_variant
)
SELECT
    experiment,
    variant,
    exposed_sessions,
    converted_sessions,
    ROUND(conversion_rate, 5)                                  AS conversion_rate,
    orders,
    ROUND(aov, 2)                                              AS aov,
    ROUND(aov_variance, 2)                                     AS aov_variance,
    ROUND(revenue, 2)                                          AS revenue,
    ROUND(revenue / exposed_sessions, 2)                       AS revenue_per_session,
    ROUND(cancellation_rate, 4)                                AS cancellation_rate,
    CASE WHEN variant = 'control' THEN NULL ELSE ROUND(
        (conversion_rate - c_x / c_n)
        / sqrt(((converted_sessions + c_x) / (exposed_sessions + c_n))
               * (1 - (converted_sessions + c_x) / (exposed_sessions + c_n))
               * (1.0 / exposed_sessions + 1.0 / c_n)), 4)
    END                                                        AS z_vs_control
FROM with_control
ORDER BY experiment, variant;
