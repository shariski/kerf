# Leftype-Rightype: MVP Product Specification

> Status: Locked for MVP development
> Last updated: 2026-04-17

## 1. Product Positioning

Leftype-Rightype is a typing practice platform designed specifically for **transitioners**: people who already type proficiently on standard row-staggered QWERTY keyboards and are migrating to split columnar keyboards (Sofle and Lily58 in MVP).

Key differentiators from existing platforms (TypingClub, Typerfast, Keybr, Monkeytype, etc.):

1. Accurate visual representation of the user's specific split keyboard
2. Adaptive engine aware of columnar finger assignments (not standard QWERTY assignments)
3. Meta-cognitive transparency: users see what they're learning, why, and how progress is measured

## 2. Target User (MVP)

**Primary**: Transitioners already proficient with standard QWERTY who are adopting Sofle or Lily58.

Not for:
- Total beginners who don't yet touch type (recommend TypingClub or Keybr)
- Standard keyboard users (many better free alternatives exist)
- Alternative layout users (Colemak, Dvorak) — possibly V2

## 3. Fundamental Technical Constraint

**Browsers cannot distinguish whether a keypress originated from the left or right half of a split keyboard.** Split keyboards send standard USB HID. Consequences:

- True detection of which physical finger was used is not possible
- Solution: combine a hardcoded finger assignment table per layout with statistical inference from error patterns
- Approach C (WebHID + custom firmware) is deferred to V2

## 4. Core MVP Features

### 4.1 Keyboard Profile Setup

Onboarding collects:
- Keyboard choice (Sofle or Lily58)
- Dominant hand (left or right)
- Self-reported level (first day / few weeks in / comfortable)

Internally maps to a finger assignment table per layout. Profile can be changed at any time (multi-keyboard support).

### 4.2 Visual Split Keyboard Display

Real-time SVG render of both halves matching the user's chosen layout:
- 8-color coding for 8 fingers (following standard typing pedagogy)
- Highlighted target key (next key to press)
- Highlighted expected finger (visual hint in the finger guide area)
- Per-keypress visual feedback (correct = green flash, error = red flash, hesitation > 2σ = yellow)

### 4.3 Adaptive Practice Mode (Primary Mode)

The default mode covering ~80% of expected user time.

**MVP content generation strategy: word-picker approach.** The engine uses a static English word corpus (target ~10,000 words) and selects words via weighted random sampling based on the user's weakness profile. Words with more occurrences of weak characters/bigrams get higher selection probability.

Output format: disjoint word sequences (no narrative flow). Example output when user is weak in B/N/T: "bench better beneath button bottom bond never bend bin bet bait". This is **functionally effective for muscle memory training** but does not attempt to produce coherent prose.

**Known trade-off vs. competitor platforms:** Some adaptive typing platforms (notably Typerfast) generate coherent prose themed around target characters — text that reads like an article while stealth-embedding weakness-relevant letters. This produces a more engaging "smart" feel. We deliberately do not pursue this in MVP because:
- Real-time content generation requires LLM integration (latency, cost, reliability burdens)
- Word-picker approach proves the adaptive engine works before investing in content-quality upgrade
- LLM-based content generation is queued as a V2 feature (see §5 Tier 2)

**Available filters:**
- Hand isolation: restrict to words using only one side
- Difficulty cap: max word length or max difficulty score

### 4.4 Targeted Drill Submode

On-demand mode for attacking specific weaknesses. The user can:
- Pick a specific character/bigram to drill
- Or let the engine auto-recommend the top weakness

Output: synthetic strings heavy in the target unit (e.g., "bab beb bib bob bub bba bbe bbi"). Unnatural to read but effective for muscle memory.

### 4.5 Adaptive Engine (full detail in 02-architecture.md)

Four layers:
1. Data collection (per keystroke event)
2. Weakness identification (weakness score per character & bigram)
3. Exercise generation (weighted word selection + synthetic drill)
4. Insight surface (meta-cognition reporting)

### 4.6 Meta-Cognition Dashboard (Power-User Style)

User opted for "show everything explicitly". The dashboard displays:
- Current weakness ranking with score breakdown
- The formula the engine uses (collapsible, for the curious)
- Decision rationale: why the next exercise contains specific words
- End-of-session report with plain-language explanation
- Weekly insight: temporal patterns, skill trajectory, actionable recommendations

### 4.7 Authentication & Persistence

- Email magic link auth (or GitHub OAuth — finalize in tech decision)
- PostgreSQL on the user's VPS
- Automatic cross-device sync
- Multi-keyboard profiles per account

## 5. Out of Scope (Explicit)

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

## 6. MVP Success Metrics

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

## 7. Tech Stack

- **Framework**: React + TypeScript + Vite (fullstack via Tanstack Start or Next.js 15 — finalize in tech doc)
- **Database**: Self-hosted PostgreSQL on VPS
- **Auth**: better-auth or lucia-auth (both support magic link + OAuth)
- **Styling**: Tailwind CSS
- **State**: Zustand (lightweight)
- **Charts**: Recharts
- **SVG**: native SVG with minimal helpers
- **Deployment**: User's VPS (Docker compose recommended)

## 8. Risk Acknowledgements

1. TAM is small — this is a passion/portfolio project; monetization is not an MVP goal
2. The adaptive engine only shines after 10+ sessions — first-session experience must be extra polished
3. Scope creep — realistic timeline is 2–4 months, not weeks
4. Power-user transparency requires serious design effort to avoid feeling overwhelming
