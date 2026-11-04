-- Ops queue performance hardening
-- Primary query: status/deleted_at + daily-window filters + urgent/scheduled sorting.

CREATE INDEX IF NOT EXISTS idx_orders_ops_queue_sort
  ON orders (deleted_at, status, urgent DESC, scheduled_at, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_ops_queue_lane
  ON orders (deleted_at, status, ops_lane);

CREATE INDEX IF NOT EXISTS idx_orders_ops_queue_snooze
  ON orders (deleted_at, status, ops_snooze_until);
