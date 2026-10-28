# Power BI and Excel guide

The warehouse is a star schema. Get the CSVs either from **Admin → Analytics → Exports** (live database) or by running `npm run export:warehouse` in `Backend/` (writes `analytics/warehouse/*.csv`).

All files use the same conventions:

- Dates are ISO `YYYY-MM-DD`; timestamps are `YYYY-MM-DD HH:MM:SS` in **IST** (columns ending `_ist`).
- Money is in **₹** (rupees, not paise).
- Booleans are `true` / `false`.
- **No PII.** Customers are UUIDs; emails and phones are salted SHA-256 hashes; addresses are reduced to city, state and a 3-digit PIN prefix.

## Tables

| Table | Grain | Key | Notes |
|---|---|---|---|
| `dim_date` | IST calendar day | `date_key` (yyyymmdd) | `year_month`, `day_name`, `is_weekend`, `sale_event` |
| `dim_products` | SKU | `product_id` | `product_line`, `color`, `category`, `price`, `stock` |
| `dim_customers` | customer | `customer_id` | `email_hash`, `phone_hash`, `signup_date`, `first_order_date`, `city` |
| `fact_orders` | order | `order_id` | totals, `payment_method`, `status`, outcome flags, `days_to_deliver` |
| `fact_order_items` | order line | `order_item_id` | `quantity`, `unit_price`, `line_revenue` |
| `fact_events` | tracked event | `event_id` | `event_type`, `session_id`, `search_term`, `experiment`, `variant` |
| `kpi_daily` | IST day | `date_key` | pre-aggregated daily KPIs (same definition as `analytics/sql/00_kpi_daily.sql`) |

## Relationships (Model view)

Create these as **one-to-many, single direction** (dimension filters fact):

| From (one) | To (many) |
|---|---|
| `dim_date[date_key]` | `fact_orders[order_date_key]` |
| `dim_date[date_key]` | `fact_events[date_key]` |
| `dim_date[date_key]` | `kpi_daily[date_key]` |
| `dim_products[product_id]` | `fact_order_items[product_id]` |
| `dim_products[product_id]` | `fact_events[product_id]` |
| `dim_customers[customer_id]` | `fact_orders[customer_id]` |
| `fact_orders[order_id]` | `fact_order_items[order_id]` |

Leave `fact_order_items[order_date_key]` **unrelated** (or inactive), so date filtering reaches order lines through `fact_orders` and there is only one path from `dim_date`. Mark `dim_date` as the date table (`dim_date[date]`).

Set data types on import: `date`, `order_date` → Date; `*_ts_ist` → Date/Time; `*_key` → Whole number; money → Fixed decimal.

## DAX measures

Create a blank `_Measures` table and add:

```DAX
GMV = SUM ( fact_orders[total] )

Orders = COUNTROWS ( fact_orders )

AOV = DIVIDE ( [GMV], [Orders] )

Net Revenue =
CALCULATE ( [GMV], fact_orders[is_lost] = FALSE () )

Sessions = DISTINCTCOUNT ( fact_events[session_id] )

Converted Sessions =
CALCULATE ( DISTINCTCOUNT ( fact_events[session_id] ), fact_events[event_type] = "order_placed" )

Conversion Rate = DIVIDE ( [Converted Sessions], [Sessions] )

Cart Sessions =
CALCULATE ( DISTINCTCOUNT ( fact_events[session_id] ), fact_events[event_type] = "add_to_cart" )

Cart Abandonment Rate = 1 - DIVIDE ( [Converted Sessions], [Cart Sessions] )

-- Buyers in the filtered period with 2+ non-cancelled orders up to the end of the period
Repeat Rate =
VAR PeriodEnd = MAX ( dim_date[date] )
VAR Buyers =
    CALCULATETABLE (
        VALUES ( fact_orders[customer_id] ),
        fact_orders[is_cancelled] = FALSE ()
    )
VAR RepeatBuyers =
    FILTER (
        Buyers,
        CALCULATE (
            COUNTROWS ( fact_orders ),
            REMOVEFILTERS ( dim_date ),
            dim_date[date] <= PeriodEnd,
            fact_orders[is_cancelled] = FALSE ()
        ) >= 2
    )
RETURN DIVIDE ( COUNTROWS ( RepeatBuyers ), COUNTROWS ( Buyers ) )

GMV Previous Month =
CALCULATE ( [GMV], DATEADD ( dim_date[date], -1, MONTH ) )

GMV MoM % = DIVIDE ( [GMV] - [GMV Previous Month], [GMV Previous Month] )

COD Share = DIVIDE ( CALCULATE ( [Orders], fact_orders[payment_method] = "COD" ), [Orders] )

RTO Rate = DIVIDE ( CALCULATE ( [Orders], fact_orders[is_rto] = TRUE () ), [Orders] )

Cancellation Rate = DIVIDE ( CALCULATE ( [Orders], fact_orders[is_cancelled] = TRUE () ), [Orders] )
```

### Cohort retention

Add two calculated columns to `fact_orders`, then a measure:

```DAX
-- Calculated column: month of the customer's first non-cancelled order
Cohort Month =
VAR Customer = fact_orders[customer_id]
RETURN
    EOMONTH (
        CALCULATE (
            MIN ( fact_orders[order_date] ),
            ALLEXCEPT ( fact_orders, fact_orders[customer_id] ),
            fact_orders[is_cancelled] = FALSE ()
        ),
        -1
    ) + 1

-- Calculated column: months since the cohort month
Months Since First Order =
DATEDIFF ( fact_orders[Cohort Month], fact_orders[order_date], MONTH )

-- Measure: share of the cohort ordering in that month
Cohort Retention % =
VAR CohortSize =
    CALCULATE (
        DISTINCTCOUNT ( fact_orders[customer_id] ),
        fact_orders[Months Since First Order] = 0,
        REMOVEFILTERS ( fact_orders[Months Since First Order] )
    )
VAR Active =
    CALCULATE ( DISTINCTCOUNT ( fact_orders[customer_id] ), fact_orders[is_cancelled] = FALSE () )
RETURN DIVIDE ( Active, CohortSize )
```

Visual: **Matrix** with `Cohort Month` on rows, `Months Since First Order` (filter 0–6) on columns, `Cohort Retention %` as values, plus conditional-formatting background colours. It should match `analytics/results/04_cohort_retention.csv`.

## Suggested report pages

1. **Overview:** cards (GMV, Orders, AOV, Conversion Rate, Repeat Rate, Cart Abandonment Rate) with `dim_date` slicer; line chart of GMV by `dim_date[date]`; column chart of GMV by `year_month` with GMV MoM % on the secondary axis.
2. **Funnel:** Funnel visual from a small table of `event_type` counts (or import `analytics/results/03_funnel.csv`); slicer on `fact_events[device]`.
3. **Customers:** cohort matrix; RFM from `05_rfm_segments.csv` as a bar chart of revenue share by segment.
4. **Operations:** clustered bar of RTO / Cancellation Rate by `payment_method`; map or table of `city` with COD Share and RTO Rate.
5. **Products:** Pareto (line of running revenue share over product rank) from `06_product_performance_abc.csv`.

## Excel

Load the CSVs with **Data → From Text/CSV**, then **Data → Relationships** (same keys as above) and build PivotTables from the Data Model:

| Pivot | Rows | Columns | Values |
|---|---|---|---|
| Monthly GMV | `dim_date[year_month]` | – | Sum of `total`, Count of `order_id`; add a calculated field `AOV = total / order count` |
| COD vs prepaid | `fact_orders[payment_method]` | `fact_orders[status]` | Count of `order_id`, shown as **% of row total** |
| City RTO | `fact_orders[city]` | `payment_method` | Count where `is_rto` = TRUE, as % of row |
| Daily KPIs | `kpi_daily[date]` | – | `sessions`, `orders`, `gmv`, `conversion_rate` (line chart) |
| Product revenue | `dim_products[product_name]` | – | Sum of `line_revenue`, sorted descending, with a running-total % column (Show Values As → % Running Total In) |
| Weekday pattern | `dim_date[day_name]` | `is_weekend` | Average of `kpi_daily[orders]` |
