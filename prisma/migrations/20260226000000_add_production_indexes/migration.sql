-- Production Readiness: Add missing indexes for frequently queried fields

-- Orders: createdByUserId, statusUpdatedAt, customerId+deletedAt+status
CREATE INDEX IF NOT EXISTS "idx_orders_created_by_user" ON "orders"("created_by_user_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status_updated_at" ON "orders"("status_updated_at", "status");
CREATE INDEX IF NOT EXISTS "idx_orders_customer_deleted_status" ON "orders"("customer_id", "deleted_at", "status");

-- OrderItems: composite index for allocation queries
CREATE INDEX IF NOT EXISTS "idx_order_items_alloc_created" ON "order_items"("order_id", "allocation_status", "created_at");

-- Payments: composite index for order payment queries
CREATE INDEX IF NOT EXISTS "idx_payments_order_created_status" ON "payments"("order_id", "created_at", "status");

-- Tasks: orderId for order-task lookups
CREATE INDEX IF NOT EXISTS "idx_tasks_order_id" ON "tasks"("order_id");

-- MessageLogs: orderId and createdAt for audit queries
CREATE INDEX IF NOT EXISTS "idx_message_logs_order_id" ON "message_logs"("order_id");
CREATE INDEX IF NOT EXISTS "idx_message_logs_created_at" ON "message_logs"("created_at");

-- Notifications: userId+read+createdAt for inbox queries
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read_created" ON "notifications"("user_id", "read", "created_at");
