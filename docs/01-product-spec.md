# kerf: MVP Product Specification

> Status: v0.2 — transition-focused positioning
> Last updated: 2026-04-18
> Major revision: pivoted from "adaptive typing for split" to "structured transition program". Added core values, split-specific metrics, Phase A/B split.

## 1. Product Positioning

kerf is a **transition-focused typing platform** specifically designed for people migrating from row-staggered QWERTY keyboards to split columnar keyboards (Sofle and Lily58 in MVP). The platform treats split keyboard adoption as a distinct learning journey with its own pain points, not as a generic "learn to type faster" program.

**Core positioning statement**: "Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first."

**Key differentiators from existing platforms** (TypingClub, Typerfast, Keybr, Monkeytype, etc.):

1. **Transition-aware engine**: Platform recognizes two distinct user phases — early transition (building columnar muscle memory) vs refinement (polishing speed and flow). Content selection, metrics, and feedback adapt to the phase.
2. **Split-specific metrics**: Instead of generic "mastered 22/26 letters", metrics surface what actually matters for transitioners — inner column (B, G, H, N, T, Y) error rate, thumb cluster decision time, cross-hand bigram timing.
3. **Accurate visual representation** of the user's specific split keyboard with correct columnar finger assignments (not standard QWERTY assignments).
4. **Meta-cognitive transparency**: Users see what they're learning, why, and how progress is measured. No black-box gamification.
5. **Accuracy-first values**: Content, copy, and feedback consistently reward accuracy improvement over speed. Platform does not celebrate speed gains at the cost of accuracy.

## 2. Core Values (Product Principles)

These values are not marketing copy — they are decision criteria for every product choice. When in doubt about a design decision, refer here.

### 2.1 Accuracy over speed, always

Typing fast is only meaningful if typing accurately. Muscle memory forms through deliberate, accurate practice, not through racing. Consequences for the product:

- Session reports lead with accuracy, not speed
- Positive feedback emphasizes accuracy gains; speed gains are secondary
- When speed improves but accuracy drops, platform communicates this as a step backward, not a step forward
- No leaderboards or speed-based competitive features (in MVP and likely ever)
- Exercises don't have "time pressure" UI elements

### 2.2 Deliberate practice, not addictive practice

The platform is a tool for learning, not a slot machine. Consequences:

- No streak-break anxiety. Streak counter exists but missing a day doesn't reset everything or trigger alerts
- No artificial urgency, countdown timers, or FOMO mechanics
- Platform encourages breaks when users show signs of fatigue (declining accuracy late in sessions)
- Engine insight is honest: if user hasn't improved in 2 weeks, platform says so, not "you're doing great!"

### 2.3 Transition is the primary journey

For the first weeks of split keyboard use, the user is a transitioner — struggling with columnar alignment, thumb clusters, inner column reach. The platform treats this phase with care:

- Content is weighted toward columnar-specific pain points (B, G, H, N, T, Y, inner columns)
- Progress metrics match transition milestones, not generic typing metrics
- Once user signals they've moved past transition, platform shifts mode to refinement practice

### 2.4 Transparent engine, no black box

User can always see: what the engine thinks their weakness is, why it chose the current exercise, and how the formula works. This is a deliberate anti-pattern vs. gamification trends that obscure the learning model.

## 3. Target User (MVP)

**Primary**: Transitioners already proficient with standard QWERTY who are adopting Sofle or Lily58. Timeline: users somewhere between day 1 and month 3 of their split keyboard journey.

Not for:

- Total beginners who don't yet touch type (recommend TypingClub or Keybr)
- Standard keyboard users (many better free alternatives exist)
- Alternative layout users (Colemak, Dvorak) — possibly V2
- Users already fully comfortable on split who just want speed drills (Monkeytype is better for that)

## 4. Fundamental Technical Constraint

**Browsers cannot distinguish whether a keypress originated from the left or right half of a split keyboard.** Split keyboards send standard USB HID. Consequences:

- True detection of which physical finger was used is not possible
- Solution: combine a hardcoded finger assignment table per layout with statistical inference from error patterns
- Approach C (WebHID + custom firmware) is deferred to V2

## 5. Core MVP Features (Phase A)

**Note on MVP phasing**: Given the scope of making this truly transition-focused, the MVP is split into two phases:

- **Phase A (launch target)**: Transition-aware adaptive engine + split-specific metrics + core typing experience. User can onboard, get a diagnostic baseline, practice adaptively with transition-phase awareness, see meaningful split-specific progress, and manage keyboard profiles. Goal: validate that transition-focused framing resonates with real users.

- **Phase B (post-beta validation)**: Full week-by-week curriculum, structured progression milestones, guided transition program. Built after Phase A beta feedback confirms the positioning works.

This section describes Phase A only. Phase B is detailed in §9.

### 5.1 Keyboard Profile Setup + Diagnostic

Onboarding collects:

- Keyboard choice (Sofle or Lily58)
- Dominant hand (left or right)
- Self-reported transition phase (first day / few weeks in / comfortable)

Internally maps to:

- Finger assignment table per layout
- Initial transition phase (affects engine behavior — see §5.5)
- Initial baseline assumptions (new transitioner starts with higher expected error rate than comfortable user)

Profile can be changed at any time (multi-keyboard support).

**First-session diagnostic** (Phase A lightweight version): The first practice session after onboarding is a curated 3-minute exercise covering home row, inner column (B, G, H, N, T, Y), and thumb cluster basics. Engine captures baseline error rates per area. This informs adaptive weighting for subsequent sessions.

### 5.2 Visual Split Keyboard Display

Real-time SVG render of both halves matching the user's chosen layout:

- 8-color coding for 8 fingers (following standard typing pedagogy)
- Highlighted target key (next key to press)
- Highlighted expected finger (visual hint in the finger guide area)
- Per-keypress visual feedback (correct = green flash, error = red flash, hesitation > 2σ = yellow)
- Visual keyboard is generated as SVG by the design tooling (not sourced from photos)

### 5.3 Adaptive Practice Mode (Primary Mode, Transition-Aware)

The default mode covering ~80% of expected user time.

**Engine behavior adapts to user's transition phase:**

_Phase: Transitioning_ (new user, self-reported "first day" / "few weeks in"):

- Content weighted toward columnar-specific pain points: inner column (B, G, H, N, T, Y), thumb cluster-adjacent keys
- Shorter exercises (~30 words) to avoid fatigue
- Higher accuracy baseline expected — errors weighted heavier in weakness score
- Encouraging copy emphasizing "you're building new muscle memory"

_Phase: Refining_ (user self-reports "comfortable" or platform detects stable accuracy above 95% for 10+ sessions):

- Content weighted toward pure weakness profile (any character/bigram that still has elevated error rate)
- Standard exercise length (~50 words)
- Speed starts to factor into weakness score (hesitation component weighted higher)
- Tone shifts to peer rather than teacher ("push your speed on this bigram")

**MVP content generation strategy: word-picker approach.** The engine uses a static English word corpus (target ~10,000 words) and selects words via weighted random sampling based on the user's weakness profile + transition phase weighting. Words with more occurrences of weak characters/bigrams get higher selection probability.

Output format: disjoint word sequences (no narrative flow). Example output when user is in Transitioning phase weak in B/N/T: "bench better beneath button bottom bond never bend bin bet bait". This is **functionally effective for muscle memory training** but does not attempt to produce coherent prose.

**Known trade-off vs. competitor platforms:** Some adaptive typing platforms (notably Typerfast) generate coherent prose themed around target characters — text that reads like an article while stealth-embedding weakness-relevant letters. This produces a more engaging "smart" feel. We deliberately do not pursue this in MVP because:

- Real-time content generation requires LLM integration (latency, cost, reliability burdens)
- Word-picker approach proves the adaptive engine works before investing in content-quality upgrade
- LLM-based content generation is queued as a V2 feature (see §8 Tier 2)

**Available filters:**

- Hand isolation: restrict to words using only one side
- Difficulty cap: max word length or max difficulty score

### 5.4 Split-Specific Metrics

Instead of generic typing metrics, dashboard surfaces metrics that matter for transitioners:

- **Inner column error rate**: aggregate error rate across B, G, H, N, T, Y keys. This is the classic columnar transition pain point.
- **Thumb cluster decision time**: time between finishing previous key and pressing thumb-cluster key. Long times indicate hesitation choosing which thumb key to use.
- **Cross-hand bigram timing**: bigrams that span both hands (like "th", "he", "in") — measures how well the user has internalized inter-hand rhythm.
- **Columnar stability**: how often the user presses a key with the finger assigned for its column vs. with an adjacent finger (inferred from error pattern analysis).

These coexist with generic metrics (WPM, accuracy) but take priority in the user's "Where you are now" dashboard hero.

### 5.5 Targeted Drill Submode

On-demand mode for attacking specific weaknesses. The user can:

- Pick a specific character/bigram to drill
- Or let the engine auto-recommend the top weakness
- Or pick a transition-specific drill preset (inner column, thumb cluster, cross-hand bigrams)

Output: synthetic strings heavy in the target unit (e.g., "bab beb bib bob bub bba bbe bbi"). Unnatural to read but effective for muscle memory.

### 5.6 Adaptive Engine (full detail in 02-architecture.md)

Four layers:

1. Data collection (per keystroke event)
2. Weakness identification (weakness score per character & bigram, weighted by transition phase)
3. Exercise generation (weighted word selection + synthetic drill, with transition-phase content weighting)
4. Insight surface (meta-cognition reporting with split-specific metrics)

### 5.7 Meta-Cognition Dashboard (Power-User Style)

User opted for "show everything explicitly". The dashboard displays:

- Split-specific metrics (inner column error rate, thumb cluster decision time, cross-hand bigram timing) as primary hero stats
- Current weakness ranking with score breakdown
- The formula the engine uses (always-expanded with current calculation values)
- Decision rationale: why the next exercise contains specific words
- End-of-session report with plain-language explanation
- Weekly insight: temporal patterns, skill trajectory, actionable recommendations

### 5.8 Authentication & Persistence

- Email magic link auth + GitHub OAuth + Google OAuth
- PostgreSQL on the user's VPS
- Automatic cross-device sync
- Multi-keyboard profiles per account

## 6. Content Generation & Typing Experience Rules

### 6.1 Error Visualization Rules

During active typing:

- Wrong character is displayed in red with underline
- **Expected character is displayed small above the typed character** (like Typerfast pattern). This gives immediate corrective context without breaking flow.
- Cursor stays at position — user must backspace to correct
- Visual keyboard: target key stays highlighted amber (reinforcing which key was expected)
- No audio feedback on errors (error sounds are punishing and discourage deliberate practice)

Post-session review:

- Full exercise text displayed with all error positions highlighted
- Hover on error shows "typed X, expected Y" tooltip
- Pattern spotting: which errors clustered (e.g., "you struggled with B→V substitution 4 times")

### 6.2 Accuracy-First Copy Guidelines

All copy in the product reflects accuracy-first values. Examples:

- Post-session stat hierarchy: accuracy featured as primary, speed secondary
- When accuracy drops and speed rises: copy frames this as a concern, not a win ("Your speed ticked up, but accuracy slipped. Slowing down will pay off")
- When accuracy rises and speed slows: copy frames this as the right trajectory ("Slower, tighter, stronger. This is how muscle memory forms")
- Weekly insight leads with accuracy trends before speed trends
- No hyped language ("amazing!", "crushing it!", etc.) — tone is quietly affirming, not cheerleading

## 7. Out of Scope (Explicit)

**Not in MVP:**

- Standard keyboard support
- Languages other than English (V2 may add Indonesian)
- Mobile/touch support
- Layer training (lower/raise + thumb cluster non-base layers)
- Custom layout import (QMK keymap.c parser)
- WebHID + custom firmware
- Social features (leaderboards, sharing, follows)
- Real Sentence Mode (typing articles/novels with finger hints)
- Phantom Key Detection ("I peeked" button)

**Tier 2 (V1.5 – V2):**

- **Full transition curriculum (MVP Phase B)**: week-by-week structured program with explicit milestones (home row → inner column → thumb cluster → bigram flow), built after beta validates the positioning
- LLM-based content generation (coherent prose themed around target weakness characters) — upgrade from word-picker MVP approach
- Real Sentence Mode
- Phantom Key Detection
- Layer Training
- More split keyboards (Corne, Kyria, Ferris)
- Simple leaderboard

**Tier 3 (Far future):**

- WebHID + custom firmware
- QMK keymap.c parser
- Home row mod training
- Combos/chord training
- Alternative layouts (Colemak, Dvorak, Workman)
- BYO-LLM via MCP (user brings their own LLM provider for content generation) — experimental exploration, not commitment

## 8. MVP Success Metrics

Given this is a solo project with a niche audience, realistic success metrics:

**Phase 1 (3 months post-launch):**

- 50+ registered users
- 10+ weekly active users
- Average session length > 5 minutes
- Average sessions per user per week > 3

**Phase 2 (6 months post-launch):**

- 200+ registered users
- 30+ weekly active users
- 5+ users reporting "this genuinely helped my transition"
- Foundation for prioritizing V2 based on real data

**Phase A → Phase B transition gate** (qualitative, not time-based):

- At least 20 active beta users provide feedback
- Clear signal whether "structured curriculum" is what users want (feedback requests it, retention drops in weeks 2-3 without it, etc.)
- If signal is weak, Phase B may be deprioritized in favor of other roadmap items

## 9. Tech Stack

- **Framework**: React + TypeScript + Vite (fullstack via Tanstack Start or Next.js 15 — finalize in tech doc)
- **Database**: Self-hosted PostgreSQL on VPS
- **Auth**: better-auth or lucia-auth (both support magic link + OAuth)
- **Styling**: Tailwind CSS
- **State**: Zustand (lightweight)
- **Charts**: Recharts
- **SVG**: native SVG, keyboard visuals hand-authored by design tooling (not photo-based)
- **Deployment**: User's VPS (Docker compose recommended)

## 10. Risk Acknowledgements

1. TAM is small — this is a passion/portfolio project; monetization is not an MVP goal
2. The adaptive engine only shines after 10+ sessions — first-session experience must be extra polished
3. Scope creep is a real risk — the Phase A / Phase B split is an explicit mitigation; resist merging them back together
4. Power-user transparency requires serious design effort to avoid feeling overwhelming
5. Split-specific metrics (inner column error rate, thumb cluster time) rely on accurate inference from keystroke patterns alone (browsers can't distinguish left/right halves) — accuracy may be imperfect, messaging should acknowledge this
6. Transition positioning is unvalidated until Phase A beta — the thesis that "transitioners want curriculum over pure adaptive" may be wrong; Phase B gate protects against building a feature nobody wants
