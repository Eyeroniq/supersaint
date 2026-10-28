-- Q: How do GMV and AOV move day to day, once weekly noise is smoothed out?
-- Daily GMV/orders/AOV plus a trailing 7-day moving average (window frame over dim_date,
-- so days with no orders still count as zero).
WITH daily AS (
    SELECT
        order_date      AS date,
        COUNT(*)        AS orders,
        SUM(total)      AS gmv
    FROM fact_orders
    GROUP BY order_date
)
SELECT
    d.date,
    d.day_name,
    d.sale_event,
    COALESCE(daily.orders, 0)                                     AS orders,
    ROUND(COALESCE(daily.gmv, 0), 2)                              AS gmv,
    ROUND(daily.gmv / NULLIF(daily.orders, 0), 2)                 AS aov,
    ROUND(AVG(COALESCE(daily.gmv, 0)) OVER seven_days, 2)         AS gmv_7d_avg,
    ROUND(SUM(COALESCE(daily.gmv, 0)) OVER seven_days
          / NULLIF(SUM(COALESCE(daily.orders, 0)) OVER seven_days, 0), 2) AS aov_7d
FROM dim_date AS d
LEFT JOIN daily ON daily.date = d.date
WINDOW seven_days AS (ORDER BY d.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
ORDER BY d.date;
