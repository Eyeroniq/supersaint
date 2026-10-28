-- Q: Where would a prepaid incentive pay for itself?
-- COD share and RTO rates by city, with the estimated cost of COD RTOs.
-- Assumption (state it when presenting): each RTO costs ₹180 in forward + reverse
-- logistics. Cities are ranked by that cost; RANK() and a running share show concentration.
WITH city_stats AS (
    SELECT
        city,
        state,
        COUNT(*)                                                       AS orders,
        AVG((payment_method = 'COD')::INT)                             AS cod_share,
        COUNT(*) FILTER (WHERE payment_method = 'COD')                 AS cod_orders,
        COUNT(*) FILTER (WHERE payment_method = 'COD' AND is_rto)      AS cod_rto_orders,
        COUNT(*) FILTER (WHERE payment_method = 'ONLINE')              AS prepaid_orders,
        COUNT(*) FILTER (WHERE payment_method = 'ONLINE' AND is_rto)   AS prepaid_rto_orders
    FROM fact_orders
    GROUP BY city, state
)
SELECT
    RANK() OVER (ORDER BY cod_rto_orders DESC)                              AS cost_rank,
    city,
    state,
    orders,
    ROUND(cod_share, 4)                                                     AS cod_share,
    ROUND(cod_rto_orders / NULLIF(cod_orders, 0), 4)                        AS cod_rto_rate,
    ROUND(prepaid_rto_orders / NULLIF(prepaid_orders, 0), 4)                AS prepaid_rto_rate,
    cod_rto_orders,
    cod_rto_orders * 180                                                    AS est_cod_rto_cost_inr,
    ROUND(SUM(cod_rto_orders) OVER (ORDER BY cod_rto_orders DESC, city)
          / SUM(cod_rto_orders) OVER (), 4)                                 AS cumulative_share_of_cod_rto
FROM city_stats
ORDER BY cost_rank, city;
