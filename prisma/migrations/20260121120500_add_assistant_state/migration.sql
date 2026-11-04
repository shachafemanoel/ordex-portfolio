-- Create assistant_states table for durable assistant memory
CREATE TABLE IF NOT EXISTS "assistant_states" (
    "context_key" VARCHAR(255) NOT NULL,
    "last_action_id" TEXT,
    "last_filters" JSONB,
    "selected_order_ids" JSONB,
    "last_report_type" TEXT,
    "gemini_cache_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_states_pkey" PRIMARY KEY ("context_key")
);

CREATE INDEX IF NOT EXISTS "idx_assistant_state_updated_at" ON "assistant_states" ("updated_at");
