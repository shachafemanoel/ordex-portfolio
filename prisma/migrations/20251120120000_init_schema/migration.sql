-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."InboundOrderSource" AS ENUM ('WOOCOMMERCE');

-- CreateEnum
CREATE TYPE "public"."InboundOrderStatus" AS ENUM ('PENDING_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'IMPORTED', 'FAILED_IMPORT');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'READY_FOR_INSTALL', 'SCHEDULED', 'INVOICED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."OrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."OrderChannel" AS ENUM ('WOOCOMMERCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."AddressType" AS ENUM ('BILLING', 'SHIPPING');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."CustomerLedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."ShipmentStatus" AS ENUM ('PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReturnStatus" AS ENUM ('RMA_OPEN', 'INSPECTING', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."VatCategory" AS ENUM ('STANDARD', 'REDUCED', 'ZERO', 'EXEMPT');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'SALES', 'PURCHASING', 'INSTALLER', 'OPERATIONS', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."TaskType" AS ENUM ('CALL_BACK', 'INSTALL_REMINDER', 'STOCK_RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."WebhookEventStatus" AS ENUM ('QUEUED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."inbound_orders" (
    "id" UUID NOT NULL,
    "source" "public"."InboundOrderSource" NOT NULL,
    "source_order_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" "public"."InboundOrderStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "validation_flags" JSONB,
    "proposed_fields" JSONB,
    "conflicts" JSONB,
    "assigned_to_id" UUID,
    "notes_internal" TEXT,
    "failure_reason" TEXT,
    "order_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(64),
    "clv_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "first_order_at" TIMESTAMP(3),
    "credit_limit_cents" INTEGER,
    "payment_terms_days" INTEGER,
    "current_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "account_notes" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "public"."AddressType" NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "notes" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customer_id" UUID NOT NULL,
    "billing_address_id" UUID NOT NULL,
    "shipping_address_id" UUID NOT NULL,
    "channel" "public"."OrderChannel" NOT NULL DEFAULT 'MANUAL',
    "sub_total_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "shipping_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "notes_internal" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "city" VARCHAR(120),
    "address_line" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "assigned_user_id" UUID,
    "install_event_id" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_by_user_id" UUID,
    "notes" TEXT,
    "priority" "public"."OrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "paid_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "last_payment_at" TIMESTAMP(3),
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "customer_email" VARCHAR(320),
    "customer_name" VARCHAR(255),
    "customer_phone" VARCHAR(64),
    "woo_order_id" VARCHAR(255),
    "installer_name" VARCHAR(120),
    "installer_notes" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "tax_rate" DECIMAL(5,4),
    "vat_category" "public"."VatCategory" NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "supplier_id" UUID,
    "description" TEXT,
    "woo_product_id" VARCHAR(255),
    "woo_variation_id" VARCHAR(255),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "external_id" TEXT,
    "notes" TEXT,
    "reference" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "payment_id" UUID,
    "type" "public"."CustomerLedgerEntryType" NOT NULL,
    "delta_cents" INTEGER NOT NULL,
    "balance_cents" INTEGER NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "status" "public"."ShipmentStatus" NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."calendar_events" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "assigned_to" UUID,
    "created_by" UUID,
    "duration" INTEGER,
    "buffer_before" INTEGER,
    "buffer_after" INTEGER,
    "google_id" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(64),
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'SALES',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gov_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "payment_terms" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "default_supplier_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "base_price_cents" INTEGER,
    "demo_stock" INTEGER,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."skus" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "supplier_id" UUID,
    "cost_cents" INTEGER,
    "attributes_json" JSONB,
    "metadata" JSONB,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sku_suppliers" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_sku_code" TEXT,
    "lead_time_days" INTEGER,
    "cost" DECIMAL(65,30),
    "min_order_qty" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_settings" (
    "id" UUID NOT NULL,
    "store_name" TEXT NOT NULL DEFAULT 'Ordex Store',
    "default_currency" CHAR(3) NOT NULL DEFAULT 'ILS',
    "tax_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "auto_purchase_order" BOOLEAN NOT NULL DEFAULT true,
    "order_number_prefix" TEXT NOT NULL DEFAULT 'ORD-',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_suppliers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_sku" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "linked_order_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "qty_ordered" INTEGER NOT NULL,
    "qty_received" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."returns" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "public"."ReturnStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_events" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "public"."WebhookEventStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."id_maps" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "id_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" UUID NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "order_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "assignee_id" UUID,
    "due_at" TIMESTAMP(3),
    "notes" TEXT,
    "type" "public"."TaskType" NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "public"."OrderStatus",
    "to_status" "public"."OrderStatus" NOT NULL,
    "user_id" UUID,
    "reason" TEXT,
    "metadata" JSONB,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_notes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receiving_logs" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity_received" INTEGER NOT NULL,
    "quantity_before" INTEGER,
    "notes" TEXT,
    "photos" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID,

    CONSTRAINT "receiving_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goods_receipts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID,
    "purchase_order_id" UUID,
    "reference" TEXT,
    "notes" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."receiving_items" (
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "order_item_id" UUID,
    "sku_id" UUID,
    "quantity_received" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "receiving_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "template_id" UUID,
    "channel" "public"."NotificationChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "external_id" TEXT,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reminders" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "template_id" UUID,
    "message_log_id" UUID,
    "channel" "public"."NotificationChannel" NOT NULL,
    "status" "public"."ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "headers" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rate_limit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_orders_order_id_key" ON "public"."inbound_orders"("order_id");

-- CreateIndex
CREATE INDEX "inbound_orders_status_created_at_idx" ON "public"."inbound_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "inbound_orders_assigned_to_id_idx" ON "public"."inbound_orders"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_orders_source_source_order_id_key" ON "public"."inbound_orders"("source", "source_order_id");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "public"."customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "public"."customers"("phone");

-- CreateIndex
CREATE INDEX "customers_current_balance_cents_idx" ON "public"."customers"("current_balance_cents");

-- CreateIndex
CREATE INDEX "addresses_customer_id_idx" ON "public"."addresses"("customer_id");

-- CreateIndex
CREATE INDEX "addresses_city_idx" ON "public"."addresses"("city");

-- CreateIndex
CREATE INDEX "addresses_type_idx" ON "public"."addresses"("type");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "public"."orders"("number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "public"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "public"."orders"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_channel_idx" ON "public"."orders"("channel");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "public"."orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "public"."orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_status_idx" ON "public"."orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "orders_channel_status_created_at_idx" ON "public"."orders"("channel", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_city_idx" ON "public"."orders"("city");

-- CreateIndex
CREATE INDEX "orders_assigned_user_id_idx" ON "public"."orders"("assigned_user_id");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "public"."orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_payment_status_status_idx" ON "public"."orders"("payment_status", "status");

-- CreateIndex
CREATE INDEX "orders_woo_order_id_idx" ON "public"."orders"("woo_order_id");

-- CreateIndex
CREATE INDEX "orders_customer_name_idx" ON "public"."orders"("customer_name");

-- CreateIndex
CREATE INDEX "orders_customer_email_idx" ON "public"."orders"("customer_email");

-- CreateIndex
CREATE INDEX "orders_completed_at_idx" ON "public"."orders"("completed_at");

-- CreateIndex
CREATE INDEX "orders_deleted_at_idx" ON "public"."orders"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_orders_status_created_at" ON "public"."orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "public"."order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_supplier_id_idx" ON "public"."order_items"("supplier_id");

-- CreateIndex
CREATE INDEX "order_items_sku_idx" ON "public"."order_items"("sku");

-- CreateIndex
CREATE INDEX "order_items_order_id_product_id_idx" ON "public"."order_items"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "order_items_woo_product_id_idx" ON "public"."order_items"("woo_product_id");

-- CreateIndex
CREATE INDEX "order_items_woo_variation_id_idx" ON "public"."order_items"("woo_variation_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "public"."payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_customer_id_created_at_idx" ON "public"."customer_ledger_entries"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_order_id_idx" ON "public"."customer_ledger_entries"("order_id");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_payment_id_idx" ON "public"."customer_ledger_entries"("payment_id");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "public"."shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "public"."shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_scheduled_at_idx" ON "public"."shipments"("scheduled_at");

-- CreateIndex
CREATE INDEX "calendar_events_order_id_idx" ON "public"."calendar_events"("order_id");

-- CreateIndex
CREATE INDEX "calendar_events_assigned_to_idx" ON "public"."calendar_events"("assigned_to");

-- CreateIndex
CREATE INDEX "calendar_events_status_idx" ON "public"."calendar_events"("status");

-- CreateIndex
CREATE INDEX "calendar_events_start_time_idx" ON "public"."calendar_events"("start_time");

-- CreateIndex
CREATE INDEX "idx_calendar_events_order_id" ON "public"."calendar_events"("order_id");

-- CreateIndex
CREATE INDEX "idx_calendar_events_start_time" ON "public"."calendar_events"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "public"."suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "public"."products"("sku");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "public"."products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "public"."skus"("code");

-- CreateIndex
CREATE INDEX "skus_supplier_id_idx" ON "public"."skus"("supplier_id");

-- CreateIndex
CREATE INDEX "sku_suppliers_sku_id_idx" ON "public"."sku_suppliers"("sku_id");

-- CreateIndex
CREATE INDEX "sku_suppliers_supplier_id_idx" ON "public"."sku_suppliers"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "sku_suppliers_sku_id_supplier_id_key" ON "public"."sku_suppliers"("sku_id", "supplier_id");

-- CreateIndex
CREATE INDEX "product_suppliers_product_id_idx" ON "public"."product_suppliers"("product_id");

-- CreateIndex
CREATE INDEX "product_suppliers_supplier_id_idx" ON "public"."product_suppliers"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_suppliers_product_id_supplier_id_key" ON "public"."product_suppliers"("product_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_reference_key" ON "public"."purchase_orders"("reference");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "public"."purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "public"."purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_created_at_idx" ON "public"."purchase_orders"("created_at");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "public"."purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "public"."purchase_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_key" ON "public"."purchase_order_items"("purchase_order_id", "product_id");

-- CreateIndex
CREATE INDEX "returns_order_id_idx" ON "public"."returns"("order_id");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "public"."returns"("status");

-- CreateIndex
CREATE INDEX "webhook_events_topic_idx" ON "public"."webhook_events"("topic");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "public"."webhook_events"("status");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "public"."webhook_events"("created_at");

-- CreateIndex
CREATE INDEX "id_maps_entity_entity_id_idx" ON "public"."id_maps"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "id_maps_source_source_id_entity_key" ON "public"."id_maps"("source", "source_id", "entity");

-- CreateIndex
CREATE INDEX "tasks_order_id_idx" ON "public"."tasks"("order_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "public"."tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_type_idx" ON "public"."tasks"("type");

-- CreateIndex
CREATE INDEX "tasks_due_at_idx" ON "public"."tasks"("due_at");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "public"."tasks"("priority");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "public"."audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "public"."audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "status_history_order_id_idx" ON "public"."status_history"("order_id");

-- CreateIndex
CREATE INDEX "status_history_order_id_created_at_idx" ON "public"."status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "status_history_user_id_idx" ON "public"."status_history"("user_id");

-- CreateIndex
CREATE INDEX "status_history_to_status_idx" ON "public"."status_history"("to_status");

-- CreateIndex
CREATE INDEX "order_notes_order_id_idx" ON "public"."order_notes"("order_id");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "public"."order_notes"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_notes_user_id_idx" ON "public"."order_notes"("user_id");

-- CreateIndex
CREATE INDEX "receiving_logs_order_item_id_idx" ON "public"."receiving_logs"("order_item_id");

-- CreateIndex
CREATE INDEX "receiving_logs_received_by_idx" ON "public"."receiving_logs"("received_by");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_reference_key" ON "public"."goods_receipts"("reference");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "public"."goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "public"."goods_receipts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_received_at_idx" ON "public"."goods_receipts"("received_at");

-- CreateIndex
CREATE INDEX "receiving_items_goods_receipt_id_idx" ON "public"."receiving_items"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "receiving_items_order_item_id_idx" ON "public"."receiving_items"("order_item_id");

-- CreateIndex
CREATE INDEX "receiving_items_sku_id_idx" ON "public"."receiving_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "public"."templates"("name");

-- CreateIndex
CREATE INDEX "message_logs_order_id_idx" ON "public"."message_logs"("order_id");

-- CreateIndex
CREATE INDEX "message_logs_template_id_idx" ON "public"."message_logs"("template_id");

-- CreateIndex
CREATE INDEX "message_logs_channel_status_idx" ON "public"."message_logs"("channel", "status");

-- CreateIndex
CREATE INDEX "idx_message_logs_order_sent_at" ON "public"."message_logs"("order_id", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "reminders_order_id_idx" ON "public"."reminders"("order_id");

-- CreateIndex
CREATE INDEX "reminders_template_id_idx" ON "public"."reminders"("template_id");

-- CreateIndex
CREATE INDEX "reminders_scheduled_at_idx" ON "public"."reminders"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_reminders_schedule_status" ON "public"."reminders"("scheduled_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "unique_reminder_dedup" ON "public"."reminders"("order_id", "scheduled_at", "channel", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "public"."idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "public"."idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_entries_identifier_endpoint_idx" ON "public"."rate_limit_entries"("identifier", "endpoint");

-- CreateIndex
CREATE INDEX "rate_limit_entries_expires_at_idx" ON "public"."rate_limit_entries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_entries_identifier_endpoint_window_start_key" ON "public"."rate_limit_entries"("identifier", "endpoint", "window_start");

-- AddForeignKey
ALTER TABLE "public"."inbound_orders" ADD CONSTRAINT "inbound_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_billing_address_id_fkey" FOREIGN KEY ("billing_address_id") REFERENCES "public"."addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."calendar_events" ADD CONSTRAINT "calendar_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_default_supplier_id_fkey" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."skus" ADD CONSTRAINT "skus_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sku_suppliers" ADD CONSTRAINT "sku_suppliers_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sku_suppliers" ADD CONSTRAINT "sku_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."status_history" ADD CONSTRAINT "status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."status_history" ADD CONSTRAINT "status_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_notes" ADD CONSTRAINT "order_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receiving_logs" ADD CONSTRAINT "receiving_logs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receiving_logs" ADD CONSTRAINT "receiving_logs_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receiving_items" ADD CONSTRAINT "receiving_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receiving_items" ADD CONSTRAINT "receiving_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receiving_items" ADD CONSTRAINT "receiving_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_logs" ADD CONSTRAINT "message_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_logs" ADD CONSTRAINT "message_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reminders" ADD CONSTRAINT "reminders_message_log_id_fkey" FOREIGN KEY ("message_log_id") REFERENCES "public"."message_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reminders" ADD CONSTRAINT "reminders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reminders" ADD CONSTRAINT "reminders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

