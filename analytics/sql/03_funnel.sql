-- Q: Where do shoppers drop out between viewing a product and placing an order?
-- Strict sequential funnel at session level: a session reaches step N only if it also hit
-- every earlier step. Reported overall and by device (GROUPING SETS), with step-to-step
-- conversion (LAG) and conversion from the first step (FIRST_VALUE).
WITH session_flags AS (
    SELECT
        session_id,
        arg_min(device, event_ts_ist)            AS device,   -- device of the session's first event
        bool_or(event_type = 'product_view')     AS viewed,
        bool_or(event_type = 'add_to_cart')      AS carted,
        bool_or(event_type = 'checkout_started') AS checked_out,
        bool_or(event_type = 'payment_attempted') AS paid,
        bool_or(event_type = 'order_placed')     AS ordered
    FROM fact_events
    GROUP BY session_id
),
reached AS (
    SELECT
        device,
        viewed                                                AS s1,
        viewed AND carted                                     AS s2,
        viewed AND carted AND checked_out                     AS s3,
        viewed AND carted AND checked_out AND paid            AS s4,
        viewed AND carted AND checked_out AND paid AND ordered AS s5
    FROM session_flags
),
counts AS (
    SELECT
        COALESCE(device, 'all') AS segment,
        SUM(s1::INT) AS s1, SUM(s2::INT) AS s2, SUM(s3::INT) AS s3, SUM(s4::INT) AS s4, SUM(s5::INT) AS s5
    FROM reached
    GROUP BY GROUPING SETS ((), (device))
),
steps AS (
    SELECT segment, 1 AS step_no, 'product_view'      AS step, s1 AS sessions FROM counts UNION ALL
    SELECT segment, 2,            'add_to_cart',               s2             FROM counts UNION ALL
    SELECT segment, 3,            'checkout_started',          s3             FROM counts UNION ALL
    SELECT segment, 4,            'payment_attempted',         s4             FROM counts UNION ALL
    SELECT segment, 5,            'order_placed',              s5             FROM counts
)
SELECT
    segment,
    step_no,
    step,
    sessions,
    ROUND(sessions / LAG(sessions) OVER w, 4)                    AS step_conversion,
    ROUND(1 - sessions / LAG(sessions) OVER w, 4)                AS step_drop_off,
    ROUND(sessions / FIRST_VALUE(sessions) OVER w, 4)            AS conversion_from_view
FROM steps
WINDOW w AS (PARTITION BY segment ORDER BY step_no)
ORDER BY segment = 'all' DESC, segment, step_no;
