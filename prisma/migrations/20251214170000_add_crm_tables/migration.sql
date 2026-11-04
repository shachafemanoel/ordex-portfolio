-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_SHOW', 'PARTNER', 'ADVERTISING', 'ORGANIC', 'SOCIAL_MEDIA', 'EMAIL_CAMPAIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONVERTED', 'LOST', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'NEEDS_ANALYSIS', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'WHATSAPP', 'SMS', 'DEMO', 'PRESENTATION');

-- CreateEnum
CREATE TYPE "ActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'MULTI_CHANNEL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerLifecycle" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER', 'VIP', 'CHAMPION', 'AT_RISK', 'CHURNED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable Customer - Add CRM fields
ALTER TABLE "customers" ADD COLUMN "lifecycle" "CustomerLifecycle" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "customers" ADD COLUMN "health_score" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "customers" ADD COLUMN "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW';
ALTER TABLE "customers" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "customers" ADD COLUMN "segment" TEXT;
ALTER TABLE "customers" ADD COLUMN "primary_contact_id" UUID;
ALTER TABLE "customers" ADD COLUMN "account_manager_id" UUID;
ALTER TABLE "customers" ADD COLUMN "website" TEXT;
ALTER TABLE "customers" ADD COLUMN "industry" TEXT;
ALTER TABLE "customers" ADD COLUMN "company_size" TEXT;
ALTER TABLE "customers" ADD COLUMN "linkedin_url" TEXT;
ALTER TABLE "customers" ADD COLUMN "ai_churn_probability" DOUBLE PRECISION;
ALTER TABLE "customers" ADD COLUMN "ai_next_best_action" TEXT;
ALTER TABLE "customers" ADD COLUMN "ai_sentiment" TEXT;
ALTER TABLE "customers" ADD COLUMN "ai_lifetime_value" INTEGER;
ALTER TABLE "customers" ADD COLUMN "last_activity_at" TIMESTAMP(3);

-- CreateTable Lead
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(64),
    "company" TEXT,
    "job_title" TEXT,
    "budget_cents" INTEGER,
    "timeline" TEXT,
    "pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_user_id" UUID,
    "owner_id" UUID,
    "ai_score" INTEGER,
    "ai_notes" TEXT,
    "next_best_action" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "customer_id" UUID,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable Contact
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(64),
    "mobile" VARCHAR(64),
    "job_title" TEXT,
    "department" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_decision_maker" BOOLEAN NOT NULL DEFAULT false,
    "preferred_channel" TEXT,
    "timezone" TEXT,
    "linkedin_url" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable Deal
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'PROSPECTING',
    "value_cents" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "customer_id" UUID,
    "lead_id" UUID,
    "owner_id" UUID NOT NULL,
    "expected_close_date" TIMESTAMP(3),
    "actual_close_date" TIMESTAMP(3),
    "ai_win_probability" INTEGER,
    "ai_risk_factors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_next_steps" TEXT,
    "lost_reason" TEXT,
    "competitor_name" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable Activity
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "direction" "ActivityDirection",
    "status" "ActivityStatus" NOT NULL DEFAULT 'SCHEDULED',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "outcome" TEXT,
    "customer_id" UUID,
    "lead_id" UUID,
    "deal_id" UUID,
    "contact_id" UUID,
    "user_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "ai_sentiment" TEXT,
    "ai_summary" TEXT,
    "ai_action_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable Campaign
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "segment_id" UUID,
    "target_filters" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_delivered" INTEGER NOT NULL DEFAULT 0,
    "total_opened" INTEGER NOT NULL DEFAULT 0,
    "total_clicked" INTEGER NOT NULL DEFAULT 0,
    "total_replied" INTEGER NOT NULL DEFAULT 0,
    "total_converted" INTEGER NOT NULL DEFAULT 0,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable CampaignMessage
CREATE TABLE "campaign_messages" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable Segment
CREATE TABLE "segments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_rationale" TEXT,
    "customer_count" INTEGER NOT NULL DEFAULT 0,
    "last_calculated_at" TIMESTAMP(3),
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerSegment
CREATE TABLE "customer_segments" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerNote
CREATE TABLE "customer_notes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable DealProduct
CREATE TABLE "deal_products" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable DealNote
CREATE TABLE "deal_notes" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable LeadTag
CREATE TABLE "lead_tags" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_customer_id_key" ON "leads"("customer_id");
CREATE INDEX "leads_source_idx" ON "leads"("source");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_score_idx" ON "leads"("score");
CREATE INDEX "leads_assigned_user_id_idx" ON "leads"("assigned_user_id");
CREATE INDEX "leads_owner_id_idx" ON "leads"("owner_id");
CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_phone_idx" ON "leads"("phone");
CREATE INDEX "leads_converted_at_idx" ON "leads"("converted_at");
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "contacts_customer_id_idx" ON "contacts"("customer_id");
CREATE INDEX "contacts_email_idx" ON "contacts"("email");
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");
CREATE INDEX "contacts_is_primary_idx" ON "contacts"("is_primary");

-- CreateIndex
CREATE INDEX "deals_customer_id_idx" ON "deals"("customer_id");
CREATE INDEX "deals_lead_id_idx" ON "deals"("lead_id");
CREATE INDEX "deals_owner_id_idx" ON "deals"("owner_id");
CREATE INDEX "deals_stage_idx" ON "deals"("stage");
CREATE INDEX "deals_expected_close_date_idx" ON "deals"("expected_close_date");
CREATE INDEX "deals_created_at_idx" ON "deals"("created_at");

-- CreateIndex
CREATE INDEX "activities_customer_id_idx" ON "activities"("customer_id");
CREATE INDEX "activities_lead_id_idx" ON "activities"("lead_id");
CREATE INDEX "activities_deal_id_idx" ON "activities"("deal_id");
CREATE INDEX "activities_contact_id_idx" ON "activities"("contact_id");
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");
CREATE INDEX "activities_type_idx" ON "activities"("type");
CREATE INDEX "activities_status_idx" ON "activities"("status");
CREATE INDEX "activities_scheduled_at_idx" ON "activities"("scheduled_at");
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- CreateIndex
CREATE INDEX "campaigns_type_idx" ON "campaigns"("type");
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");
CREATE INDEX "campaigns_segment_id_idx" ON "campaigns"("segment_id");
CREATE INDEX "campaigns_scheduled_at_idx" ON "campaigns"("scheduled_at");
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at");

-- CreateIndex
CREATE INDEX "campaign_messages_campaign_id_idx" ON "campaign_messages"("campaign_id");
CREATE INDEX "campaign_messages_customer_id_idx" ON "campaign_messages"("customer_id");
CREATE INDEX "campaign_messages_status_idx" ON "campaign_messages"("status");

-- CreateIndex
CREATE INDEX "segments_customer_count_idx" ON "segments"("customer_count");
CREATE INDEX "segments_created_at_idx" ON "segments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_segments_customer_id_segment_id_key" ON "customer_segments"("customer_id", "segment_id");
CREATE INDEX "customer_segments_customer_id_idx" ON "customer_segments"("customer_id");
CREATE INDEX "customer_segments_segment_id_idx" ON "customer_segments"("segment_id");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");
CREATE INDEX "customer_notes_user_id_idx" ON "customer_notes"("user_id");
CREATE INDEX "customer_notes_created_at_idx" ON "customer_notes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "deal_products_deal_id_product_id_key" ON "deal_products"("deal_id", "product_id");
CREATE INDEX "deal_products_deal_id_idx" ON "deal_products"("deal_id");
CREATE INDEX "deal_products_product_id_idx" ON "deal_products"("product_id");

-- CreateIndex
CREATE INDEX "deal_notes_deal_id_idx" ON "deal_notes"("deal_id");
CREATE INDEX "deal_notes_user_id_idx" ON "deal_notes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_lead_id_tag_key" ON "lead_tags"("lead_id", "tag");
CREATE INDEX "lead_tags_lead_id_idx" ON "lead_tags"("lead_id");
CREATE INDEX "lead_tags_tag_idx" ON "lead_tags"("tag");

-- CreateIndex on customers for new CRM fields
CREATE INDEX "customers_lifecycle_idx" ON "customers"("lifecycle");
CREATE INDEX "customers_health_score_idx" ON "customers"("health_score");
CREATE INDEX "customers_risk_level_idx" ON "customers"("risk_level");
CREATE INDEX "customers_account_manager_id_idx" ON "customers"("account_manager_id");
CREATE INDEX "customers_last_activity_at_idx" ON "customers"("last_activity_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_products" ADD CONSTRAINT "deal_products_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_products" ADD CONSTRAINT "deal_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_notes" ADD CONSTRAINT "deal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
