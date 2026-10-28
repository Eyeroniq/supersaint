-- Q: How much worse are Cash on Delivery orders than prepaid ones?
-- Per payment method: share of orders, cancellation, RTO (returned to origin: courier
-- couldn't deliver / customer refused), customer returns, and delivery speed.
-- Rates use all orders placed with that method as the denominator.
SELECT
    payment_method,
    COUNT(*)                                                      AS orders,
    ROUND(COUNT(*) / SUM(COUNT(*)) OVER (), 4)                    AS order_share,
    ROUND(SUM(total), 2)                                          AS gmv,
    ROUND(AVG(total), 2)                                          AS aov,
    ROUND(AVG(is_cancelled::INT), 4)                              AS cancellation_rate,
    ROUND(AVG(is_rto::INT), 4)                                    AS rto_rate,
    ROUND(AVG(is_returned::INT), 4)                               AS return_rate,
    ROUND(AVG(is_lost::INT), 4)                                   AS lost_order_rate,
    ROUND(SUM(CASE WHEN is_lost THEN total ELSE 0 END), 2)        AS lost_gmv,
    ROUND(AVG(hours_to_ship), 1)                                  AS avg_hours_to_ship,
    ROUND(AVG(days_to_deliver), 2)                                AS avg_days_to_deliver
FROM fact_orders
GROUP BY payment_method
ORDER BY orders DESC;
