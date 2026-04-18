# Leftype-Rightype: Technical Architecture

> Companion to 01-product-spec.md (v0.2 — transition-focused)
> Status: v0.2 — transition-phase aware
> Last updated: 2026-04-18
> Major revision: added transition_phase to keyboard_profiles, split_metrics_snapshots table, phase-aware weakness scoring, split-specific metrics computation, phase transition auto-suggestion
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
│           Server (Tanstack Start / Next.js)          │
│  ┌─────────────────────────────────────────────┐   │
│  │      API Routes (REST or tRPC-style)         │   │
│  ├─────────────────────────────────────────────┤   │
│  │           Auth (better-auth/lucia)           │   │
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
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL DEFAULT now()
```

**Phase semantics:**
- `transitioning`: user still building columnar muscle memory. Engine weights columnar-specific pain points heavier, exercises are shorter, copy emphasizes "building new habits". Initial phase derived from `initial_level`: `first_day` and `few_weeks` → `transitioning`; `comfortable` → `refining`.
- `refining`: user past the transition struggle, now polishing speed and flow. Engine uses pure weakness profile, standard exercise length, copy shifts to peer tone.
- Phase changes triggered by: (a) user manually toggles in settings; (b) platform suggests change when stable accuracy >95% for 10+ sessions OR when user returns from 2+ weeks away (may have regressed).

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
type Hand = 'left' | 'right';
type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

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
  '1': { hand: 'left', finger: 'pinky', row: 0, col: 0 },
  '2': { hand: 'left', finger: 'ring', row: 0, col: 1 },
  // ... etc
  
  // Row 2 (home row)
  'a': { hand: 'left', finger: 'pinky', row: 2, col: 0 },
  's': { hand: 'left', finger: 'ring', row: 2, col: 1 },
  // ... etc
};

const LILY58_BASE_LAYER: Record<string, KeyAssignment> = {
  // Similar structure
};
```

The full mapping for Sofle and Lily58 must be sourced from official specs or your own experience. This will be one of the early tasks. As an active Sofle and Lily58 user, you are the best ground-truth reviewer for these tables.

## 4. Adaptive Engine: Algorithm Detail

### 4.1 Weakness Score Computation (Transition-Phase Aware)

The weakness score formula uses different coefficients depending on the user's transition phase. During transition, errors (the proxy for "can't find the key yet") are weighted most heavily. During refining, hesitation and slowness (the proxy for "know the key, not fluent yet") take over.

```typescript
type TransitionPhase = 'transitioning' | 'refining';

// Phase-specific coefficients
const COEFFICIENTS = {
  transitioning: {
    ALPHA: 0.6, // error weight — heavy during transition
    BETA:  0.2, // hesitation weight
    GAMMA: 0.1, // slowness weight — less important early on
    DELTA: 0.1, // frequency penalty
  },
  refining: {
    ALPHA: 0.3, // error weight — errors less informative when user is already accurate
    BETA:  0.35, // hesitation weight — fluency matters now
    GAMMA: 0.25, // slowness weight — speed matters now
    DELTA: 0.1, // frequency penalty
  },
};

function computeWeaknessScore(
  unit: CharacterStat | BigramStat,
  userBaseline: UserBaseline,
  phase: TransitionPhase
): number {
  const errorRate = unit.errors / Math.max(unit.attempts, 1);
  const meanTime = unit.sumTime / Math.max(unit.attempts, 1);
  const hesitationRate = (unit.hesitationCount ?? 0) / Math.max(unit.attempts, 1);
  
  const normalizedError = errorRate / userBaseline.meanErrorRate;
  const normalizedSlowness = meanTime / userBaseline.meanKeystrokeTime;
  const normalizedHesitation = hesitationRate / userBaseline.meanHesitationRate;
  
  const frequencyPenalty = unit.frequencyInLanguage; // 0–1, normalized
  
  const c = COEFFICIENTS[phase];
  
  // Transition bonus: during 'transitioning' phase, add extra weight to
  // inner-column characters (B, G, H, N, T, Y) since these are the primary
  // columnar pain points.
  const INNER_COLUMN = new Set(['b', 'g', 'h', 'n', 't', 'y']);
  const transitionBonus = (phase === 'transitioning' && INNER_COLUMN.has(unit.character?.toLowerCase()))
    ? 0.3
    : 0;
  
  return (
    c.ALPHA * normalizedError +
    c.BETA * normalizedHesitation +
    c.GAMMA * normalizedSlowness -
    c.DELTA * frequencyPenalty +
    transitionBonus
  );
}
```

**Edge cases to handle:**
- Units with attempts < 5: low confidence, exclude from ranking
- Cold start (new user in 'transitioning' phase): use default baseline (mean error rate 8%, mean keystroke 280ms — calibrated higher than comfortable-user baseline)
- Cold start for 'refining' user: use lower baseline (mean error rate 3%, mean keystroke 180ms)
- Decay: discount events older than 30 days
- Phase switching: when user switches phase, keep their stats but recompute baseline for the new phase's defaults. Do NOT reset historical stats.

### 4.2 Exercise Generation: Adaptive Mode (Word-Picker Approach)

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
3. Weighted random sampling: probability(word) ∝ match_score(word)
4. Sample until reaching target count (typically 40-60 words)
5. Shuffle (avoid clustering similar words sequentially)
6. Return word array to UI
```

**Performance characteristics:**
- Generation time: <100ms (pure client-side computation on pre-loaded corpus)
- Memory: corpus is ~200KB JSON, loaded once per session
- Offline capable: no server round-trip needed for content generation

**Quality characteristics (honest assessment):**
- Output is functional for muscle memory training — target characters appear more frequently in the selected words than in baseline English text
- Output does NOT read as coherent prose — words are disjoint, chosen for character distribution not narrative
- User experience is "drill-like" rather than "reading-like"
- This is a deliberate MVP trade-off documented in 01-product-spec.md §4.3

**V2 upgrade path (NOT in MVP scope):**

Future versions may replace or supplement this with LLM-generated content, where a model is prompted to produce coherent prose themed around target weakness characters. Design considerations for V2:

- Trade-off between real-time generation (2-3s latency) vs. pre-generated content library
- Cost monitoring (per-session API costs)
- Caching strategy (identical weakness profiles could reuse generated content)
- Quality validation (verify generated content actually hits target character distribution)
- Fallback strategy (if LLM call fails, fall back to word-picker)

For MVP, all LLM integration is explicitly out of scope. The word-picker approach must prove the adaptive engine delivers value before investing in content-quality upgrade.

### 4.3 Exercise Generation: Targeted Drill

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

### 4.4 Insight Generation (Meta-Cognition Layer)

```typescript
function generateSessionInsight(
  session: Session,
  beforeStats: UserStats,
  afterStats: UserStats
): SessionInsight {
  const topWeaknessBefore = top3Weakness(beforeStats);
  const topWeaknessAfter = top3Weakness(afterStats);
  
  const improvements = topWeaknessBefore.map(unit => ({
    unit: unit.character,
    errorRateBefore: unit.errorRate,
    errorRateAfter: getStat(afterStats, unit.character).errorRate,
    speedBefore: unit.meanTime,
    speedAfter: getStat(afterStats, unit.character).meanTime,
  }));
  
  const newWeaknesses = topWeaknessAfter.filter(
    after => !topWeaknessBefore.find(before => before.character === after.character)
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

### 4.5 Split-Specific Metrics Computation

At the end of each session, compute 4 metrics from the session's keystroke_events and persist as a row in `split_metrics_snapshots`. These feed dashboard visualizations and phase-transition suggestions.

```typescript
const INNER_COLUMN = new Set(['b', 'g', 'h', 'n', 't', 'y']);
const THUMB_KEYS = getLayoutThumbKeys(keyboardType); // per-layout

function computeSplitMetrics(
  keystrokeEvents: KeystrokeEvent[],
  layout: Layout
): SplitMetricsSnapshot {
  // Metric 1: Inner column error rate
  const innerCol = keystrokeEvents.filter(e => INNER_COLUMN.has(e.targetChar.toLowerCase()));
  const innerColErrors = innerCol.filter(e => e.isError).length;
  const innerColErrorRate = innerCol.length > 0 ? innerColErrors / innerCol.length : 0;
  
  // Metric 2: Thumb cluster decision time
  const thumbEvents = keystrokeEvents.filter(e => THUMB_KEYS.has(e.targetChar));
  const thumbAvgMs = thumbEvents.length > 0
    ? thumbEvents.reduce((sum, e) => sum + e.keystrokeMs, 0) / thumbEvents.length
    : 0;
  
  // Metric 3: Cross-hand bigram timing
  // A bigram is "cross-hand" if prev_char and target_char are assigned to different hands
  const crossHandBigrams = keystrokeEvents.filter(e => {
    if (!e.prevChar) return false;
    const prevHand = layout.getHand(e.prevChar);
    const currHand = layout.getHand(e.targetChar);
    return prevHand !== currHand && prevHand && currHand; // exclude thumb-space cases
  });
  const crossHandAvgMs = crossHandBigrams.length > 0
    ? crossHandBigrams.reduce((sum, e) => sum + e.keystrokeMs, 0) / crossHandBigrams.length
    : 0;
  
  // Metric 4: Columnar stability (inferred)
  // For each error, check if typed char is in a column adjacent to target column (same hand) — that's "drift"
  // If typed char is on opposite hand, that's QWERTY-memory residue, not drift
  const errors = keystrokeEvents.filter(e => e.isError);
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
  const columnarStabilityPct = totalCategorized > 0
    ? stableCount / totalCategorized
    : 1.0; // no errors categorized = assume stable
  
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
- Metric 4 (columnar stability) is inferred from error patterns; accuracy is moderate. UI should communicate this with soft language ("likely drift") rather than certain language ("wrong finger used")
- All metrics compute reliably only when sample size is meaningful. For sessions < 50 keystrokes, metrics are shown as "insufficient data"

### 4.6 Transition Phase Auto-Suggestion

The platform suggests phase changes but does not enforce them. The user retains control in settings.

```typescript
type PhaseTransitionSignal = {
  suggestedPhase: TransitionPhase;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};

function checkPhaseTransition(
  profile: KeyboardProfile,
  recentSessions: Session[],
  recentSnapshots: SplitMetricsSnapshot[]
): PhaseTransitionSignal | null {
  if (profile.transitionPhase === 'transitioning') {
    // Check if user should graduate to 'refining'
    const last10 = recentSessions.slice(-10);
    if (last10.length < 10) return null;
    
    const avgAccuracy = mean(last10.map(s => s.accuracy));
    const avgInnerColError = mean(recentSnapshots.slice(-10).map(s => s.innerColErrorRate));
    
    if (avgAccuracy >= 0.95 && avgInnerColError < 0.08) {
      return {
        suggestedPhase: 'refining',
        reason: 'Your accuracy has been above 95% for 10 sessions, and inner column error rate is below 8%. Ready to shift focus from muscle memory to speed & flow?',
        confidence: 'high',
      };
    }
  } else {
    // Check if user may have regressed (returning from a break)
    const daysSinceLastSession = daysBetween(profile.lastSessionAt, new Date());
    if (daysSinceLastSession > 14) {
      const last3 = recentSessions.slice(-3);
      if (last3.length >= 3 && mean(last3.map(s => s.accuracy)) < 0.88) {
        return {
          suggestedPhase: 'transitioning',
          reason: 'You took a break, and your accuracy has dropped a bit. Want to go back to transition-mode focus for a few sessions?',
          confidence: 'medium',
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
│   │   ├── weaknessScore.ts        # Transition-phase-aware coefficients
│   │   ├── exerciseGenerator.ts    # Transition-phase content weighting
│   │   ├── drillGenerator.ts
│   │   └── phaseSuggestion.ts      # NEW: detect when to suggest phase change
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
└── server/                  # Server routes (Tanstack Start / Next.js)
    ├── routes/
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
