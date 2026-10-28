-- Q: Do shoppers who search convert better than those who browse, and what does a
-- zero-result search cost us?
-- Session-level comparison: searched and saw results / only hit zero results / never searched.
WITH session_flags AS (
    SELECT
        session_id,
        bool_or(event_type = 'search')              AS had_results,
        bool_or(event_type = 'search_zero_results') AS had_zero,
        bool_or(event_type = 'order_placed')        AS ordered
    FROM fact_events
    GROUP BY session_id
),
grouped AS (
    SELECT
        CASE
            WHEN had_results THEN 'searched, saw results'
            WHEN had_zero    THEN 'searched, zero results only'
            ELSE 'did not search'
        END AS search_behaviour,
        ordered
    FROM session_flags
)
SELECT
    search_behaviour,
    COUNT(*)                                       AS sessions,
    ROUND(COUNT(*) / SUM(COUNT(*)) OVER (), 4)     AS session_share,
    SUM(ordered::INT)                              AS converted_sessions,
    ROUND(AVG(ordered::INT), 4)                    AS conversion_rate
FROM grouped
GROUP BY search_behaviour
ORDER BY sessions DESC;
