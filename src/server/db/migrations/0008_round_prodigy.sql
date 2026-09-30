CREATE TABLE "coach_feedback" (
	"user_id" uuid NOT NULL,
	"passage_id" uuid NOT NULL,
	"useful" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_feedback_user_id_passage_id_pk" PRIMARY KEY("user_id","passage_id")
);
--> statement-breakpoint
CREATE TABLE "coach_generation_budget" (
	"date" text PRIMARY KEY NOT NULL,
	"attempts_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "last_passage_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "prefetch_slot" integer;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "prefetch_token" uuid;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "prefetch_target_key" text;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "prefetch_passage_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD COLUMN "prefetch_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_feedback" ADD CONSTRAINT "coach_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_feedback" ADD CONSTRAINT "coach_feedback_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD CONSTRAINT "coach_quota_last_passage_id_passages_id_fk" FOREIGN KEY ("last_passage_id") REFERENCES "public"."passages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_quota" ADD CONSTRAINT "coach_quota_prefetch_passage_id_passages_id_fk" FOREIGN KEY ("prefetch_passage_id") REFERENCES "public"."passages"("id") ON DELETE set null ON UPDATE no action;