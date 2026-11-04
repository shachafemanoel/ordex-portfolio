-- Integrity and drift checks for unified OMS

-- Orphaned OrderItems
SELECT COUNT(*) AS orphans FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

-- Orders without IdMap
SELECT COUNT(*) FROM orders o
LEFT JOIN id_maps m ON m.entity_type='order' AND m.internal_id=o.id
WHERE m.id IS NULL;

-- Money sanity
WITH li AS (
  SELECT order_id,
         SUM(unit_price_cents * quantity - COALESCE(discount_cents,0)) AS line_sum
  FROM order_items GROUP BY 1
)
SELECT o.id, o.total_cents, o.subtotal_cents, li.line_sum
FROM orders o JOIN li ON li.order_id=o.id
WHERE o.subtotal_cents <> li.line_sum
   OR o.total_cents <> o.subtotal_cents + o.tax_cents + o.shipping_cents - o.discount_cents;

-- Webhook idempotency violations
SELECT source_id,topic,external_id, COUNT(*)
FROM webhook_events
GROUP BY 1,2,3 HAVING COUNT(*) > 1;

-- Dangling PO links
SELECT COUNT(*) FROM purchase_order_links pol
LEFT JOIN orders o ON o.id = pol.order_id
LEFT JOIN purchase_orders po ON po.id = pol.purchase_order_id
WHERE o.id IS NULL OR po.id IS NULL;

-- Dashboard hot filter perf probe
EXPLAIN ANALYZE
SELECT id FROM orders
WHERE status IN ('TO_DO','PO_CREATED','WAITING_FOR_GOODS')
ORDER BY updated_at DESC LIMIT 50;

