-- Q: Of customers who first bought in a given month, what share buy again N months later?
-- Cohort = month of a customer's first non-cancelled order. Month 0 is always 100%.
-- Cells a cohort hasn't lived long enough to reach are excluded (right-censoring).
WITH orders AS (
    SELECT customer_id, date_trunc('month', order_date) AS order_month
    FROM fact_orders
    WHERE NOT is_cancelled
),
cohorts AS (
    SELECT customer_id, MIN(order_month) AS cohort_month
    FROM orders
    GROUP BY customer_id
),
cohort_size AS (
    SELECT cohort_month, COUNT(*) AS cohort_size
    FROM cohorts
    GROUP BY cohort_month
),
activity AS (
    SELECT DISTINCT
        o.customer_id,
        c.cohort_month,
        date_diff('month', c.cohort_month, o.order_month) AS month_number
    FROM orders AS o
    JOIN cohorts AS c USING (customer_id)
),
last_month AS (
    SELECT MAX(order_month) AS max_month FROM orders
)
SELECT
    strftime(a.cohort_month, '%Y-%m')               AS cohort,
    s.cohort_size,
    a.month_number,
    COUNT(*)                                        AS active_customers,
    ROUND(COUNT(*) / s.cohort_size, 4)              AS retention_rate
FROM activity AS a
JOIN cohort_size AS s USING (cohort_month)
CROSS JOIN last_month AS l
WHERE a.month_number BETWEEN 0 AND 6
  AND a.cohort_month + to_months(a.month_number) <= l.max_month
GROUP BY a.cohort_month, s.cohort_size, a.month_number
ORDER BY cohort, month_number;
