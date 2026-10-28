-- Daily KPI table: one row per IST calendar day.
-- Saved as table kpi_daily and exported to kpi_daily.csv for Power BI / Excel.
--
-- Definitions used everywhere in this project:
--   sessions               distinct session_id with any tracked event that day
--   conversion_rate        sessions with an order_placed event / sessions
--   gmv                    sum of order totals for orders placed that day (gross: includes later cancellations)
--   net_revenue            gmv minus orders that ended Cancelled, RTO or Returned
--   aov                    gmv / orders
--   cart_abandonment_rate  1 - (sessions that ordered / sessions that added to cart)
WITH session_day AS (
    SELECT
        date_key,
        COUNT(DISTINCT session_id)                                                AS sessions,
        COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart'  THEN session_id END) AS cart_sessions,
        COUNT(DISTINCT CASE WHEN event_type = 'order_placed' THEN session_id END) AS converted_sessions
    FROM fact_events
    GROUP BY date_key
),
order_day AS (
    SELECT
        order_date_key                                          AS date_key,
        COUNT(*)                                                AS orders,
        SUM(total)                                              AS gmv,
        SUM(CASE WHEN NOT is_lost THEN total ELSE 0 END)        AS net_revenue,
        SUM(discount)                                           AS discount_cost,
        SUM(CASE WHEN payment_method = 'COD' THEN 1 ELSE 0 END) AS cod_orders,
        SUM(CASE WHEN is_cancelled THEN 1 ELSE 0 END)           AS cancelled_orders,
        SUM(CASE WHEN is_rto THEN 1 ELSE 0 END)                 AS rto_orders
    FROM fact_orders
    GROUP BY order_date_key
),
first_order AS (
    SELECT customer_id, MIN(order_ts_ist) AS first_order_ts
    FROM fact_orders
    GROUP BY customer_id
),
customer_day AS (
    SELECT
        o.order_date_key                                                                   AS date_key,
        COUNT(DISTINCT CASE WHEN o.order_ts_ist = f.first_order_ts THEN o.customer_id END) AS new_customers,
        COUNT(DISTINCT CASE WHEN o.order_ts_ist > f.first_order_ts THEN o.customer_id END) AS repeat_customers
    FROM fact_orders AS o
    JOIN first_order AS f USING (customer_id)
    GROUP BY o.order_date_key
)
SELECT
    d.date,
    d.date_key,
    d.day_name,
    d.is_weekend,
    d.sale_event,
    COALESCE(s.sessions, 0)                                   AS sessions,
    COALESCE(s.cart_sessions, 0)                              AS cart_sessions,
    COALESCE(s.converted_sessions, 0)                         AS converted_sessions,
    COALESCE(o.orders, 0)                                     AS orders,
    ROUND(COALESCE(o.gmv, 0), 2)                              AS gmv,
    ROUND(COALESCE(o.net_revenue, 0), 2)                      AS net_revenue,
    ROUND(o.gmv / NULLIF(o.orders, 0), 2)                     AS aov,
    ROUND(s.converted_sessions / NULLIF(s.sessions, 0), 4)    AS conversion_rate,
    ROUND(1 - s.converted_sessions / NULLIF(s.cart_sessions, 0), 4) AS cart_abandonment_rate,
    ROUND(COALESCE(o.discount_cost, 0), 2)                    AS discount_cost,
    COALESCE(o.cod_orders, 0)                                 AS cod_orders,
    COALESCE(o.cancelled_orders, 0)                           AS cancelled_orders,
    COALESCE(o.rto_orders, 0)                                 AS rto_orders,
    COALESCE(c.new_customers, 0)                              AS new_customers,
    COALESCE(c.repeat_customers, 0)                           AS repeat_customers
FROM dim_date AS d
LEFT JOIN session_day  AS s USING (date_key)
LEFT JOIN order_day    AS o USING (date_key)
LEFT JOIN customer_day AS c USING (date_key)
ORDER BY d.date;
