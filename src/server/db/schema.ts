import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  real,
  jsonb,
  bigserial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── keyboard_profiles ────────────────────────────────────────────────────────

export const keyboardProfiles = pgTable("keyboard_profiles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyboardType: text("keyboard_type").notNull(), // 'sofle' | 'lily58'
  dominantHand: text("dominant_hand").notNull(), // 'left' | 'right'
  initialLevel: text("initial_level").notNull(), // 'first_day' | 'few_weeks' | 'comfortable'
  transitionPhase: text("transition_phase").notNull().default("transitioning"), // 'transitioning' | 'refining'
  phaseChangedAt: timestamp("phase_changed_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyboardProfileId: uuid("keyboard_profile_id").references(
    () => keyboardProfiles.id,
  ),
  mode: text("mode").notNull(), // 'adaptive' | 'targeted_drill' | 'diagnostic'
  phaseAtSession: text("phase_at_session").notNull(), // 'transitioning' | 'refining'
  filterConfig: jsonb("filter_config"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  totalChars: integer("total_chars").default(0),
  totalErrors: integer("total_errors").default(0),
  wpm: real("wpm"),
  accuracy: real("accuracy"),
});

// ── keystroke_events ──────────────────────────────────────────────────────────

export const keystrokeEvents = pgTable(
  "keystroke_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    targetChar: text("target_char").notNull(),
    actualChar: text("actual_char").notNull(),
    isError: boolean("is_error").notNull(),
    keystrokeMs: integer("keystroke_ms").notNull(),
    prevChar: text("prev_char"),
    positionInWord: integer("position_in_word"),
    isRetype: boolean("is_retype").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("keystroke_events_session_seq_idx").on(t.sessionId, t.sequence),
    index("keystroke_events_session_char_idx").on(t.sessionId, t.targetChar),
  ],
);

// ── character_stats ───────────────────────────────────────────────────────────

export const characterStats = pgTable(
  "character_stats",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyboardProfileId: uuid("keyboard_profile_id")
      .notNull()
      .references(() => keyboardProfiles.id, { onDelete: "cascade" }),
    character: text("character").notNull(),
    totalAttempts: integer("total_attempts").notNull().default(0),
    totalErrors: integer("total_errors").notNull().default(0),
    sumKeystrokeMs: bigint("sum_keystroke_ms", { mode: "number" })
      .notNull()
      .default(0),
    hesitationCount: integer("hesitation_count").notNull().default(0),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("character_stats_unique_idx").on(
      t.userId,
      t.keyboardProfileId,
      t.character,
    ),
  ],
);

// ── bigram_stats ──────────────────────────────────────────────────────────────

export const bigramStats = pgTable(
  "bigram_stats",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyboardProfileId: uuid("keyboard_profile_id")
      .notNull()
      .references(() => keyboardProfiles.id, { onDelete: "cascade" }),
    bigram: text("bigram").notNull(),
    totalAttempts: integer("total_attempts").notNull().default(0),
    totalErrors: integer("total_errors").notNull().default(0),
    sumKeystrokeMs: bigint("sum_keystroke_ms", { mode: "number" })
      .notNull()
      .default(0),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bigram_stats_unique_idx").on(
      t.userId,
      t.keyboardProfileId,
      t.bigram,
    ),
  ],
);

// ── split_metrics_snapshots ───────────────────────────────────────────────────

export const splitMetricsSnapshots = pgTable(
  "split_metrics_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyboardProfileId: uuid("keyboard_profile_id")
      .notNull()
      .references(() => keyboardProfiles.id, { onDelete: "cascade" }),
    // Metric 1: Inner column error rate (B, G, H, N, T, Y)
    innerColAttempts: integer("inner_col_attempts").notNull().default(0),
    innerColErrors: integer("inner_col_errors").notNull().default(0),
    innerColErrorRate: real("inner_col_error_rate"),
    // Metric 2: Thumb cluster decision time
    thumbClusterCount: integer("thumb_cluster_count").notNull().default(0),
    thumbClusterSumMs: bigint("thumb_cluster_sum_ms", { mode: "number" })
      .notNull()
      .default(0),
    thumbClusterAvgMs: real("thumb_cluster_avg_ms"),
    // Metric 3: Cross-hand bigram timing
    crossHandBigramCount: integer("cross_hand_bigram_count")
      .notNull()
      .default(0),
    crossHandBigramSumMs: bigint("cross_hand_bigram_sum_ms", {
      mode: "number",
    })
      .notNull()
      .default(0),
    crossHandBigramAvgMs: real("cross_hand_bigram_avg_ms"),
    // Metric 4: Columnar stability (inferred from error patterns)
    columnarStableCount: integer("columnar_stable_count").notNull().default(0),
    columnarDriftCount: integer("columnar_drift_count").notNull().default(0),
    columnarStabilityPct: real("columnar_stability_pct"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("split_metrics_user_profile_date_idx").on(
      t.userId,
      t.keyboardProfileId,
      t.createdAt,
    ),
  ],
);

// ── word_corpus ───────────────────────────────────────────────────────────────

export const wordCorpus = pgTable("word_corpus", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  word: text("word").notNull().unique(),
  length: integer("length").notNull(),
  characters: text("characters").array().notNull(),
  bigrams: text("bigrams").array().notNull(),
  frequencyRank: integer("frequency_rank"),
});

// ── auth_sessions (better-auth internal) ─────────────────────────────────────
export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// ── auth_accounts (better-auth internal) ─────────────────────────────────────
export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// ── auth_verifications (better-auth internal — magic link tokens) ─────────────
export const authVerifications = pgTable("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
