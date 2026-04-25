# kerf: Technical Architecture

> Companion to 01-product-spec.md (v0.5 — deliberate-practice architecture)
> Status: v0.3 — phase- and journey-aware
> Last updated: 2026-04-22
> Major revision (v0.3): ADR-003 accepted. Added `finger_assignment` column on `keyboard_profiles`, new `session_targets` table, new §4.2 Target Selection engine layer, journey-aware weakness scoring (`JOURNEY_BONUSES`), `generateSession` wrapper, new modules `targetSelection.ts` / `motionPatterns.ts` / `drillLibrary.ts`. Existing §4.2–§4.6 renumbered to §4.3–§4.7. See `docs/00-design-evolution.md` ADR-003.
> Prior revisions: v0.2 (transition-phase aware, 2026-04-18).
> Audience: the developer (you) building this with Claude Code

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Client                    │
│  ┌─────────────────────────────────────────────┐   │
│  │           UI Layer (React + Tailwind)        │   │
│  ├─────────────────────────────────────────────┤   │
│  │     State Management (Zustand stores)        │   │
│  ├─────────────────────────────────────────────┤   │
│  │  Domain Logic (pure TS, framework-agnostic)  │   │
│  │  - Adaptive Engine                           │   │
│  │  - Finger Assignment Resolver                │   │
│  │  - Exercise Generator                        │   │
│  │  - Statistics Calculator                     │   │
│  ├─────────────────────────────────────────────┤   │
│  │       API Client (typed fetch wrapper)       │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│           Server (Tanstack Start)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │      API Routes (REST or tRPC-style)         │   │
│  ├─────────────────────────────────────────────┤   │
│  │           Auth (better-auth).                │   │
│  ├─────────────────────────────────────────────┤   │
│  │       Repository Layer (Drizzle ORM)         │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │ PostgreSQL  │
              └─────────────┘
```

**Architectural principles:**

- Domain logic stays decoupled from any framework (testable, swappable)
- The adaptive engine is composed of pure functions that can be tested in isolation
- The server stays thin: mostly CRUD + auth, with business logic on the client (lightens server load, fine here because each user is single-tenant)

**Stack notes (locked 2026-04-18):**

- **Tanstack Start** was chosen over Next.js because the app is small, logic is
  client-heavy, and Vite's fast DX serves the tight iteration loop better. The
  server is intentionally thin — most client-server communication happens via
  `createServerFn()` (RPC-style), not manual REST.
- **better-auth** was chosen because lucia was deprecated into a learning resource
  by its author in late 2024. better-auth has a native Drizzle adapter and built-in
  support for magic link + OAuth, which covers the auth needs in product spec §5.8.
- **Routing**: file-based via Tanstack Router under `src/routes/`. Type-safe search
  params and loaders are built-in. The module layout in §5 reflects this.

## 2. Data Model (PostgreSQL)

### users

```sql
id              uuid PRIMARY KEY
email           text UNIQUE NOT NULL
created_at      timestamptz NOT NULL DEFAULT now()
display_name    text
```

### keyboard_profiles

```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_type       text NOT NULL  -- 'sofle' | 'lily58'
dominant_hand       text NOT NULL  -- 'left' | 'right'
initial_level       text NOT NULL  -- 'first_day' | 'few_weeks' | 'comfortable' (at onboarding)
transition_phase    text NOT NULL DEFAULT 'transitioning'  -- 'transitioning' | 'refining'
phase_changed_at    timestamptz                           -- when phase last changed (null = never changed)
finger_assignment   text                                  -- 'conventional' | 'columnar' | 'unsure' | NULL (pre-ADR-003 users)
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL DEFAULT now()
```

**Phase semantics:**

- `transitioning`: user still building columnar muscle memory. Engine weights columnar-specific pain points heavier, exercises are shorter, copy emphasizes "building new habits". Initial phase derived from `initial_level`: `first_day` and `few_weeks` → `transitioning`; `comfortable` → `refining`.
- `refining`: user past the transition struggle, now polishing speed and flow. Engine uses pure weakness profile, standard exercise length, copy shifts to peer tone.
- Phase changes triggered by: (a) user manually toggles in settings; (b) platform suggests change when stable accuracy >95% for 10+ sessions OR when user returns from 2+ weeks away (may have regressed).

**Journey semantics** (ADR-003 §2):

- `conventional`: fingers reach diagonally as on QWERTY; F and J home. Primary pain = vertical motion per column. Target Selection promotes vertical-column targets; `VERTICAL_REACH_BONUS` applies in weakness score.
- `columnar`: each finger on its own column; user has retrained. Primary pain = inner-column reach (B/G/T, H/N/Y are new territory). Target Selection promotes inner-column targets; `INNER_COLUMN_BONUS` applies.
- `unsure`: defaults to `conventional` behavior; flag preserved for Phase B inferred-style diagnostic.
- `NULL`: pre-ADR-003 users without a captured journey. One-time selection card before `/practice` on next login; then persists.
- Journey is a profile-level property (not session-level). Changeable via Settings.

### sessions

```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_profile_id uuid REFERENCES keyboard_profiles(id)
mode                text NOT NULL  -- 'adaptive' | 'targeted_drill' | 'diagnostic'
phase_at_session    text NOT NULL  -- 'transitioning' | 'refining' (snapshot for historical analysis)
filter_config       jsonb          -- { hand_isolation: 'left' | 'right' | null, max_length: int }
started_at          timestamptz NOT NULL
ended_at            timestamptz
total_chars         integer DEFAULT 0
total_errors        integer DEFAULT 0
wpm                 real
accuracy            real
```

**Note on `phase_at_session`**: this snapshots which phase the user was in when the session happened. Important because engine behavior differs by phase, and we want to compare "my transitioning-phase performance" vs "my refining-phase performance" without mutating historical data when the user switches phases.

### session_targets (ADR-003 §5)

One row per session in Phase A (1:1 with `sessions`). Table structure does not enforce 1:1 — it permits Phase B multi-target sessions without a migration.

```sql
id                  uuid PRIMARY KEY
session_id          uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE

-- What was declared (at session start)
target_type         text NOT NULL         -- see SessionTarget.type in §4.2
target_value        text NOT NULL         -- e.g. 'G', 'th', 'left-ring', 'left'
target_keys         text[] NOT NULL       -- actual keys involved (powers post-session per-key breakdown)
target_label        text NOT NULL         -- human-readable (e.g. 'Left-ring column vertical reach')
selection_score     numeric               -- engine score × journey weight; NULL for user-picked (drill mode)
declared_at         timestamptz NOT NULL

-- Measured outcome (filled at session end)
target_attempts     integer               -- keystroke count on target_keys
target_errors       integer
target_accuracy     real                  -- 0–1; NULL until session_ends

created_at          timestamptz NOT NULL DEFAULT now()
```

Indexes:

```sql
CREATE INDEX idx_session_targets_session ON session_targets(session_id);
CREATE INDEX idx_session_targets_type_value ON session_targets(target_type, target_value);
```

**Rationale for separate table (not a JSONB column on `sessions`):** target history is queryable (powers soft next-target preview and dashboard target-history panel), indexable by type+value for future analysis, and keeps sessions table stable. Historical sessions (pre-ADR-003) have no row here — post-session intent-echo block simply doesn't render for those.

**Target-performance capture at session time:**

- **During session:** `useKeystrokeCapture` already captures every keystroke with correct/incorrect flag. An accumulator in `sessionStore` increments `target_attempts` (and `target_errors`) each time a keystroke's character falls in `target_keys`. Client-side only; no network round-trip per keystroke.
- **At session end:** accumulated counts persisted as part of the existing `persistSession` transaction. Single write, no new round-trip.

### keystroke_events

```sql
id               bigserial PRIMARY KEY
session_id       uuid REFERENCES sessions(id) ON DELETE CASCADE
sequence         integer NOT NULL  -- order within session
target_char      text NOT NULL
actual_char      text NOT NULL
is_error         boolean NOT NULL
keystroke_ms     integer NOT NULL  -- time since previous keypress
prev_char        text             -- previous character, for bigram context
position_in_word integer
is_retype        boolean NOT NULL DEFAULT false
created_at       timestamptz NOT NULL DEFAULT now()

INDEX(session_id, sequence)
INDEX(session_id, target_char)
```

**Note:** keystroke_events can grow large. For MVP, leave as-is and monitor. If it becomes an issue, archive to aggregated stats after X days.

### character_stats (denormalized, per user)

```sql
id                  bigserial PRIMARY KEY
user_id             uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_profile_id uuid REFERENCES keyboard_profiles(id)
character           text NOT NULL
total_attempts      integer NOT NULL DEFAULT 0
total_errors        integer NOT NULL DEFAULT 0
sum_keystroke_ms    bigint NOT NULL DEFAULT 0
hesitation_count    integer NOT NULL DEFAULT 0
last_updated        timestamptz NOT NULL DEFAULT now()

UNIQUE(user_id, keyboard_profile_id, character)
```

### bigram_stats (denormalized, per user)

```sql
id                  bigserial PRIMARY KEY
user_id             uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_profile_id uuid REFERENCES keyboard_profiles(id)
bigram              text NOT NULL  -- 2 characters
total_attempts      integer NOT NULL DEFAULT 0
total_errors        integer NOT NULL DEFAULT 0
sum_keystroke_ms    bigint NOT NULL DEFAULT 0
last_updated        timestamptz NOT NULL DEFAULT now()

UNIQUE(user_id, keyboard_profile_id, bigram)
```

**Note:** stats tables are updated at the end of each session, not on every keystroke. Trade-off: data is slightly stale, but performance is much better.

### split_metrics_snapshots (denormalized, per session)

Stores the 4 split-specific metrics computed at the end of each session. Historical snapshots enable trend charts on the dashboard.

```sql
id                       bigserial PRIMARY KEY
session_id               uuid REFERENCES sessions(id) ON DELETE CASCADE
user_id                  uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_profile_id      uuid REFERENCES keyboard_profiles(id)

-- Metric 1: Inner column error rate (B, G, H, N, T, Y)
inner_col_attempts       integer NOT NULL DEFAULT 0
inner_col_errors         integer NOT NULL DEFAULT 0
inner_col_error_rate     real   -- computed: errors / attempts

-- Metric 2: Thumb cluster decision time
-- (time between finishing previous key and pressing any thumb-assigned key)
thumb_cluster_count      integer NOT NULL DEFAULT 0
thumb_cluster_sum_ms     bigint NOT NULL DEFAULT 0
thumb_cluster_avg_ms     real   -- computed: sum / count

-- Metric 3: Cross-hand bigram timing
-- (bigrams spanning both hands, e.g., 'th', 'he', 'in')
cross_hand_bigram_count  integer NOT NULL DEFAULT 0
cross_hand_bigram_sum_ms bigint NOT NULL DEFAULT 0
cross_hand_bigram_avg_ms real

-- Metric 4: Columnar stability (inferred, see caveat below)
-- Count of keypresses that pattern-match "likely wrong finger used" based on error type
columnar_stable_count    integer NOT NULL DEFAULT 0
columnar_drift_count     integer NOT NULL DEFAULT 0
columnar_stability_pct   real

created_at               timestamptz NOT NULL DEFAULT now()

INDEX(user_id, keyboard_profile_id, created_at)
```

**Honest caveat on Metric 4 (columnar stability):**

Metric 4 is inferred, not directly measured. The browser cannot detect which physical finger was used. What we CAN observe:

- If a user targeting 'B' types 'V' → likely the left-index finger slid to the adjacent column (columnar drift)
- If a user targeting 'B' types 'N' → likely the user used the wrong hand entirely (QWERTY muscle memory)
- If a user targeting 'B' types a random other letter → probably not a finger-column issue

We compute columnar_drift as a heuristic: errors where the typed character is in a column adjacent to the target column in the same hand. Accuracy of this inference is moderate. Treat the metric as directional, not absolute.

Metrics 1-3 are directly measurable from keystroke_events without inference.

### word_corpus

```sql
id              bigserial PRIMARY KEY
word            text NOT NULL UNIQUE
length          integer NOT NULL
characters      text[] NOT NULL  -- array of unique chars
bigrams         text[] NOT NULL  -- array of bigrams
frequency_rank  integer          -- ranking from English corpus (lower = more common)
```

Pre-populated with an English wordlist (5000–10000 common words). Static data, bundled with the app or seeded at deploy time.

## 3. Finger Assignment Tables

Hardcoded as constants. Each layout has a mapping `(layer, row, col) → (hand, finger)`.

```typescript
// finger.ts
type Hand = "left" | "right";
type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

type KeyAssignment = {
  hand: Hand;
  finger: Finger;
  // physical position in the grid layout
  row: number;
  col: number;
};

// Sofle layout: 6 cols per side, 5 rows (4 main + 1 thumb)
const SOFLE_BASE_LAYER: Record<string, KeyAssignment> = {
  // Row 0 (top)
  "1": { hand: "left", finger: "pinky", row: 0, col: 0 },
  "2": { hand: "left", finger: "ring", row: 0, col: 1 },
  // ... etc

  // Row 2 (home row)
  a: { hand: "left", finger: "pinky", row: 2, col: 0 },
  s: { hand: "left", finger: "ring", row: 2, col: 1 },
  // ... etc
};

const LILY58_BASE_LAYER: Record<string, KeyAssignment> = {
  // Similar structure
};
```

The full mapping for Sofle and Lily58 must be sourced from official specs or your own experience. This will be one of the early tasks. As an active Sofle and Lily58 user, you are the best ground-truth reviewer for these tables.

## 4. Adaptive Engine: Algorithm Detail

### 4.1 Weakness Score Computation (Phase- and Journey-Aware)

The weakness score formula branches on two axes: **phase** (`transitioning` | `refining`) and **journey** (`conventional` | `columnar` | `unsure`). Phase controls the coefficient mix (errors heavy in transition, hesitation/slowness in refining). Journey controls which character classes get a bonus — conventional-mapping users get a vertical-reach bonus, strict-columnar users get an inner-column bonus. Both bonuses apply in `transitioning` phase only; in `refining` phase the pure weakness profile takes over. See ADR-003 §2 & §5.

```typescript
type TransitionPhase = "transitioning" | "refining";
type JourneyCode = "conventional" | "columnar" | "unsure";

// Phase-specific coefficients (ADR-003 §6 Option C: hand-tuned starting values;
// transparency panel states this honestly; revisit with beta feedback).
const COEFFICIENTS = {
  transitioning: {
    ALPHA: 0.6, // error weight — heavy during transition
    BETA: 0.2, // hesitation weight
    GAMMA: 0.1, // slowness weight — less important early on
    DELTA: 0.1, // frequency penalty
  },
  refining: {
    ALPHA: 0.3, // error weight — errors less informative when user is already accurate
    BETA: 0.35, // hesitation weight — fluency matters now
    GAMMA: 0.25, // slowness weight — speed matters now
    DELTA: 0.1, // frequency penalty
  },
};

// Journey-specific bonuses (ADR-003 §2, §5). Applied only in 'transitioning'
// phase. `unsure` mirrors `conventional` (lower-friction default for QWERTY
// converts; flag preserved for Phase B inferred-style diagnostic).
const JOURNEY_BONUSES = {
  conventional: {
    INNER_COLUMN_BONUS: 0, // not the pain point for QWERTY-mapping users
    VERTICAL_REACH_BONUS: 0.3, // row-staggered → columnar vertical motion
  },
  columnar: {
    INNER_COLUMN_BONUS: 0.3, // B/G/T, H/N/Y are new finger territory
    VERTICAL_REACH_BONUS: 0, // less primary for strict-columnar users
  },
  unsure: {
    INNER_COLUMN_BONUS: 0,
    VERTICAL_REACH_BONUS: 0.3,
  },
};

function computeWeaknessScore(
  unit: CharacterStat | BigramStat,
  userBaseline: UserBaseline,
  phase: TransitionPhase,
  journey: JourneyCode,
): number {
  const errorRate = unit.errors / Math.max(unit.attempts, 1);
  const meanTime = unit.sumTime / Math.max(unit.attempts, 1);
  const hesitationRate =
    (unit.hesitationCount ?? 0) / Math.max(unit.attempts, 1);

  const normalizedError = errorRate / userBaseline.meanErrorRate;
  const normalizedSlowness = meanTime / userBaseline.meanKeystrokeTime;
  const normalizedHesitation = hesitationRate / userBaseline.meanHesitationRate;

  const frequencyPenalty = unit.frequencyInLanguage; // 0–1, normalized

  const c = COEFFICIENTS[phase];
  const j = JOURNEY_BONUSES[journey];

  // Journey bonus applies only in transitioning phase. Which character classes
  // get the bonus depends on journey (see JOURNEY_BONUSES above).
  const INNER_COLUMN = new Set(["b", "g", "h", "n", "t", "y"]);
  const ch = unit.character?.toLowerCase();
  const isInnerColumn = ch !== undefined && INNER_COLUMN.has(ch);
  const isVerticalReach = isOffHomeRow(unit); // row 1 (top) or row 3 (bottom) on the user's layout

  const journeyBonus =
    phase === "transitioning"
      ? (isInnerColumn ? j.INNER_COLUMN_BONUS : 0) +
        (isVerticalReach ? j.VERTICAL_REACH_BONUS : 0)
      : 0;

  // Evidence weight: attenuate observed-performance terms by sample size.
  // Structural priors (frequency penalty, journey bonus) are NOT attenuated.
  const CONFIDENCE_WEIGHT_K = 10;
  const w = unit.attempts / (unit.attempts + CONFIDENCE_WEIGHT_K);

  return (
    w *
      (c.ALPHA * normalizedError +
        c.BETA * normalizedHesitation +
        c.GAMMA * normalizedSlowness) -
    c.DELTA * frequencyPenalty +
    journeyBonus
  );
}
```

**Confidence-weighting low-sample units.** Raw `errors / attempts`
ratios on small samples are pure noise: a bigram with 3 attempts and
2 errors shows 67% error rate, which under a plain formula would
outrank a well-measured bigram at 15% error over 500 attempts purely
because `0.67 > 0.15`. The multiplier `w = n / (n + K)` (with
`K = CONFIDENCE_WEIGHT_K = 10`) pulls thin evidence toward "don't
trust this as a weakness signal yet" without throwing it away:

- `n=3`   → `w = 0.23` (a barely-observed unit contributes 23% of its full score)
- `n=40`  → `w = 0.80`
- `n=500` → `w = 0.98` (essentially unattenuated)

Only the error/hesitation/slowness terms are attenuated — these are
observed-performance signals. The frequency penalty and the journey
bonus are structural priors (a property of English text and of the
user's chosen layout style), independent of how often this user has
typed the unit, so they keep their full weight regardless of sample
size. This matters for cold-start new-users: an inner-column char
the user hasn't typed yet still carries its full journey bonus,
correctly surfacing it for practice.

The dashboard transparency panel shows raw observed rates (e.g. "you
observed 60% error over 3 attempts") unchanged — the attenuation
applies to the `contribution` and `total` values, not the raw/baseline/
normalized fields. `computeWeaknessBreakdown` exposes `confidenceWeight`
on its return type so the UI can surface the multiplier.

**Edge cases to handle:**

- Units with attempts < 5: low confidence, callers should exclude them from ranking. (The confidence weight additionally attenuates anything between 5 and ~20 attempts without requiring a hard cutoff.)
- Cold start (new user in 'transitioning' phase): use default baseline (mean error rate 8%, mean keystroke 280ms — calibrated higher than comfortable-user baseline)
- Cold start for 'refining' user: use lower baseline (mean error rate 3%, mean keystroke 180ms)
- Decay: discount events older than 30 days
- Phase switching: when user switches phase, keep their stats but recompute baseline for the new phase's defaults. Do NOT reset historical stats.

### 4.2 Target Selection (ADR-003)

**New engine layer.** Given current stats, phase, and journey, picks this session's target. Feeds into exercise generation (§4.3 for character/bigram targets; drill-library lookup for motion-pattern targets).

```
┌──────────────────┐
│ Weakness scoring │  (§4.1 — per character / bigram)
└────────┬─────────┘
         ↓
┌────────────────────┐
│ Target Selection   │  (§4.2 — picks this session's target)
└────────┬───────────┘
         ↓
┌──────────────────────────────────────┐
│ Exercise generation                  │
│  character/bigram → word-picker      │  (§4.3)
│  motion/column   → drill library     │  (§4.4 / lookup)
└──────────────────────────────────────┘
```

**Candidate types:**

| Candidate | Score derivation |
|---|---|
| `character` | `computeWeaknessScore(charStat, baseline, phase, journey)`; highest-scoring char wins |
| `bigram` | `computeWeaknessScore(bigramStat, baseline, phase, journey)`; highest-scoring bigram (includes cross-hand bigrams) |
| `vertical-column` | Aggregate error rate across the 3 keys in a column (top/home/bottom), normalized against baseline. 10 candidates (5 columns × 2 hands); best one wins |
| `inner-column` | Aggregate error rate across B/G/T (left) or H/N/Y (right), normalized. 2 candidates |
| `thumb-cluster` | Space-key error rate (Phase A MVP — enter/backspace deferred). Above threshold → eligible |

Hand-isolation and cross-hand-bigram are **drill-mode-only** targets (user-initiated, not engine-selected). Hand-isolation weakness is too diffuse to diagnose automatically; cross-hand bigrams are already represented in the bigram candidate path.

**Journey-aware selection weighting:**

```typescript
type TargetType =
  | "character"
  | "bigram"
  | "vertical-column"
  | "inner-column"
  | "thumb-cluster"
  | "hand-isolation"
  | "cross-hand-bigram"
  | "diagnostic";

type SessionTarget = {
  type: TargetType;
  value: string;           // e.g. 'G', 'th', 'left-ring', 'left'
  keys: string[];          // actual keys involved (powers ribbon + SVG outline + post-session breakdown)
  label: string;           // human-readable (e.g. 'Left-ring column vertical reach')
  score?: number;          // debugging/transparency; null for user-picked (drill mode)
};

// ADR-003 §5: weights are hand-tuned starting values; transparency panel
// states this honestly; revisit with beta feedback.
const TARGET_JOURNEY_WEIGHTS = {
  conventional: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.2, // promoted — primary pain
    "inner-column": 0.6,    // demoted — not the pain point
    "thumb-cluster": 1.0,
  },
  columnar: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.5,  // boosted — split motions surface often enough to matter
    "inner-column": 1.8,     // promoted — primary pain, strongest boost
    "thumb-cluster": 1.5,    // boosted — split-exclusive motion
  },
  unsure: {
    // mirrors conventional
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.2,
    "inner-column": 0.6,
    "thumb-cluster": 1.0,
  },
};

function selectTarget(
  stats: UserStats,
  baseline: UserBaseline,
  phase: TransitionPhase,
  journey: JourneyCode,
): SessionTarget {
  if (isLowConfidence(stats)) {
    return diagnosticTarget(); // Template V7 briefing; covers first sessions / cold start
  }

  const candidates = [
    ...characterCandidates(stats, baseline, phase, journey),
    ...bigramCandidates(stats, baseline, phase, journey),
    ...verticalColumnCandidates(stats, baseline),
    ...innerColumnCandidates(stats, baseline),
    thumbClusterCandidate(stats, baseline),
  ].filter(Boolean);

  const weights = TARGET_JOURNEY_WEIGHTS[journey];
  return candidates.reduce((best, c) =>
    (c.score ?? 0) * weights[c.type] > (best.score ?? 0) * weights[best.type] ? c : best,
  );
}
```

**Low-confidence fallback.** `isLowConfidence(stats)` from current weakness logic → default target = `diagnostic` (Template V7 briefing — "Capturing your baseline"). Covers first sessions and cold-start scenarios.

**Prior-weakness floor for unseen characters (`UNSEEN_CHARACTER_WEAKNESS_FLOOR`, Path 1).** A philosophical inversion to the default frequentist "no data → not rankable" rule. For any character that's in the loaded corpus (`corpusCharSupport > 0`) but doesn't yet have `LOW_CONFIDENCE_THRESHOLD` confident attempts, the engine injects a synthetic candidate with a fixed prior weakness score (currently 0.5). Effect: unseen letters surface as targets early instead of being invisible to the ranker. Once a letter accumulates real attempts, the computed weakness score takes over and the prior no longer applies.

The model treats unfamiliarity itself as a kind of weakness — a coach should serve `q` early to find out whether the user can handle it, not wait for evidence of `q`-failure that can never come if `q` is never asked. The same `corpusCharSupport` map already used for the char-support exclusion (above) is reused as the source of "what letters does the user-facing corpus contain"; chars with support 0 are still excluded (drill-key cross-layer guard takes precedence over the prior). Path-2 ADR-005 would generalize this to a full Bayesian mastery model across characters, bigrams, and motion targets; Path 1 is the minimal version scoped to characters only.

**Periodic re-baseline (`DIAGNOSTIC_PERIOD`).** Pure argmax selection narrows scope over time: the session's text is biased toward the chosen target, which concentrates new keystroke data on a small set of letters; letters outside that set decay below `LOW_CONFIDENCE_THRESHOLD` and drop out of ranking, eventually leaving the engine stuck on a handful of keys. To break that feedback loop, every `DIAGNOSTIC_PERIOD = 10` sessions `selectTarget` short-circuits to `diagnosticTarget()` regardless of argmax — a forced broad-coverage session that re-measures across the full key/bigram space. This runs alongside the per-session exploration blend described in §4.3; together they widen scope continuously (blend) and episodically (every 10th session). The cadence is hand-tuned; revisit with beta feedback.

**Character corpus-support exclusion.** Symmetric counterpart to the bigram exclusion in §4.3. A char with 0 corpus support (e.g. `;`, `/` — drill-mode-only keys that aren't in the `alpha-only` corpus) can't be practiced by the word-picker, so `rankTargets` filters it out when `corpusCharSupport` is provided. Without this filter, any keystroke on such a key logged through drill mode contaminates `character_stats` and leaves the adaptive loop argmax-locked on an untrainable target — the same category error as low-support bigrams, one layer down. The filter uses a stricter `=== 0` (not `< LOW_CORPUS_SUPPORT_THRESHOLD`) because even a single corpus word produces non-zero practice material for a character; bigrams need multiple words for variety, characters don't.

**Same-target cooldown (`COOLDOWN_RUN_LENGTH`).** Prevents a single target value from winning `COOLDOWN_RUN_LENGTH = 3` adaptive sessions in a row. After the cap, the target is filtered from the next session's ranking and the second-best candidate wins; on the session after that the cap no longer applies (recent history now contains a different value), so if the weakness persists the target returns. Net pattern: target wins 2, break 1, target wins 2, break 1 — variety emerges without suppressing a genuine long-lived weakness. The rule is **value-scoped, not weakness-scoped**: if character `g` is cooled down but `left-index-inner` (a column candidate driven partly by `g`'s errors) is also eligible, the column candidate can still win. This is deliberate — the user gets *different content* on the break session, even if the underlying weak region is the same. `recentTargets` is threaded through the practice route loader via a `session_targets` ⟕ `sessions` join, newest-first, limited to `COOLDOWN_RUN_LENGTH - 1` rows.

**Rank exploration (`RANK_EXPLORATION_PERIOD`).** Cooldown handles "same value repeatedly" but leaves ranks 3+ in the weakness distribution untouched — when ranks 0 and 1 trade off under cooldown, no session ever visits the long tail. Every `RANK_EXPLORATION_PERIOD` sessions (that isn't already a diagnostic), `selectTarget` picks a non-argmax rank via a seeded geometric draw over the ranked candidates: rank 1 ≈ 50%, rank 2 ≈ 25%, rank 3 ≈ 12.5%, etc. The seed is the session number, so behavior is deterministic and stable across re-renders. Diagnostic period wins when both rules fire on the same session — diagnostic's check runs first. When the ranking has fewer than 2 candidates, rank exploration degrades to argmax.

**Recency decay (`RECENCY_DECAY`, `RECENCY_WINDOW`, `RARE_MASTERY_BOOST`).** Soft counterpart to the hard cooldown cap. For each time a candidate's value appears in the last `RECENCY_WINDOW = 5` sessions, its weighted weakness score is multiplied by `RECENCY_DECAY = 0.7` raised to a per-target rarity exponent. The exponent matters: under uniform decay (`0.7^count`), every practice contributes the same score reduction regardless of the target's frequency in the corpus, which means rare letters (`q`, `j`, `z` — typed only when their few corpus words appear) accumulate "mastery credit" too slowly to ever drop out of argmax even after several practices. Rarity weighting fixes that: the exponent becomes `count × rarityFactor(value)`, where the factor is 1.0 for the most-common unit in the support map and rises linearly to `RARE_MASTERY_BOOST = 3.0` for a unit with zero support. So practicing `q` once produces a `0.7^3 ≈ 0.34` decay (≈70% steeper than the uniform `0.7^1 ≈ 0.7`), and rare letters cycle out of argmax in ~1-2 practices instead of indefinitely. Motion targets (column / thumb-cluster) bypass rarity weighting and stay at factor 1 — they have no corpus-frequency analog. Recency decay is fundamentally different from the stats-based weakness score: it rewards the *act* of practicing, not the *evidence* of improvement. A user who keeps struggling on `tc` still gets rotated off after a few sessions, accepting that forward progress isn't only measurable by error-rate movement. When `recentTargets` isn't provided (or is empty), decay is ×1 — no change.

Composing the five exploration mechanisms: **rare-letter-biased filler** (continuous letter widening in every session), **cooldown** (hard exclusion after N consecutive wins), **recency decay** (soft score discount as practice accumulates), **rank exploration** (periodic non-argmax draw from the weakness tail), and **diagnostic** (forced broad coverage every N sessions). They operate on different time scales — session-internal, short-horizon, medium-horizon, long-horizon — and address different failure modes, so stacking them doesn't produce double-coverage. Cooldown and recency decay in particular are complementary: the first is a tripwire, the second is a slope.

**Drill-mode integration.** Drill mode skips `selectTarget` and feeds a user-provided `SessionTarget` directly into session construction. Same `SessionOutput` shape (below); `score` is null and the briefing template is chosen by target type.

**`generateSession` — orchestrates target selection + exercise generation:**

```typescript
type SessionOutput = {
  target: SessionTarget;
  exercise: Word[]; // drill strings treated as 'words' for uniform word-boundary UI
  briefing: {
    text: string;    // filled from briefing templates (ADR-003 §4)
    keys: string[];  // target keys for ribbon + SVG outline
  };
  estimatedSeconds: number;
};

function generateSession({
  stats,
  baseline,
  phase,
  journey,
  corpus,
  options,
  targetOverride, // drill mode provides user-picked target
}: GenerateSessionInput): SessionOutput {
  const target =
    targetOverride ?? selectTarget(stats, baseline, phase, journey);

  const exercise =
    target.type === "character" || target.type === "bigram"
      ? generateExercise(corpus, baseline, options, { focusUnit: target.value }) // §4.3
      : lookupDrill(target, journey); // drill library (ADR-003 §3)

  const briefing = buildBriefing(target, journey, phase); // templates — ADR-003 §4
  return {
    target,
    exercise,
    briefing,
    estimatedSeconds: estimate(target, options),
  };
}
```

`generateExercise` becomes a subroutine under `generateSession` — backward-compatible refactor. Existing callers get a shim that fills `target` from the result.

### 4.3 Exercise Generation: Adaptive Mode (Word-Picker Approach)

Invoked by `generateSession` (§4.2) when `target.type === 'character' | 'bigram'`. For motion-pattern targets, session content comes from the drill library (ADR-003 §3) instead — see `lookupDrill` above.

**MVP strategy: static corpus + weighted random sampling.** The engine does NOT generate content; it selects from a pre-built English word corpus. Output is a sequence of disjoint words, not coherent prose.

**Corpus:** curated list of ~10,000 common English words, precomputed with metadata:

- Length (characters)
- Constituent characters
- Bigrams (adjacent character pairs)
- Frequency rank (from a standard English corpus frequency list)
- Hand distribution (left/right/mixed based on finger assignment table)

```
Input: top 10 weakness units (mixed character + bigram) + user filters
Output: array of words for the exercise (target ~50 words or ~300 chars)

Algorithm:
1. Filter word_corpus by user filters:
   - Hand isolation (left-only / right-only / either)
   - Max word length
   - Max difficulty score
2. For each word in the filtered corpus, compute a match score:
   match_score(word) = sum(weakness_score(unit) for unit in word.characters + word.bigrams)
3. Split candidates into an emphasis pool (contains the session target
   unit as a char or bigram) and a filler pool (doesn't)
4. Weighted random sampling:
   - ceil(TARGET_EMPHASIS_RATIO × count) words from the emphasis pool
   - remaining words from the filler pool (for variety)
   - If emphasis pool is smaller than the ratio implies, include all
     available emphasis words and top up from filler — no repetition
5. Shuffle (avoid clustering similar words sequentially)
6. Return word array to UI
```

**Why the emphasis pool split:** the raw weighted-sum score in step 2 is
dominated by the 0.5 per-unit floor for longer non-target words, so
without the pool split a session can silently end up with very few
target-containing words even when the target's `weaknessScore` is 10×
the floor. The split decouples "how often the target appears" from the
scoring weights. Default `TARGET_EMPHASIS_RATIO = 0.75` — hand-tuned,
revisit with beta feedback. Motion targets bypass this entirely (they
use curated drillLibrary content).

**Exploration blend in the filler pool.** Without help, the non-emphasis
pool is also scored by `match_score`, which sums the 0.5-per-unit floor
across each word. That biases filler toward long, common-letter words —
rare letters (`j`, `q`, `z`) almost never surface, so stats for those
keys stay frozen while the engine endlessly argmaxes over the narrow
set it has data on. To break the narrowing loop, the character/bigram
path of `generateSession` passes a `fillerWeightFor` function that
weights each candidate word by `1 + RARE_LETTER_BOOST × Σ(1 / charSupport(c))`
over the word's chars. Uniform-per-word alone would still inherit the
Zipfian skew of English (`e`/`t`/`a` dominate raw word counts); the
rare-letter boost compensates so words containing low-support letters
compete on an approximately letter-uniform basis. Degrades to pure
uniform-per-word when `charSupport` isn't threaded in. Paired with the
`DIAGNOSTIC_PERIOD` re-baseline in §4.2 and the `COOLDOWN_RUN_LENGTH`
rotation rule: **continuous** (every session, biased-filler blend),
**periodic** (every 10th session, full broad coverage), and **enforced**
(no target wins more than 3 sessions in a row).

**Low-corpus bigram handling.** Rare bigrams like `xw` have zero or
near-zero corpus words containing them as an adjacent pair (`xw` has
none; `vr` has just `chevrolet` and a junk entry `"vr"`). Without
special handling, the adaptive loop gets stuck: the engine picks the
rare bigram as the top weakness, the emphasis pool is empty or
near-empty, the user types a session with little-to-no practice of
that bigram, no meaningful new keystrokes land in `bigram_stats`, so
the next ranking is nearly identical and the same target is picked
again. The mitigation is **exclusion in ranking + widening in
generation**, both keyed on
`corpusBigramSupport.get(bigram) < LOW_CORPUS_SUPPORT_THRESHOLD`
(currently 3 — covers absent, zero, 1-word, and 2-word supports):

1. **Exclusion** — `rankTargets` filters out low-support bigrams
   entirely. A bigram with <3 corpus words can't produce enough real
   adjacent-pair occurrences in a session to move its stat (the
   session text just doesn't contain the bigram in adjacent position
   often enough), so picking it as an adaptive target creates a
   permanent stuck-loop where the argmax keeps returning it forever.
   Removing it from ranking lets practicable alternatives surface.
2. **Widening** — `generateExercise` rebuilds the emphasis pool as
   "words containing either component character" (for `xw`: words
   with `x` or `w` in their `chars`). Only fires if the bigram is
   explicitly passed as the target — so in practice this code path is
   exercised only by **drill mode**, where the user has picked a rare
   bigram on purpose and accepts "component-char practice" as the
   substitute for impossible-to-generate true bigram practice.

Note: an earlier design penalized low-support bigrams (multiplied the
weighted score by 0.5) rather than excluding them. This was not
strong enough — a rare bigram with a high raw weakness score (e.g.
`zs` after a handful of 100%-error attempts) could still beat every
other candidate even after halving, and the user stayed stuck. The
exclusion rule replaces the penalty because ranking a target you
can't meaningfully exercise is a category error, not a tuning issue.
`corpusBigramSupport` is a `ReadonlyMap<string, number>` precomputed
once on corpus load in `useCorpus`, threaded through
`generateSession`.

**Performance characteristics:**

- Generation time: <100ms (pure client-side computation on pre-loaded corpus)
- Memory: corpus is ~200KB JSON, loaded once per session
- Offline capable: no server round-trip needed for content generation

**Quality characteristics (honest assessment):**

- Output is functional for muscle memory training — target characters appear more frequently in the selected words than in baseline English text
- Output does NOT read as coherent prose — words are disjoint, chosen for character distribution not narrative
- User experience is "drill-like" rather than "reading-like"
- This is a deliberate MVP trade-off documented in 01-product-spec.md §5.3

**V2 upgrade path (NOT in MVP scope):**

Future versions may replace or supplement this with LLM-generated content, where a model is prompted to produce coherent prose themed around target weakness characters. Design considerations for V2:

- Trade-off between real-time generation (2-3s latency) vs. pre-generated content library
- Cost monitoring (per-session API costs)
- Caching strategy (identical weakness profiles could reuse generated content)
- Quality validation (verify generated content actually hits target character distribution)
- Fallback strategy (if LLM call fails, fall back to word-picker)

For MVP, all LLM integration is explicitly out of scope. The word-picker approach must prove the adaptive engine delivers value before investing in content-quality upgrade.

### 4.4 Exercise Generation: Targeted Drill

```
Input: target unit (character or bigram)
Output: synthetic string

Algorithm:
1. Generate combinations of the target unit with vowels & common adjacent consonants
2. Mix with real words from word_corpus that are heavy in the target unit
3. Repeat until target length is reached
```

Example for target 'b':

```
"bab beb bib bob bub bba bbe bbi bbo bbu the bay big boy bub bench better"
```

### 4.5 Insight Generation (Meta-Cognition Layer)

```typescript
function generateSessionInsight(
  session: Session,
  beforeStats: UserStats,
  afterStats: UserStats,
): SessionInsight {
  const topWeaknessBefore = top3Weakness(beforeStats);
  const topWeaknessAfter = top3Weakness(afterStats);

  const improvements = topWeaknessBefore.map((unit) => ({
    unit: unit.character,
    errorRateBefore: unit.errorRate,
    errorRateAfter: getStat(afterStats, unit.character).errorRate,
    speedBefore: unit.meanTime,
    speedAfter: getStat(afterStats, unit.character).meanTime,
  }));

  const newWeaknesses = topWeaknessAfter.filter(
    (after) =>
      !topWeaknessBefore.find((before) => before.character === after.character),
  );

  return {
    improvements,
    newWeaknesses,
    nextRecommendation: generateRecommendation(afterStats),
    plainLanguageSummary: composeSummary(improvements, newWeaknesses),
  };
}
```

Example plain-language summary output:

> "Today you focused on the letter B. Error rate dropped from 18% to 9% (significant improvement), but speed is still at 60% of your target. The next session will keep B included with more emphasis on speed. Separately, the bigram 'er' is starting to emerge as a new weakness — it'll be added to your practice set."

### 4.6 Split-Specific Metrics Computation

At the end of each session, compute 4 metrics from the session's keystroke_events and persist as a row in `split_metrics_snapshots`. These feed dashboard visualizations and phase-transition suggestions.

```typescript
const INNER_COLUMN = new Set(["b", "g", "h", "n", "t", "y"]);
const THUMB_KEYS = getLayoutThumbKeys(keyboardType); // per-layout

function computeSplitMetrics(
  keystrokeEvents: KeystrokeEvent[],
  layout: Layout,
): SplitMetricsSnapshot {
  // Metric 1: Inner column error rate
  const innerCol = keystrokeEvents.filter((e) =>
    INNER_COLUMN.has(e.targetChar.toLowerCase()),
  );
  const innerColErrors = innerCol.filter((e) => e.isError).length;
  const innerColErrorRate =
    innerCol.length > 0 ? innerColErrors / innerCol.length : 0;

  // Metric 2: Thumb cluster decision time
  const thumbEvents = keystrokeEvents.filter((e) =>
    THUMB_KEYS.has(e.targetChar),
  );
  const thumbAvgMs =
    thumbEvents.length > 0
      ? thumbEvents.reduce((sum, e) => sum + e.keystrokeMs, 0) /
        thumbEvents.length
      : 0;

  // Metric 3: Cross-hand bigram timing
  // A bigram is "cross-hand" if prev_char and target_char are assigned to different hands
  const crossHandBigrams = keystrokeEvents.filter((e) => {
    if (!e.prevChar) return false;
    const prevHand = layout.getHand(e.prevChar);
    const currHand = layout.getHand(e.targetChar);
    return prevHand !== currHand && prevHand && currHand; // exclude thumb-space cases
  });
  const crossHandAvgMs =
    crossHandBigrams.length > 0
      ? crossHandBigrams.reduce((sum, e) => sum + e.keystrokeMs, 0) /
        crossHandBigrams.length
      : 0;

  // Metric 4: Columnar stability (inferred)
  // For each error, check if typed char is in a column adjacent to target column (same hand) — that's "drift"
  // If typed char is on opposite hand, that's QWERTY-memory residue, not drift
  const errors = keystrokeEvents.filter((e) => e.isError);
  let stableCount = 0;
  let driftCount = 0;
  for (const e of errors) {
    const targetPos = layout.getPosition(e.targetChar);
    const typedPos = layout.getPosition(e.actualChar);
    if (!targetPos || !typedPos) continue;

    // Columnar drift: same hand, adjacent column, same or adjacent row
    if (
      targetPos.hand === typedPos.hand &&
      Math.abs(targetPos.col - typedPos.col) === 1 &&
      Math.abs(targetPos.row - typedPos.row) <= 1
    ) {
      driftCount++;
    } else {
      stableCount++;
    }
  }
  const totalCategorized = stableCount + driftCount;
  const columnarStabilityPct =
    totalCategorized > 0 ? stableCount / totalCategorized : 1.0; // no errors categorized = assume stable

  return {
    innerColAttempts: innerCol.length,
    innerColErrors,
    innerColErrorRate,
    thumbClusterCount: thumbEvents.length,
    thumbClusterAvgMs: thumbAvgMs,
    crossHandBigramCount: crossHandBigrams.length,
    crossHandBigramAvgMs: crossHandAvgMs,
    columnarStableCount: stableCount,
    columnarDriftCount: driftCount,
    columnarStabilityPct,
  };
}
```

**Accuracy caveats** (as noted in 01-product-spec.md §5.4 and §10 risks):

- Metrics 1-3 are directly measurable and accurate
- Metric 4 (columnar stability) is inferred from error patterns; accuracy is moderate. UI should communicate this with soft language ("likely drift") rather than certain language ("wrong finger used"). **Dashboard label reads "Columnar stability (experimental)"** with a brief explanatory footnote — per ADR-003 §6 Option C (honest reframe, no code removal).
- All metrics compute reliably only when sample size is meaningful. For sessions < 50 keystrokes, metrics are shown as "insufficient data"

### 4.7 Transition Phase Auto-Suggestion

The platform suggests phase changes but does not enforce them. The user retains control in settings. UI framing follows **ADR-003 §6 Option C**: these are **engine hypotheses, not declarations** — copy reads "the engine thinks you might be ready to shift focus — you decide" rather than "time to switch phases." No celebratory or coercive tone on either direction of suggestion.

```typescript
type PhaseTransitionSignal = {
  suggestedPhase: TransitionPhase;
  reason: string;
  confidence: "low" | "medium" | "high";
};

function checkPhaseTransition(
  profile: KeyboardProfile,
  recentSessions: Session[],
  recentSnapshots: SplitMetricsSnapshot[],
): PhaseTransitionSignal | null {
  if (profile.transitionPhase === "transitioning") {
    // Check if user should graduate to 'refining'
    const last10 = recentSessions.slice(-10);
    if (last10.length < 10) return null;

    const avgAccuracy = mean(last10.map((s) => s.accuracy));
    const avgInnerColError = mean(
      recentSnapshots.slice(-10).map((s) => s.innerColErrorRate),
    );

    if (avgAccuracy >= 0.95 && avgInnerColError < 0.08) {
      return {
        suggestedPhase: "refining",
        reason:
          "Your accuracy has been above 95% for 10 sessions, and inner column error rate is below 8%. Ready to shift focus from muscle memory to speed & flow?",
        confidence: "high",
      };
    }
  } else {
    // Check if user may have regressed (returning from a break)
    const daysSinceLastSession = daysBetween(profile.lastSessionAt, new Date());
    if (daysSinceLastSession > 14) {
      const last3 = recentSessions.slice(-3);
      if (last3.length >= 3 && mean(last3.map((s) => s.accuracy)) < 0.88) {
        return {
          suggestedPhase: "transitioning",
          reason:
            "You took a break, and your accuracy has dropped a bit. Want to go back to transition-mode focus for a few sessions?",
          confidence: "medium",
        };
      }
    }
  }

  return null;
}
```

The suggestion is surfaced to the user via a non-intrusive banner (not modal), dismissible, and shown at most once per session.

## 5. Module Breakdown

```
src/
├── domain/                  # Pure TypeScript, no framework deps
│   ├── finger/
│   │   ├── sofle.ts
│   │   ├── lily58.ts
│   │   └── resolver.ts      # getFingerForKey(layout, char)
│   ├── stats/
│   │   ├── computeStats.ts
│   │   ├── computeBaseline.ts
│   │   ├── computeSplitMetrics.ts  # NEW: 4 split-specific metrics per session
│   │   └── decayStats.ts
│   ├── adaptive/
│   │   ├── weaknessScore.ts        # Phase- and journey-aware coefficients (§4.1)
│   │   ├── targetSelection.ts      # NEW (ADR-003 §4.2): picks session target
│   │   ├── motionPatterns.ts       # NEW (ADR-003 §3): vertical/inner/thumb candidate scoring
│   │   ├── drillLibrary.ts         # NEW (ADR-003 §3): loader + lookupDrill() for motion targets
│   │   ├── drillLibraryData.ts     # NEW: static ~33-entry drill content (client-bundled JSON)
│   │   ├── sessionGenerator.ts     # NEW (ADR-003 §4.2): generateSession() wrapper
│   │   ├── briefingTemplates.ts    # NEW (ADR-003 §4): V1–V7 copy templates
│   │   ├── exerciseGenerator.ts    # Word-picker, now a subroutine of generateSession
│   │   ├── drillGenerator.ts
│   │   └── phaseSuggestion.ts      # Detects when to suggest phase change (§4.7)
│   ├── insight/
│   │   ├── sessionInsight.ts
│   │   └── weeklyInsight.ts
│   └── corpus/
│       ├── wordCorpus.ts    # interface
│       └── englishWords.ts  # static data
├── ui/                      # React components
│   ├── components/
│   │   ├── KeyboardSVG/
│   │   │   ├── SofleSVG.tsx
│   │   │   ├── Lily58SVG.tsx
│   │   │   └── KeyHighlight.tsx
│   │   ├── TypingArea/
│   │   ├── Dashboard/
│   │   └── Onboarding/
│   ├── pages/
│   ├── stores/              # Zustand
│   │   ├── sessionStore.ts
│   │   ├── userStore.ts
│   │   └── adaptiveStore.ts
│   └── hooks/
│       └── useKeystrokeCapture.ts
├── api/                     # API client
│   ├── client.ts
│   └── endpoints/
└── server/                  # Tanstack Start server functions + route loaders
    ├── functions/           # createServerFn() definitions (RPC-style)
    ├── routes/              # API route handlers (better-auth endpoints, webhooks)
    │   ├── auth/
    │   ├── sessions/
    │   └── stats/
    ├── db/
    │   ├── schema.ts        # Drizzle schema
    │   └── migrations/
    └── services/
```

## 6. Critical Performance Considerations

**Keystroke capture latency**: visual feedback must land within ~16ms (60fps) to feel instant. Avoid expensive React re-renders in the critical path. Solution: use refs + direct DOM manipulation for visual feedback, and only sync to React state for non-critical UI.

**Adaptive engine compute**: do not run on every keystroke. Compute at session end or on-demand for "next exercise". Cache the result in the store.

**Database writes**: a 5-minute session can produce 200+ keystroke events. Don't write them one by one. Buffer client-side and batch insert at session end.

## 7. Testing Strategy

**Domain logic** (highest priority):

- Exhaustive unit tests for weakness score computation
- Unit tests for exercise generator (deterministic with seeded random)
- Unit tests for finger resolver covering every key in Sofle and Lily58

**UI**:

- Component tests for KeyboardSVG (snapshot + interaction)
- Integration tests for typing flow (simulated keypress events)

**E2E**:

- Skip for MVP. Manually test the main flow: signup → onboarding → 1 session → dashboard.
