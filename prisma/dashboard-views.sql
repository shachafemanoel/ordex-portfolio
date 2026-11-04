-- Dashboard Materialized Views for Order Management System
-- Run after initial migration for high-performance analytics

-- Daily order status summary
CREATE MATERIALIZED VIEW mv_order_status_daily AS
SELECT 
  date_trunc('day', updated_at) AS status_date,
  status,
  count(*) AS order_count,
  sum(total_cents) AS total_revenue_cents,
  avg(total_cents) AS avg_order_value_cents
FROM orders
WHERE updated_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1, 2;


-- Weekly order trends
CREATE MATERIALIZED VIEW mv_order_trends_weekly AS
SELECT 
  date_trunc('week', created_at) AS week_start,
  count(*) AS orders_count,
  sum(total_cents) AS revenue_cents,
  count(DISTINCT customer_id) AS unique_customers,
  avg(total_cents) AS avg_order_value
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '52 weeks'
  AND created_at IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- Supplier performance summary
CREATE MATERIALIZED VIEW mv_supplier_performance AS
SELECT 
  s.id AS supplier_id,
  s.name AS supplier_name,
  count(DISTINCT po.id) AS total_pos,
  count(DISTINCT CASE WHEN po.status IN ('SENT', 'PARTIALLY_RECEIVED') THEN po.id END) AS open_pos,
  sum(poi.qty_ordered * COALESCE(p.base_price_cents, 0)) AS total_value_cents,
  avg(EXTRACT(days FROM (po.updated_at - po.created_at))) AS avg_fulfillment_days
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
LEFT JOIN products p ON p.id = poi.product_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '180 days'
GROUP BY s.id, s.name;

-- Product demand analysis
CREATE MATERIALIZED VIEW mv_product_demand AS
SELECT 
  p.id AS product_id,
  p.sku,
  p.name,
  count(DISTINCT oi.order_id) AS orders_count,
  sum(oi.qty) AS total_quantity_sold,
  sum(oi.qty * oi.unit_price_cents) AS total_revenue_cents,
  avg(oi.unit_price_cents) AS avg_selling_price_cents,
  max(o.created_at) AS last_ordered_at
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '180 days'
  AND o.status != 'CANCELLED'
GROUP BY p.id, p.sku, p.name;

-- Installation workload summary
CREATE MATERIALIZED VIEW mv_installation_workload AS
SELECT 
  date_trunc('day', scheduled_date) AS installation_date,
  city,
  count(*) AS installations_count,
  count(CASE WHEN status = 'SCHEDULED' THEN 1 END) AS scheduled_count,
  count(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count,
  count(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_count
FROM installation_tasks
WHERE scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
  AND scheduled_date <= CURRENT_DATE + INTERVAL '60 days'
GROUP BY 1, 2;

-- Customer lifetime value
CREATE MATERIALIZED VIEW mv_customer_ltv AS
SELECT 
  c.id AS customer_id,
  c.email,
  c.name,
  count(DISTINCT o.id) AS total_orders,
  sum(o.total_cents) AS lifetime_value_cents,
  avg(o.total_cents) AS avg_order_value_cents,
  min(o.created_at) AS first_order_date,
  max(o.created_at) AS last_order_date,
  EXTRACT(days FROM (max(o.created_at) - min(o.created_at))) AS customer_lifespan_days
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status != 'CANCELLED'
  AND o.created_at IS NOT NULL
GROUP BY c.id, c.email, c.name
HAVING count(DISTINCT o.id) > 0;

-- Revenue by source analysis
CREATE MATERIALIZED VIEW mv_revenue_by_source AS
SELECT 
  channel AS source_name,
  count(DISTINCT id) AS total_orders,
  sum(total_cents) AS total_revenue_cents,
  avg(total_cents) AS avg_order_value_cents,
  count(DISTINCT customer_id) AS unique_customers,
  max(created_at) AS last_order_date
FROM orders
WHERE status != 'CANCELLED'
  AND created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY channel;

-- Purchase order fulfillment tracking
CREATE MATERIALIZED VIEW mv_po_fulfillment AS
SELECT 
  po.id AS purchase_order_id,
  po.reference AS po_number,
  s.name AS supplier_name,
  po.status,
  po.created_at AS po_date,
  count(poi.id) AS line_items_count,
  sum(poi.qty_ordered) AS total_requested_qty,
  sum(poi.qty_received) AS total_received_qty,
  sum(poi.qty_ordered * COALESCE(p.base_price_cents, 0)) AS total_value_cents,
  CASE 
    WHEN sum(poi.qty_ordered) = 0 THEN 0
    ELSE (sum(poi.qty_received)::float / sum(poi.qty_ordered)::float * 100)
  END AS fulfillment_percentage,
  EXTRACT(days FROM (COALESCE(po.updated_at, CURRENT_TIMESTAMP) - po.created_at)) AS days_open
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
LEFT JOIN products p ON p.id = poi.product_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY po.id, po.reference, s.name, po.status, po.created_at, po.updated_at;

-- Index creation for performance and concurrent refresh
CREATE UNIQUE INDEX idx_mv_order_status_daily_unique ON mv_order_status_daily(status_date, status);
CREATE UNIQUE INDEX idx_mv_order_trends_weekly_unique ON mv_order_trends_weekly(week_start);
CREATE UNIQUE INDEX idx_mv_supplier_performance_unique ON mv_supplier_performance(supplier_id);
CREATE UNIQUE INDEX idx_mv_product_demand_unique ON mv_product_demand(product_id);
CREATE UNIQUE INDEX idx_mv_installation_workload_unique ON mv_installation_workload(installation_date, city);
CREATE UNIQUE INDEX idx_mv_customer_ltv_unique ON mv_customer_ltv(customer_id);
CREATE UNIQUE INDEX idx_mv_revenue_by_source_unique ON mv_revenue_by_source(source_name);
CREATE UNIQUE INDEX idx_mv_po_fulfillment_unique ON mv_po_fulfillment(purchase_order_id);

CREATE INDEX idx_mv_supplier_performance_value ON mv_supplier_performance(total_value_cents DESC);
CREATE INDEX idx_mv_product_demand_revenue ON mv_product_demand(total_revenue_cents DESC);
CREATE INDEX idx_mv_installation_workload_date ON mv_installation_workload(installation_date);
CREATE INDEX idx_mv_customer_ltv_value ON mv_customer_ltv(lifetime_value_cents DESC);
CREATE INDEX idx_mv_revenue_by_source ON mv_revenue_by_source(total_revenue_cents DESC);
CREATE INDEX idx_mv_po_fulfillment_status ON mv_po_fulfillment(status, days_open);

-- Refresh function for scheduled updates
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_status_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_trends_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_demand;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_installation_workload;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_ltv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_by_source;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_fulfillment;
END;
$$ LANGUAGE plpgsql;

-- Comment the views for documentation
COMMENT ON MATERIALIZED VIEW mv_order_status_daily IS 'Daily order counts and revenue by status for dashboard KPIs';
COMMENT ON MATERIALIZED VIEW mv_order_trends_weekly IS 'Weekly order trends for revenue and customer analytics';
COMMENT ON MATERIALIZED VIEW mv_supplier_performance IS 'Supplier performance metrics for procurement analysis';
COMMENT ON MATERIALIZED VIEW mv_product_demand IS 'Product sales analysis for inventory planning';
COMMENT ON MATERIALIZED VIEW mv_installation_workload IS 'Installation scheduling and completion tracking';
COMMENT ON MATERIALIZED VIEW mv_customer_ltv IS 'Customer lifetime value analysis for marketing';
COMMENT ON MATERIALIZED VIEW mv_revenue_by_source IS 'Revenue attribution by data source (WooCommerce, manual, etc.)';
COMMENT ON MATERIALIZED VIEW mv_po_fulfillment IS 'Purchase order fulfillment tracking and supplier performance';

-- Initial refresh
SELECT refresh_dashboard_views();