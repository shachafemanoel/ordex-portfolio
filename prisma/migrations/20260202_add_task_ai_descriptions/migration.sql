-- Add AI-generated Hebrew description fields to Task model
ALTER TABLE "tasks" ADD COLUMN "ai_title_he" VARCHAR(100);
ALTER TABLE "tasks" ADD COLUMN "ai_summary_he" VARCHAR(300);
ALTER TABLE "tasks" ADD COLUMN "ai_generated_at" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN "ai_model" VARCHAR(50);
ALTER TABLE "tasks" ADD COLUMN "ai_prompt_version" VARCHAR(20);
ALTER TABLE "tasks" ADD COLUMN "ai_failed_reason" TEXT;

-- Create index for efficient filtering by AI generation status
CREATE INDEX "tasks_ai_generated_at_idx" ON "tasks"("ai_generated_at");
