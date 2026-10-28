-- Q: Are coupons paying for themselves?
-- Per coupon: orders, discount cost, GMV, AOV vs the AOV of orders without a coupon
-- (incremental AOV), GMV per rupee of discount, apply-to-order conversion and cancellations.
-- Caveat: this is observational. Only the A/B test (13_experiment_results.sql) measures
-- whether a coupon *causes* extra orders.
WITH no_coupon AS (
    SELECT AVG(total) AS aov_without_coupon
    FROM fact_orders
    WHERE coupon_code IS NULL AND NOT is_cancelled
),
applies AS (
    SELECT coupon_code, COUNT(DISTINCT session_id) AS apply_sessions
    FROM fact_events
    WHERE event_type = 'coupon_applied'
    GROUP BY coupon_code
),
coupon_orders AS (
    SELECT
        coupon_code,
        COUNT(*)                                 AS orders,
        SUM(discount)                            AS discount_cost,
        SUM(total)                               AS gmv,
        AVG(total)                               AS aov,
        AVG(discount)                            AS avg_discount,
        AVG(is_cancelled::INT)                   AS cancellation_rate
    FROM fact_orders
    WHERE coupon_code IS NOT NULL
    GROUP BY coupon_code
)
SELECT
    c.coupon_code,
    c.orders,
    ROUND(c.orders / (SELECT COUNT(*) FROM fact_orders), 4)     AS share_of_all_orders,
    a.apply_sessions,
    ROUND(c.orders / NULLIF(a.apply_sessions, 0), 4)            AS apply_to_order_rate,
    ROUND(c.discount_cost, 2)                                   AS discount_cost,
    ROUND(c.avg_discount, 2)                                    AS avg_discount,
    ROUND(c.gmv, 2)                                             AS gmv,
    ROUND(c.aov, 2)                                             AS aov,
    ROUND(c.aov - n.aov_without_coupon, 2)                      AS incremental_aov,
    ROUND(c.gmv / NULLIF(c.discount_cost, 0), 2)                AS gmv_per_rupee_discount,
    ROUND(c.cancellation_rate, 4)                               AS cancellation_rate
FROM coupon_orders AS c
LEFT JOIN applies AS a USING (coupon_code)
CROSS JOIN no_coupon AS n
ORDER BY c.gmv DESC;
