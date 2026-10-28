-- Q: When customers buy again, how long do they take?
-- Days between consecutive non-cancelled orders per customer (LAG over each customer's
-- order history), summarised for all repeat orders and for the first -> second order.
WITH ordered AS (
    SELECT
        customer_id,
        order_ts_ist,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_ts_ist, order_id) AS order_number,
        LAG(order_ts_ist) OVER (PARTITION BY customer_id ORDER BY order_ts_ist, order_id) AS previous_order_ts
    FROM fact_orders
    WHERE NOT is_cancelled
),
gaps AS (
    SELECT
        customer_id,
        order_number,
        date_diff('day', previous_order_ts::DATE, order_ts_ist::DATE) AS gap_days
    FROM ordered
    WHERE previous_order_ts IS NOT NULL
),
scoped AS (
    SELECT 'all repeat orders' AS scope, gap_days FROM gaps
    UNION ALL
    SELECT 'first to second order', gap_days FROM gaps WHERE order_number = 2
)
SELECT
    scope,
    COUNT(*)                                        AS repeat_orders,
    ROUND(AVG(gap_days), 1)                         AS avg_days,
    quantile_cont(gap_days, 0.25)                   AS p25_days,
    quantile_cont(gap_days, 0.50)                   AS median_days,
    quantile_cont(gap_days, 0.75)                   AS p75_days,
    ROUND(AVG((gap_days <= 30)::INT), 4)            AS share_within_30d,
    ROUND(AVG((gap_days <= 60)::INT), 4)            AS share_within_60d,
    ROUND(AVG((gap_days <= 90)::INT), 4)            AS share_within_90d
FROM scoped
GROUP BY scope
ORDER BY scope;
