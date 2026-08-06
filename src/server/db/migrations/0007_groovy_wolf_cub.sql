ALTER TABLE "passages" ADD COLUMN "llm_output" jsonb;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_verdict" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_rating" smallint;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_tags" text[];--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "reviewed_at" timestamp with time zone;