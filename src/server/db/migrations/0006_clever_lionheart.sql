CREATE TABLE "coach_quota" (
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "coach_quota_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"difficulty" text NOT NULL,
	"mechanisms" jsonb NOT NULL,
	"trigger_targets" jsonb,
	"measured_density" jsonb,
	"quality_gate" jsonb NOT NULL,
	"text" text NOT NULL,
	"word_count" integer NOT NULL,
	"paragraphs" integer NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_key" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "passage_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD CONSTRAINT "coach_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "passages_key_topic_diff_idx" ON "passages" USING btree ("target_key","topic","difficulty");--> statement-breakpoint
CREATE INDEX "passages_status_idx" ON "passages" USING btree ("status");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE set null ON UPDATE no action;