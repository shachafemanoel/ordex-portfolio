-- Railway Database Seed Validation Queries
-- Run these queries to verify the demo data was seeded correctly

-- 1. Count orders by status
SELECT status, COUNT(*) as count
FROM orders
WHERE demo = true
GROUP BY status
ORDER BY count DESC;

-- 2. Verify SCHEDULED orders have scheduledAt and full receipts
SELECT o.id, o.number, o."scheduledAt", COUNT(oi.id) as total_items,
  SUM(CASE WHEN oi."received_quantity" >= oi.qty THEN 1 ELSE 0 END) as received_items
FROM orders o
LEFT JOIN order_items oi ON oi."order_id" = o.id
WHERE o.status = 'SCHEDULED' AND o.demo = true
GROUP BY o.id, o."scheduledAt"
HAVING
  o."scheduledAt" IS NULL
  OR SUM(CASE WHEN oi."received_quantity" < oi.qty THEN 1 ELSE 0 END) > 0;
-- Expected: 0 rows (no violations)

-- 3. Verify PARTIALLY_SUPPLIED has correct receipt pattern
SELECT o.id, o.number,
  COUNT(*) as total_items,
  SUM(CASE WHEN oi.received = true THEN 1 ELSE 0 END) as received_items,
  SUM(CASE WHEN oi."received_quantity" > 0 AND oi."received_quantity" < oi.qty THEN 1 ELSE 0 END) as partial_items
FROM orders o
JOIN order_items oi ON oi."order_id" = o.id
WHERE o.status = 'PARTIALLY_SUPPLIED' AND o.demo = true
GROUP BY o.id, o.number;
-- Expected: Each order should have at least 1 received/partial item and at least 1 pending

-- 4. Verify COMPLETED orders have completedAt and payment
SELECT o.id, o.number, o."completedAt", o."payment_status", o."paid_amount_cents", o."total_cents"
FROM orders o
WHERE o.status = 'COMPLETED' AND o.demo = true
  AND (o."completedAt" IS NULL OR o."payment_status" != 'PAID');
-- Expected: 0 rows

-- 5. Count total demo entities
SELECT 'Users' as entity, COUNT(*) as count FROM users WHERE demo = true
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers WHERE demo = true
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers WHERE demo = true
UNION ALL
SELECT 'Products', COUNT(*) FROM products WHERE demo = true
UNION ALL
SELECT 'SKUs', COUNT(*) FROM skus WHERE demo = true
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders WHERE demo = true
UNION ALL
SELECT 'OrderItems', COUNT(*) FROM order_items WHERE demo = true
UNION ALL
SELECT 'Purchase Orders', COUNT(*) FROM purchase_orders WHERE demo = true
UNION ALL
SELECT 'Calendar Events', COUNT(*) FROM calendar_events WHERE demo = true;

-- 6. Verify foreign key integrity
SELECT 'Orders with missing customers' as check,
  COUNT(*) as violations
FROM orders o
LEFT JOIN customers c ON c.id = o."customer_id"
WHERE o.demo = true AND c.id IS NULL
UNION ALL
SELECT 'OrderItems with missing products',
  COUNT(*)
FROM order_items oi
LEFT JOIN products p ON p.id = oi."product_id"
WHERE oi.demo = true AND p.id IS NULL
UNION ALL
SELECT 'POs with missing suppliers',
  COUNT(*)
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po."supplier_id"
WHERE po.demo = true AND s.id IS NULL;
-- Expected: All violations = 0

-- 7. Order distribution by city
SELECT city, COUNT(*) as order_count
FROM orders
WHERE demo = true AND city IS NOT NULL
GROUP BY city
ORDER BY order_count DESC;

-- 8. Verify task creation for CALL_BACK orders
SELECT o.status, COUNT(t.id) as task_count
FROM orders o
LEFT JOIN tasks t ON t."order_id" = o.id
WHERE o.demo = true AND o.status = 'CALL_BACK'
GROUP BY o.status;
-- Expected: Each CALL_BACK order should have a task

-- 9. Check inventory stock levels
SELECT s.code, s.name, s.stock
FROM skus s
WHERE s.demo = true
ORDER BY s.stock DESC
LIMIT 20;

-- 10. Verify purchase order item quantities
SELECT po.reference, poi."product_id", p.name,
  poi."qty_ordered", poi."qty_received", po.status
FROM purchase_orders po
JOIN purchase_order_items poi ON poi."purchase_order_id" = po.id
JOIN products p ON p.id = poi."product_id"
WHERE po.demo = true
ORDER BY po.reference, p.name
LIMIT 30;
