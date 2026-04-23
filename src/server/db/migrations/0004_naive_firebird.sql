CREATE TABLE "session_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_value" text NOT NULL,
	"target_keys" text[] NOT NULL,
	"target_label" text NOT NULL,
	"selection_score" numeric,
	"declared_at" timestamp with time zone NOT NULL,
	"target_attempts" integer,
	"target_errors" integer,
	"target_accuracy" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_targets" ADD CONSTRAINT "session_targets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_session_targets_session" ON "session_targets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_targets_type_value" ON "session_targets" USING btree ("target_type","target_value");