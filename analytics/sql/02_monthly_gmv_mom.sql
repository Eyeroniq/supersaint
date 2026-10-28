-- Q: Is the business growing month over month?
-- Monthly GMV, orders, AOV and net revenue with MoM growth via LAG, plus a year-to-date
-- running total. Note: the first and last months of the data window are partial months.
WITH monthly AS (
    SELECT
        strftime(order_date, '%Y-%m')                       AS month,
        COUNT(*)                                            AS orders,
        COUNT(DISTINCT customer_id)                         AS buyers,
        SUM(total)                                          AS gmv,
        SUM(CASE WHEN NOT is_lost THEN total ELSE 0 END)    AS net_revenue
    FROM fact_orders
    GROUP BY 1
)
SELECT
    month,
    orders,
    buyers,
    ROUND(gmv, 2)                                                        AS gmv,
    ROUND(gmv / orders, 2)                                               AS aov,
    ROUND(net_revenue, 2)                                                AS net_revenue,
    ROUND(LAG(gmv) OVER w, 2)                                            AS prev_month_gmv,
    ROUND(100.0 * (gmv - LAG(gmv) OVER w) / LAG(gmv) OVER w, 2)          AS gmv_mom_pct,
    ROUND(100.0 * (orders - LAG(orders) OVER w) / LAG(orders) OVER w, 2) AS orders_mom_pct,
    ROUND(SUM(gmv) OVER (PARTITION BY substr(month, 1, 4) ORDER BY month), 2) AS gmv_ytd
FROM monthly
WINDOW w AS (ORDER BY month)
ORDER BY month;
