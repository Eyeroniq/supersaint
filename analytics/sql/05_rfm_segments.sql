-- Q: Which customer groups drive revenue, and who is slipping away?
-- RFM over non-cancelled orders, measured against the day after the last order in the data.
--   R score: NTILE(5) over recency (5 = most recent)
--   M score: NTILE(5) over monetary value (5 = highest spend)
--   F score: fixed bins (1, 2, 3, 4-5, 6+ orders). NTILE is unusable for frequency here
--            because most customers have exactly one order, so quintiles would split
--            identical customers into different scores.
-- Ties are broken by customer_id so the scoring is deterministic (the API does the same).
WITH customer_orders AS (
    SELECT
        customer_id,
        MAX(order_date)  AS last_order_date,
        COUNT(*)         AS frequency,
        SUM(total)       AS monetary
    FROM fact_orders
    WHERE NOT is_cancelled
    GROUP BY customer_id
),
reference AS (
    SELECT MAX(last_order_date) + INTERVAL 1 DAY AS ref_date FROM customer_orders
),
scored AS (
    SELECT
        c.customer_id,
        date_diff('day', c.last_order_date, r.ref_date)                                   AS recency_days,
        c.frequency,
        c.monetary,
        NTILE(5) OVER (ORDER BY date_diff('day', c.last_order_date, r.ref_date) DESC, c.customer_id) AS r_score,
        CASE WHEN c.frequency >= 6 THEN 5 WHEN c.frequency >= 4 THEN 4 ELSE c.frequency END AS f_score,
        NTILE(5) OVER (ORDER BY c.monetary, c.customer_id)                                AS m_score
    FROM customer_orders AS c
    CROSS JOIN reference AS r
),
segmented AS (
    SELECT
        *,
        CASE
            WHEN r_score >= 4 AND f_score >= 4 THEN 'Champions'
            WHEN r_score >= 4 AND f_score >= 2 THEN 'Potential Loyalists'
            WHEN r_score >= 4                  THEN 'New Customers'
            WHEN r_score = 3  AND f_score >= 4 THEN 'Loyal'
            WHEN r_score = 3                   THEN 'Need Attention'
            WHEN f_score >= 3                  THEN 'At Risk'
            ELSE 'Hibernating'
        END AS segment
    FROM scored
)
SELECT
    segment,
    COUNT(*)                                                    AS customers,
    ROUND(COUNT(*) / SUM(COUNT(*)) OVER (), 4)                  AS customer_share,
    ROUND(SUM(monetary), 2)                                     AS revenue,
    ROUND(SUM(monetary) / SUM(SUM(monetary)) OVER (), 4)        AS revenue_share,
    ROUND(AVG(recency_days), 1)                                 AS avg_recency_days,
    ROUND(AVG(frequency), 2)                                    AS avg_orders,
    ROUND(AVG(monetary), 2)                                     AS avg_spend
FROM segmented
GROUP BY segment
ORDER BY revenue DESC;
