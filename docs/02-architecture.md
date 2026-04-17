# Leftype-Rightype: Technical Architecture

> Companion to 01-product-spec.md
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
id              uuid PRIMARY KEY
user_id         uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_type   text NOT NULL  -- 'sofle' | 'lily58'
dominant_hand   text NOT NULL  -- 'left' | 'right'
self_level      text NOT NULL  -- 'first_day' | 'few_weeks' | 'comfortable'
is_active       boolean NOT NULL DEFAULT true
created_at      timestamptz NOT NULL DEFAULT now()
```

### sessions
```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES users(id) ON DELETE CASCADE
keyboard_profile_id uuid REFERENCES keyboard_profiles(id)
mode                text NOT NULL  -- 'adaptive' | 'targeted_drill'
filter_config       jsonb          -- { hand_isolation: 'left' | 'right' | null, max_length: int }
started_at          timestamptz NOT NULL
ended_at            timestamptz
total_chars         integer DEFAULT 0
total_errors        integer DEFAULT 0
wpm                 real
accuracy            real
```

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

### 4.1 Weakness Score Computation

```typescript
function computeWeaknessScore(
  unit: CharacterStat | BigramStat,
  userBaseline: UserBaseline
): number {
  const errorRate = unit.errors / Math.max(unit.attempts, 1);
  const meanTime = unit.sumTime / Math.max(unit.attempts, 1);
  const hesitationRate = (unit.hesitationCount ?? 0) / Math.max(unit.attempts, 1);
  
  const normalizedError = errorRate / userBaseline.meanErrorRate;
  const normalizedSlowness = meanTime / userBaseline.meanKeystrokeTime;
  const normalizedHesitation = hesitationRate / userBaseline.meanHesitationRate;
  
  // Frequency penalty: less weight for very common characters
  // (avoids bias toward 'e', 't', 'a', etc.)
  const frequencyPenalty = unit.frequencyInLanguage; // 0–1, normalized
  
  const ALPHA = 0.5; // error weight
  const BETA = 0.2;  // hesitation weight
  const GAMMA = 0.2; // slowness weight
  const DELTA = 0.1; // frequency penalty weight
  
  return (
    ALPHA * normalizedError +
    BETA * normalizedHesitation +
    GAMMA * normalizedSlowness -
    DELTA * frequencyPenalty
  );
}
```

**Edge cases to handle:**
- Units with attempts < 5: low confidence, exclude from ranking
- Cold start (new user): use default baseline (mean error rate 5%, mean keystroke 250ms)
- Decay: discount events older than 30 days

### 4.2 Exercise Generation: Adaptive Mode

```
Input: top 10 weakness units (mixed character + bigram)
Output: array of words for the exercise (target ~50 words or ~300 chars)

Algorithm:
1. Filter word_corpus by user filters (hand isolation, max length)
2. For each word in the filtered corpus, compute a match score:
   match_score(word) = sum(weakness_score(unit) for unit in word.characters + word.bigrams)
3. Weighted random sampling: probability(word) ∝ match_score(word)
4. Sample until reaching target count
5. Shuffle (avoid clustering similar words sequentially)
```

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
│   │   └── decayStats.ts
│   ├── adaptive/
│   │   ├── weaknessScore.ts
│   │   ├── exerciseGenerator.ts
│   │   └── drillGenerator.ts
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
