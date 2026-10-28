-- Q: What are people searching for, what do we fail to show them, and do searches sell?
-- Per search term: searches, zero-result searches, and the share of searching sessions
-- that went on to place an order in the same session.
WITH searches AS (
    SELECT
        search_term,
        session_id,
        event_type = 'search_zero_results' AS zero_result
    FROM fact_events
    WHERE event_type IN ('search', 'search_zero_results')
      AND search_term IS NOT NULL
),
ordered_sessions AS (
    SELECT DISTINCT session_id
    FROM fact_events
    WHERE event_type = 'order_placed'
)
SELECT
    s.search_term,
    COUNT(*)                                                         AS searches,
    COUNT(*) FILTER (WHERE s.zero_result)                            AS zero_result_searches,
    ROUND(AVG(s.zero_result::INT), 4)                                AS zero_result_rate,
    COUNT(DISTINCT s.session_id)                                     AS sessions,
    COUNT(DISTINCT s.session_id) FILTER (WHERE o.session_id IS NOT NULL) AS converting_sessions,
    ROUND(COUNT(DISTINCT s.session_id) FILTER (WHERE o.session_id IS NOT NULL)
          / COUNT(DISTINCT s.session_id), 4)                         AS search_to_purchase_rate,
    ROUND(COUNT(*) / SUM(COUNT(*)) OVER (), 4)                       AS share_of_searches
FROM searches AS s
LEFT JOIN ordered_sessions AS o USING (session_id)
GROUP BY s.search_term
ORDER BY searches DESC;
