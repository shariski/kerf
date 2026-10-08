CREATE TABLE "code_practice_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_profile_id" uuid NOT NULL,
	"corpus_version" integer NOT NULL,
	"snippet_id" text NOT NULL,
	"language" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"total_chars" integer NOT NULL,
	"total_errors" integer NOT NULL,
	"wpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"tab_count" integer DEFAULT 0 NOT NULL,
	"events" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_practice_sessions" ADD CONSTRAINT "code_practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_practice_sessions" ADD CONSTRAINT "code_practice_sessions_keyboard_profile_id_keyboard_profiles_id_fk" FOREIGN KEY ("keyboard_profile_id") REFERENCES "public"."keyboard_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_practice_user_profile_date_idx" ON "code_practice_sessions" USING btree ("user_id","keyboard_profile_id","started_at");