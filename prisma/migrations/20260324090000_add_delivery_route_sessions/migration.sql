DO $$
BEGIN
  CREATE TYPE "DeliveryRouteSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'RELEASED', 'SUPERSEDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "delivery_route_sessions" (
  "id" UUID NOT NULL,
  "worker_id" UUID NOT NULL,
  "route_date_key" VARCHAR(10),
  "status" "DeliveryRouteSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "source_route_group_id" VARCHAR(64),
  "route_label" VARCHAR(160) NOT NULL,
  "route_color" VARCHAR(32),
  "route_worker_index" INTEGER,
  "route_summary" JSONB,
  "route_coordinates" JSONB,
  "stops_snapshot" JSONB NOT NULL,
  "queue_order_ids" JSONB NOT NULL,
  "completed_order_ids" JSONB NOT NULL,
  "deferred_order_ids" JSONB NOT NULL,
  "arrived_order_ids" JSONB NOT NULL,
  "current_order_id" UUID,
  "last_known_lat" DOUBLE PRECISION,
  "last_known_lng" DOUBLE PRECISION,
  "last_location_accuracy_m" DOUBLE PRECISION,
  "last_location_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_route_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_route_sessions_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_delivery_route_sessions_worker"
  ON "delivery_route_sessions"("worker_id");

CREATE INDEX IF NOT EXISTS "idx_delivery_route_sessions_worker_status"
  ON "delivery_route_sessions"("worker_id", "status");

CREATE INDEX IF NOT EXISTS "idx_delivery_route_sessions_status_date"
  ON "delivery_route_sessions"("status", "route_date_key");
