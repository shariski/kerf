CREATE TABLE "bigram_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_profile_id" uuid NOT NULL,
	"bigram" text NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"total_errors" integer DEFAULT 0 NOT NULL,
	"sum_keystroke_ms" bigint DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_profile_id" uuid NOT NULL,
	"character" text NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"total_errors" integer DEFAULT 0 NOT NULL,
	"sum_keystroke_ms" bigint DEFAULT 0 NOT NULL,
	"hesitation_count" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyboard_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_type" text NOT NULL,
	"dominant_hand" text NOT NULL,
	"initial_level" text NOT NULL,
	"transition_phase" text DEFAULT 'transitioning' NOT NULL,
	"phase_changed_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keystroke_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"target_char" text NOT NULL,
	"actual_char" text NOT NULL,
	"is_error" boolean NOT NULL,
	"keystroke_ms" integer NOT NULL,
	"prev_char" text,
	"position_in_word" integer,
	"is_retype" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_profile_id" uuid,
	"mode" text NOT NULL,
	"phase_at_session" text NOT NULL,
	"filter_config" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"total_chars" integer DEFAULT 0,
	"total_errors" integer DEFAULT 0,
	"wpm" real,
	"accuracy" real
);
--> statement-breakpoint
CREATE TABLE "split_metrics_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"keyboard_profile_id" uuid NOT NULL,
	"inner_col_attempts" integer DEFAULT 0 NOT NULL,
	"inner_col_errors" integer DEFAULT 0 NOT NULL,
	"inner_col_error_rate" real,
	"thumb_cluster_count" integer DEFAULT 0 NOT NULL,
	"thumb_cluster_sum_ms" bigint DEFAULT 0 NOT NULL,
	"thumb_cluster_avg_ms" real,
	"cross_hand_bigram_count" integer DEFAULT 0 NOT NULL,
	"cross_hand_bigram_sum_ms" bigint DEFAULT 0 NOT NULL,
	"cross_hand_bigram_avg_ms" real,
	"columnar_stable_count" integer DEFAULT 0 NOT NULL,
	"columnar_drift_count" integer DEFAULT 0 NOT NULL,
	"columnar_stability_pct" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "word_corpus" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"length" integer NOT NULL,
	"characters" text[] NOT NULL,
	"bigrams" text[] NOT NULL,
	"frequency_rank" integer,
	CONSTRAINT "word_corpus_word_unique" UNIQUE("word")
);
--> statement-breakpoint
ALTER TABLE "bigram_stats" ADD CONSTRAINT "bigram_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bigram_stats" ADD CONSTRAINT "bigram_stats_keyboard_profile_id_keyboard_profiles_id_fk" FOREIGN KEY ("keyboard_profile_id") REFERENCES "public"."keyboard_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_keyboard_profile_id_keyboard_profiles_id_fk" FOREIGN KEY ("keyboard_profile_id") REFERENCES "public"."keyboard_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyboard_profiles" ADD CONSTRAINT "keyboard_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keystroke_events" ADD CONSTRAINT "keystroke_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_keyboard_profile_id_keyboard_profiles_id_fk" FOREIGN KEY ("keyboard_profile_id") REFERENCES "public"."keyboard_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_metrics_snapshots" ADD CONSTRAINT "split_metrics_snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_metrics_snapshots" ADD CONSTRAINT "split_metrics_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_metrics_snapshots" ADD CONSTRAINT "split_metrics_snapshots_keyboard_profile_id_keyboard_profiles_id_fk" FOREIGN KEY ("keyboard_profile_id") REFERENCES "public"."keyboard_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bigram_stats_unique_idx" ON "bigram_stats" USING btree ("user_id","keyboard_profile_id","bigram");--> statement-breakpoint
CREATE UNIQUE INDEX "character_stats_unique_idx" ON "character_stats" USING btree ("user_id","keyboard_profile_id","character");--> statement-breakpoint
CREATE INDEX "keystroke_events_session_seq_idx" ON "keystroke_events" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "keystroke_events_session_char_idx" ON "keystroke_events" USING btree ("session_id","target_char");--> statement-breakpoint
CREATE INDEX "split_metrics_user_profile_date_idx" ON "split_metrics_snapshots" USING btree ("user_id","keyboard_profile_id","created_at");