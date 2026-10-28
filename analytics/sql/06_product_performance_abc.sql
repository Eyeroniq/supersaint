-- Q: Which products earn the revenue, which convert, and which are about to run out?
-- Per SKU: views, add-to-cart rate (add-to-cart events / views), view-to-order rate
-- (non-cancelled order lines for the SKU / views), revenue, return rate,
-- Pareto running share of revenue (window SUM) and ABC class, plus days of stock cover.
--   ABC: A = products that make up the first 80% of revenue, B = next 15%, C = last 5%
--   days_of_cover = stock / average daily units over the last 30 days of data
WITH engagement AS (
    SELECT
        product_id,
        COUNT(*) FILTER (WHERE event_type = 'product_view') AS views,
        COUNT(*) FILTER (WHERE event_type = 'add_to_cart')  AS add_to_carts
    FROM fact_events
    WHERE product_id IS NOT NULL
    GROUP BY product_id
),
last_day AS (
    SELECT MAX(order_date) AS max_date FROM fact_orders
),
sales AS (
    SELECT
        i.product_id,
        COUNT(*)            FILTER (WHERE NOT o.is_cancelled)                        AS orders,
        SUM(i.quantity)     FILTER (WHERE NOT o.is_cancelled)                        AS units,
        SUM(i.line_revenue) FILTER (WHERE NOT o.is_cancelled)                        AS revenue,
        SUM(i.quantity)     FILTER (WHERE o.is_returned OR o.is_rto)                 AS returned_units,
        SUM(i.quantity)     FILTER (WHERE NOT o.is_cancelled
                                    AND o.order_date > l.max_date - INTERVAL 30 DAY) AS units_last_30d
    FROM fact_order_items AS i
    JOIN fact_orders AS o USING (order_id)
    CROSS JOIN last_day AS l
    GROUP BY i.product_id
),
base AS (
    SELECT
        p.product_id,
        p.product_name,
        p.category,
        p.price,
        p.stock,
        COALESCE(e.views, 0)            AS views,
        COALESCE(e.add_to_carts, 0)     AS add_to_carts,
        COALESCE(s.orders, 0)           AS orders,
        COALESCE(s.units, 0)            AS units,
        COALESCE(s.revenue, 0)          AS revenue,
        COALESCE(s.returned_units, 0)   AS returned_units,
        COALESCE(s.units_last_30d, 0)   AS units_last_30d
    FROM dim_products AS p
    LEFT JOIN engagement AS e USING (product_id)
    LEFT JOIN sales      AS s USING (product_id)
),
pareto AS (
    SELECT
        *,
        ROW_NUMBER() OVER (ORDER BY revenue DESC, product_id)                                        AS revenue_rank,
        SUM(revenue) OVER (ORDER BY revenue DESC, product_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_revenue,
        SUM(revenue) OVER ()                                                                         AS total_revenue
    FROM base
)
SELECT
    revenue_rank,
    product_id,
    product_name,
    category,
    price,
    views,
    add_to_carts,
    ROUND(add_to_carts / NULLIF(views, 0), 4)                       AS add_to_cart_rate,
    orders,
    ROUND(orders / NULLIF(views, 0), 4)                             AS view_to_order_rate,
    units,
    ROUND(revenue, 2)                                               AS revenue,
    ROUND(revenue / NULLIF(total_revenue, 0), 4)                    AS revenue_share,
    ROUND(cumulative_revenue / NULLIF(total_revenue, 0), 4)         AS cumulative_share,
    CASE
        WHEN (cumulative_revenue - revenue) / NULLIF(total_revenue, 0) < 0.80 THEN 'A'
        WHEN (cumulative_revenue - revenue) / NULLIF(total_revenue, 0) < 0.95 THEN 'B'
        ELSE 'C'
    END                                                             AS abc_class,
    ROUND(returned_units / NULLIF(units, 0), 4)                     AS return_rate,
    stock,
    ROUND(stock / NULLIF(units_last_30d / 30.0, 0), 1)              AS days_of_cover
FROM pareto
ORDER BY revenue_rank;
