-- Create QuoteStatus enum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'CONVERTED', 'ABANDONED', 'EXPIRED', 'CANCELLED');

-- Create Quote table (POS Cart/הצעת מחיר)
CREATE TABLE "quotes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "number" VARCHAR(255) UNIQUE NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  
  -- Customer Info
  "customer_id" UUID,
  "customer_name" VARCHAR(255),
  "customer_email" VARCHAR(320),
  "customer_phone" VARCHAR(64),
  
  -- Financial Totals (cents)
  "sub_total_cents" INTEGER NOT NULL DEFAULT 0,
  "discount_cents" INTEGER NOT NULL DEFAULT 0,
  "discount_code" VARCHAR(255),
  "discount_id" UUID,
  "tax_cents" INTEGER NOT NULL DEFAULT 0,
  "shipping_cents" INTEGER NOT NULL DEFAULT 0,
  "total_cents" INTEGER NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'ILS',
  
  -- Metadata
  "notes" TEXT,
  "internal_notes" TEXT,
  "channel" "OrderChannel" NOT NULL DEFAULT 'MANUAL',
  "created_by_user_id" UUID NOT NULL,
  
  -- Conversion tracking
  "converted_to_order_id" UUID UNIQUE,
  "converted_to_lead_id" UUID UNIQUE,
  "converted_at" TIMESTAMP,
  "abandoned_at" TIMESTAMP,
  
  -- Auto-follow-up
  "follow_up_task_id" UUID UNIQUE,
  
  -- Delivery estimation
  "estimated_delivery_date" TIMESTAMP,
  
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP,
  
  CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "quotes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotes_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "quotes_converted_to_order_id_fkey" FOREIGN KEY ("converted_to_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "quotes_converted_to_lead_id_fkey" FOREIGN KEY ("converted_to_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "quotes_follow_up_task_id_fkey" FOREIGN KEY ("follow_up_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create QuoteItem table
CREATE TABLE "quote_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_id" UUID NOT NULL,
  "product_id" UUID,
  "sku" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "qty" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.17,
  "vat_category" "VatCategory" NOT NULL DEFAULT 'STANDARD',
  "discount_cents" INTEGER NOT NULL DEFAULT 0,
  "total_cents" INTEGER NOT NULL,
  
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  
  CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX "quotes_customer_id_idx" ON "quotes"("customer_id");
CREATE INDEX "quotes_status_idx" ON "quotes"("status");
CREATE INDEX "quotes_created_by_user_id_idx" ON "quotes"("created_by_user_id");
CREATE INDEX "quotes_created_at_idx" ON "quotes"("created_at");
CREATE INDEX "quotes_converted_at_idx" ON "quotes"("converted_at");
CREATE INDEX "quotes_abandoned_at_idx" ON "quotes"("abandoned_at");
CREATE INDEX "quotes_expires_at_idx" ON "quotes"("expires_at");

CREATE INDEX "quote_items_quote_id_idx" ON "quote_items"("quote_id");
CREATE INDEX "quote_items_product_id_idx" ON "quote_items"("product_id");
