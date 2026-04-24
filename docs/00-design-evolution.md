# kerf: Design Evolution

> Architectural Decision Records (ADRs) documenting major shifts in product philosophy, positioning, or structure.
> **Read this first** if you're picking up the project after time away, onboarding a new collaborator, or feeding Claude Code fresh context.

## ⚠ Current Status (2026-04-24)

Four ADRs exist in this document. **Current canonical product intent is ADR-003; distribution/licensing intent is ADR-004.**

- **ADR-001** (Meta-cognition loop): **Superseded by ADR-003** — content kept as historical record.
- **ADR-002** (Split-specific practice mechanisms): **Superseded by ADR-003** — content kept as historical record.
- **ADR-003** (Deliberate-practice architecture): **Accepted** 2026-04-22. Merges ADR-001 and ADR-002 into one synthesis; adopts three-stage session loop, setup-awareness, and columnar-motion drill library. Pending Pass 1 spec-doc propagation.
- **ADR-004** (Open-core licensing and distribution): **Accepted** 2026-04-24. Public MIT-licensed repo; hosted paid layer deferred until 500 WAU milestone validates it. Orthogonal to product ADRs — does not affect Phase A scope.

When orienting on kerf's current intended direction, read ADR-003 for product and ADR-004 for distribution. ADR-001 and ADR-002 are preserved below because they contain the reasoning chain that led to ADR-003 — useful context for any future session reconsidering the decision.

## Purpose of This Document

The spec documents (`01-product-spec.md`, `02-architecture.md`, etc.) describe **the current canonical state**. They do not explain **why the project arrived at that state**. For small iterative changes (typo fixes, wireframe tweaks, copy revisions), the revision histories inside each doc are sufficient.

But some decisions fundamentally reshape what the product **is**. Those deserve a dedicated record that survives future rewrites. This document is that record.

**When to add a new ADR:**

- Core positioning changes
- Architectural restructuring (new engine layers, new data model dimensions)
- Major scope decisions that change timeline materially (±1 week or more)
- Reversals of previously-locked decisions
- Insights that shift product philosophy, not just product surface

**When NOT to add a new ADR:**

- Visual polish, typography, color refinements
- Individual wireframe iterations
- Task breakdown refinements within an already-committed scope
- Tech stack swaps that don't affect product behavior (unless they change what's buildable)
- Copy revisions, even large ones

## ADR Format

Each ADR follows a consistent structure:

1. **Context** — what was the state before, what triggered reconsideration
2. **Decision** — what was decided
3. **Consequences** — what changes as a result (scope, timeline, data model, positioning)
4. **Alternatives Considered** — options explicitly evaluated and rejected
5. **Related Changes** — which docs and artifacts need updating to reflect this ADR

---

## ADR-001: Meta-Cognition as Structural Loop (v0.4 → v0.5)

**Date**: 2026-04-20
**Status**: Superseded by ADR-003 (2026-04-22) — content kept as historical record
**Version bump**: v0.4 → v0.5 (major, not minor — reshapes session model)

### Context

Through v0.2 (transition-focused pivot), kerf established meta-cognition as one of five core differentiators: _"Meta-cognitive transparency: Users see what they're learning, why, and how progress is measured. No black-box gamification."_ (01-product-spec.md §1)

This was implemented as **surface transparency** — dashboard formulas, weakness rankings, decision rationale, always-expanded calculation values. User could _opt into_ meta-cognition by visiting the dashboard.

In a v0.4.x review session (2026-04-20), the developer shared a TyperFast post-session screenshot and observed something fundamental about TyperFast's engagement model:

> "TyperFast has three parts. At pre-session there's an instruction about what the target is, what's highlighted, and the user is told to pay attention to that target. Then during execution there's a banner or hint that persists and is emphasized. Then after finishing there's a result tied to that target and objective. The user doesn't need to understand meta-cognition — the platform forces them into the loop, and they end up doing meta-cognition unconsciously."

This reframed the problem. kerf v0.4 had meta-cognition as **surface** (available on demand in the dashboard). TyperFast had meta-cognition as **structural loop** (embedded in every session flow). A user who never opens kerf's dashboard gets zero meta-cognition; a user who completes one TyperFast session has been through an entire meta-cognition cycle (intention → attention → reflection) whether they intended to or not.

The developer's drill mode example made the distinction concrete: kerf's drill mode currently shows "letter B · 30 reps" as a **label**. That is informational, not intentional. It does not set user attention, does not persist through execution, does not evaluate performance against a declared target.

### Decision

Restructure the practice session as an explicit **three-stage meta-cognition loop**. This is not an additive feature — it is a reframing of what a "session" fundamentally is.

**Stage 1 — Briefing (pre-session, new):**
Before exercise starts, platform explicitly declares:

- Target (characters, bigrams, or split-specific category like "inner column")
- Why-this-target (weakness score + transition phase context)
- Attention directive (what to notice, what to prioritize)
- Success criterion (explicit threshold, e.g., "<10% error on target")

User advances with explicit start action (not auto-dismiss). Duration ~5–10s read.

**Stage 2 — Execution with persistent attention (during-session, new):**
Target remains visually present throughout typing. Mechanisms:

- Target strip: subtle ribbon showing target chars/bigrams
- Visual keyboard target emphasis: target keys styled distinctly from current-cursor amber
- Real-time target performance counter (updates on target-char keystrokes)

Design constraint: informative without being distracting. Peripheral, not competing with typing area.

**Stage 3 — Evaluation (post-session, refined from prior plans):**
Explicit review against Stage 1's declared target:

- Intent ribbon: echo of briefing ("Session targeted: X, Y, Z. Reason: ...")
- Target performance visualization: dot grid per target char (amber correct / red incorrect)
- Success judgment against declared threshold
- Next target preview (closes loop → feeds next session's briefing)

The three stages form one complete loop per session. Every session is a deliberate practice cycle, not isolated typing.

**Target selection becomes a first-class engine layer.** Engine explicitly picks targets pre-session (deterministic, not emergent from sampling). Word selection then samples from corpus weighted toward declared targets. Target list surfaces in briefing, persists through execution, evaluates in post-session.

**Content generation strategy unchanged.** Word-picker remains the MVP approach. The meta-cognition loop works equally well with disjoint words as with coherent prose. LLM-based content generation remains a V2 concern. (This was explicitly reaffirmed during the same session — the developer considered upgrading to template-based prose and sentence bank alternatives, then stepped back with the reasoning that word-picker is sufficient to validate positioning. The meta-cognition loop upgrade came from a separate, deeper insight.)

### Consequences

**Timeline:**

- Phase A MVP estimate: 12–18 weeks → **13–20 weeks** (+1–2 weeks)
- Additions: pre-session briefing component, during-session target persistence, post-session evaluation restructure, briefing copy library, engine target-selection layer, session_targets data model

**Data model additions** (02-architecture.md will detail):

- New table `session_targets` with target_type, target_value, weight, success_threshold, actual_error_rate, target_met
- Engine output changes from `Word[]` to struct containing targets, exercise, briefing copy, success criteria

**Positioning shift** (modest, not dramatic):

- Core values gain new principle: **"Meta-cognition is structural, not optional"** — every session forces the full loop; it is not a feature users can ignore
- Positioning statement unchanged: still _"Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first."_ The meta-cognition loop reinforces this positioning rather than replacing it
- Differentiator #4 in §1 ("Meta-cognitive transparency") upgrades wording from "users see what they're learning" to "every session is a structured intention-attention-reflection cycle"

**Drill mode preserved as-is.** The developer chose to keep drill mode as a separate submode (not fold it into adaptive). Rationale: drill serves a different use case — manual user-driven target override, when the user already knows what they want to practice and doesn't need engine recommendation. Adaptive mode with meta-cognition loop handles engine-driven practice; drill mode handles user-driven practice. Both benefit from the three-stage structure.

**Risks acknowledged:**

1. **Over-instructional cognitive load** — briefings risk becoming wordy. Mitigation: visual-first briefing design, text secondary, prominent target characters.
2. **During-session distraction** — target persistence must be peripheral. Mitigation: prototype carefully; target styling must differ from cursor amber without competing for focus.
3. **Success-criterion psychology** — explicit goals risk triggering anxiety (miss) or addictive win-seeking (hit). Mitigation: copy framing per existing accuracy-first value (celebrate without hyping, frame miss as data).
4. **Copy library maintenance burden** — briefing copy per phase × per target type. Mitigation: template-based with variable slots, not hand-written per session.

**Content generation stays as word-picker.** This is worth re-stating because it is a deliberate non-decision. The meta-cognition loop upgrade could tempt parallel upgrade to coherent prose. It should not. The meta-cognition upgrade is sufficient scope.

### Alternatives Considered

**Alternative 1 — Minimal (Opsi A from session):** Add "Target Focus" panel to post-session only (percentage bars showing performance on engine-chosen targets). Effort: minimal. Impact: partially closes gap. Rejected because it leaves intention-setting and attention-persistence unaddressed, so it fails to deliver the meta-cognition loop effect.

**Alternative 2 — Modest (Opsi B from session):** Pre-session briefing + post-session evaluation, skip during-session persistence. Effort: medium. Impact: two-thirds of the loop. Considered seriously as a scope-control compromise. Rejected because during-session persistence is what makes attention _sustained_, not just _set and reviewed_. Without it, user can read the briefing and then drift back into generic typing.

**Alternative 3 — Defer to Phase B.** Ship Phase A with meta-cognition surface only; elevate to structural loop after beta validation. Rejected because:

- This is a positioning concern, not a polish concern
- Phase A is supposed to validate positioning; shipping with surface-only meta-cognition validates a weaker positioning than the one the product genuinely intends
- User insight identified this as the most substantive gap from competitive observation; shipping without addressing it means Phase A beta data will be muddy (is kerf failing because of meta-cognition weakness, content-generation weakness, or something else?)

**Alternative 4 — Content generation upgrade (sentence bank or template-based prose).** Considered as an alternative fix for the "engagement gap" relative to TyperFast. Rejected in the same session because: (1) it addresses a different dimension (content feel) than the meta-cognition loop (structural engagement); (2) it has higher hidden scope (template authoring, POS tagging, content iteration loop); (3) word-picker sufficient for positioning validation. See session transcript 2026-04-20 for full deliberation.

### Related Changes

Docs requiring update (Pass 1 — spec layer, next session):

- **01-product-spec.md** (v0.4 → v0.5):
  - §1 positioning: refine differentiator #4 wording
  - §2 core values: add 2.5 "Meta-cognition is structural, not optional"
  - §5.3 adaptive mode: add deterministic target selection step; describe three-stage session flow
  - §5.7 meta-cognition dashboard: update to reflect dashboard as _deepening_ of in-session loop, not _replacement_ for missing loop

- **02-architecture.md** (v0.2 → v0.3):
  - §4 adaptive engine: add new layer "Target Selection" before "Exercise Generation"
  - Data model: `session_targets` table spec
  - Engine output struct definition
  - Target-performance computation logic

- **03-task-breakdown.md** (v0.2 → v0.3):
  - Task 2.4 revision: practice page integration now includes briefing state
  - Task 2.5 revision: post-session restructured around target evaluation
  - New tasks: pre-session briefing component, during-session target persistence, briefing copy library

Artifacts requiring update (Pass 2 — visual layer, separate session):

- **design/practice-page-wireframe.html** (v0.4 → v0.5 or v1.0):
  - State count: 4 → 5 (add "briefing" before "active typing")
  - Active typing state: add target strip, target key emphasis
  - Post-session state: restructure around intent ribbon + dot grid

- **design/index.html**: version bump, reflect new wireframe state count

Artifacts requiring update (Pass 3 — summary layer, separate session):

- **06-design-summary.md** (v0.4 → v0.5):
  - /practice section: document 5-state flow
  - Cross-page patterns: document briefing/evaluation as shared pattern (also applies to drill mode)
  - Revision history: v0.5 entry

### Execution Status

- **ADR written**: ✅ 2026-04-20
- **Pass 1 (spec docs)**: deferred to next session
- **Pass 2 (wireframes)**: deferred
- **Pass 3 (design summary + index)**: deferred

Until Pass 1 is complete, the v0.4 spec docs remain canonical. This ADR is **accepted intent**, not yet **implemented change**. Readers of the spec docs should be aware that ADR-001 is pending implementation.

**Update 2026-04-20 (same day)**: Later in the same session, ADR-002 surfaced insight that may affect ADR-001's implementation approach or framing. Pass 1 is now additionally gated on ADR-002 resolution. ADR-001's core thesis (meta-cognition as structural loop) likely remains valid regardless of ADR-002 outcome, but the _content_ of what sessions target (the "what" that briefings declare) depends on ADR-002's resolution.

---

## ADR-002: Split-Keyboard-Specific Practice Mechanisms (Draft, Not Accepted)

**Date drafted**: 2026-04-20
**Status**: Superseded by ADR-003 (2026-04-22) — content kept as historical record
**Effect if accepted**: Potential positioning correction + practice mode restructuring. May affect ADR-001 implementation.

### Why This Is a Draft, Not an Accepted Decision

This ADR surfaced late in a long session that had already produced one major architectural commitment (ADR-001). The developer explicitly chose to park the insight rather than commit same-session, recognizing that:

1. The insight potentially affects positioning fundamentally, not just feature selection
2. Fresh thinking is needed before commitment
3. ADR-001 is also unimplemented — two architectural shifts stacked without implementation feedback is risky

This draft preserves the insight with rigor so it can be revisited with clear thinking in a future session.

### Context

Through v0.2 (transition-focused pivot), kerf's split-keyboard specificity was built around these mechanisms:

1. **Transition-aware adaptive engine** — phase-aware weakness scoring coefficients
2. **Split-specific metrics** — inner column error rate, thumb cluster decision time, cross-hand bigram timing, columnar stability
3. **Correct split-keyboard visualization** — SVG keyboards with columnar finger assignments
4. **Accuracy-first copy + values**

In the 2026-04-20 session review, the developer performed a substance audit of these mechanisms and concluded (with Claude's concurrence) that most of what claims to be split-keyboard-specific is either (a) general adaptive typing behavior surfaced through a split-keyboard lens, or (b) weakly-grounded parameters (e.g. arbitrary phase coefficient values, moderate-accuracy columnar stability metric).

Subsequently, the developer revealed an insight from their own direct experience as a primary user:

> "Keyboard konvensional itu kan dari atas ke bawah tidak lurus, tapi dia staggered. Makanya perlu adjustment di situ. Kadang udah terbiasa outreach tapi di split yang columnar lebih lurus dari atas ke bawah. Aku terpikir exercise seperti type qazedcrfv dst yang drill atas ke bawah atau sebaliknya."

This exposed two critical problems with kerf's current architecture:

**Problem 1 — Wrong canonical pain point assumption.**

kerf v0.4 treats "inner column error rate" (B/G/H/N/T/Y) as the canonical transitioner pain point. This assumes **strict columnar finger assignment** — where each finger is mapped to exactly one column, and inner columns (index-finger columns on each hand) are the most reach-heavy.

But the developer — the product's primary persona — uses **conventional-like finger assignment**: F and J remain home row, left hand handles left letters, right hand handles right letters. Finger assignment is diagonal (like QWERTY), not strict columnar.

For conventional-mapping users on columnar physical keyboards, the pain point is not "inner column." It is **vertical reach per column**: muscle memory from row-staggered keyboards expects diagonal motion to reach upper/lower rows, but columnar physical layout requires straight vertical motion. The finger assignment logic is the same as QWERTY, but the physical motion needed to execute it is different.

**Problem 2 — No genuinely split-specific practice content.**

kerf's adaptive engine generates content via weighted word sampling from an English corpus. Weighting is by weakness score — words containing the user's weak characters appear more frequently. But the **content itself is generic English words**. A TypingClub user with weak B gets similar output to a kerf user with weak B. Only the finger assignment visualization differs.

Drill mode offers "letter B · 30 reps" — synthetic strings heavy on target characters. This is character-specific practice, not **split-keyboard-mechanism-specific** practice.

The developer's proposed exercise — `qazedcrfv...` — represents a categorically different practice mechanism: **columnar vertical reach drill**. It trains muscle memory for straight-vertical motion per column (left pinky: Q→A→Z, left ring: W→S→X, etc.). This is:

- Not an English word (adaptive engine cannot generate this)
- Not character-specific (it's motion-pattern-specific)
- Universally applicable to split keyboard users regardless of finger-assignment choice
- Directly addresses the row-staggered-to-columnar physical transition

### Problem Statement (The Real Question)

Is kerf's split-keyboard specificity **real** or **performative**?

Current mechanisms (phase coefficients, split-specific metrics, correct visualization) can be honestly described as:

- Correct visualization: genuinely substantive, hard to replicate
- Phase coefficients: tuning parameter exposed as transparency
- Split-specific metrics: 1.5 of 4 genuinely useful; others are weakly-grounded or abstract
- Adaptive engine: generic adaptive typing behavior with split-keyboard labels

If kerf is to genuinely deliver "structured transition program for split keyboards," it likely needs practice mechanisms that target **split-specific motor learning challenges**, not just generic adaptive typing applied to split keyboards.

### Preliminary Directions (Not Yet Proposals)

The following are directions to consider, not decisions to approve. Each has further questions requiring deliberation.

**Direction A — Columnar-motion practice library**

Curated drills that train physical motion patterns specific to columnar layouts:

- **Vertical column drills**: per-column top-to-bottom sequences (`qaz`, `wsx`, `edc`, `rfv`, etc.). Targets row-staggered-to-columnar physical adjustment.
- **Thumb cluster drills**: practice for thumb keys (space, enter, etc. on thumb cluster) which are universally new for split keyboard users.
- **Hand isolation drills**: left-hand-only or right-hand-only words that enforce clean hand separation.
- **Inner column drills** (for strict-columnar-mapping users only): reach drills for B/G/H/N/T/Y in columnar context.

These would be **first-class practice modes**, not variations of adaptive. The adaptive engine and these drill types serve different purposes: adaptive targets weakness in English output; these drills target split-keyboard motor learning.

**Direction B — Setup-aware product behavior**

Recognize that "split keyboard user" is not one journey. Different setups imply different transition challenges:

- Conventional finger assignment + columnar physical: vertical reach is the main challenge
- Strict columnar finger assignment + columnar physical: finger reassignment + inner column are main challenges
- Alternative layouts (Colemak, Dvorak): entire layout retraining + physical layout adjustment
- Home row mods: timing-sensitive layer activation training

Onboarding would detect or ask about setup style and select appropriate practice emphasis. This is a shift from "one-size-fits-transitioner" framing to **setup-aware framing**.

**Direction C — Honest positioning refinement**

If A and B are embraced, positioning shifts from "structured transition program" (implying single canonical transition) to something like "split-keyboard practice platform aware of your setup style." This is more accurate but less punchy. Or positioning remains but internal assumption is corrected.

Alternatively: narrow positioning to one specific setup style (e.g. "for transitioners going from conventional QWERTY to columnar layouts with strict columnar finger assignments") — making kerf genuinely focused but limiting addressable user base.

### Open Questions Requiring Deliberation

Before this ADR can be accepted, answer:

1. **Is conventional-mapping split keyboard use common enough to warrant supporting as a distinct journey?** Developer's own setup is conventional-mapping. Is this representative of a meaningful portion of split keyboard users, or developer is outlier?

2. **If "split keyboard practice" is many journeys, not one, can kerf's scope handle this for MVP?** Phase A MVP already at 13-20 weeks. Multi-setup support could double the content design work.

3. **Are curated drills (static library) or generated drills (algorithmic) appropriate for columnar motion practice?** `qazedcrfv` can be hard-coded. `wsxedcrfv` repeated in various patterns can be generated. Where is the right abstraction level?

4. **How does this interact with ADR-001 (meta-cognition loop)?** ADR-001's briefing declares "what this session targets." If session target is "vertical reach on left pinky column," that's a concrete intent that fits the loop well. ADR-001 may actually become _more_ meaningful with ADR-002 content, not less.

5. **Does this change the positioning of the product?** Refine from "transitioner-focused adaptive typing" to "split-keyboard motor-learning platform"? Or refine from "one transition journey" to "your transition journey"?

6. **What happens to existing kerf mechanisms that this exposes as weak?** Phase coefficients, columnar stability metric, phase transition auto-suggestion — keep as-is, simplify, or remove? Substance audit suggests several are performative.

7. **Is this a Phase A concern, or should we ship Phase A as-is and address in Phase B?** Previous substance audit discussion leaned toward pulling at least one impactful split-specific mechanism to Phase A. Is columnar motion practice the right candidate?

### What This Does Not Yet Include

This draft deliberately does NOT include:

- A proposed decision (the developer wants fresh-thinking deliberation)
- Timeline impact estimation (scope not yet defined)
- Data model additions (premature)
- Implementation plan (premature)
- A commitment to accept or reject — this is a thinking document, not a commitment

### Implications for ADR-001

ADR-001's core thesis (meta-cognition as structural loop — briefing, attention persistence, evaluation) is likely **unaffected** by ADR-002. The loop structure is content-agnostic.

But ADR-001's _content_ — what sessions target, what briefings declare — depends on ADR-002's resolution. Current ADR-001 examples reference "inner column (B, G, H, N, T, Y)" as target — which may not apply to conventional-mapping users.

**Recommended sequencing**:

- Resolve ADR-002 first (accept, reject, or revise)
- Then revisit ADR-001 to see if its examples and scope need adjustment
- Then begin Pass 1 spec implementation

### Related Changes (If Accepted — Not Applicable Yet)

If this ADR is eventually accepted, docs affected would include:

- 01-product-spec.md §1 (positioning), §5 (Phase A scope — likely adding split-specific drills as first-class practice mode), §5.3 (adaptive mode — clarify relationship with new drill library)
- 02-architecture.md §4 (engine — new module for drill library, possibly deprecate phase coefficient tuning or simplify it)
- 03-task-breakdown.md (add drill library tasks)

But this is speculation. Not actionable until ADR-002 resolves.

### Next Step

Developer to re-read this draft with fresh thinking — ideally after sleep, separated from the long session that produced it — and decide:

- Accept as-is
- Accept with modifications
- Reject (kerf's current mechanisms are sufficient, insight was over-extended)
- Revise and re-draft (insight valid but this framing is off)
- Merge with a revised ADR-001 (handle both together)

---

## ADR-003: Deliberate-Practice Architecture (v0.4 → v0.5)

**Date**: 2026-04-22
**Status**: Accepted — supersedes ADR-001 and ADR-002
**Version bump**: v0.4 → v0.5 (major — reshapes session model, engine architecture, onboarding, and positioning)

### Context

ADR-001 (accepted, pending) proposed restructuring the session as a three-stage meta-cognition loop, triggered by observing TyperFast's engagement model. ADR-002 (draft, parked) proposed a substance audit concluding that kerf's split-specificity was mostly generic adaptive typing wearing a split-keyboard label, and surfaced the developer's own finger-assignment style (conventional-mapping) as evidence that the product's canonical pain-point assumption (strict-columnar inner-column reach) was wrong for its primary persona.

In the 2026-04-22 session, the developer confirmed from 2–3 days of self-use that the product produced "no feeling of special something" — a felt signal consistent with ADR-002's substance audit (generic content wearing a split-keyboard label) more than ADR-001's structural-loop diagnosis.

Rather than resolve these sequentially, the developer chose to merge them into one decision: ADR-003. The synthesis:

1. **The substance insight from ADR-002 matters more than the structure insight from ADR-001**, because self-use evidence pointed at content-feel, not session flow. But ADR-001's loop framing becomes _stronger_ when paired with substantive motion-pattern content — briefing "vertical reach on your left-ring column" lands very differently from briefing "inner column characters because the formula output said so."
2. **The structural loop is pedagogically legitimate**, not merely competitor-cosplay. Deliberate practice (Ericsson's framework) literally requires attention on a specific sub-skill with immediate feedback. The original concern that structural attention contradicts Core Value 2.2 was misread: 2.2 rejects _reward-engineered_ engagement (streaks, FOMO, dopamine loops), not _skill-engineered_ attention.
3. **The platform refuses to judge.** Even with structural attention, the product does not declare per-session pass/fail. Numbers are surfaced; the user evaluates themselves. This line is load-bearing and distinguishes attention-without-verdict from typing-platform orthodoxy.

### Decision

Build kerf around a three-stage deliberate-practice session loop (briefing → attention-during → evaluation), driven by a new engine Target Selection layer that picks from character-level weaknesses AND motion-pattern weaknesses (vertical-column, inner-column, thumb-cluster), modulated by the user's self-declared finger-assignment journey (conventional or columnar), with the platform surfacing clear performance numbers and refusing to pronounce pass/fail on sessions.

Full content detailed in the six sub-sections below.

#### 1. Positioning & values resolution

**New positioning statement** (replaces `01-product-spec.md §1` current):

> "Deliberate practice for your split-keyboard transition. Setup-aware. Attention-driven. Accuracy-first."

Key shifts:

- "Structured transition program" → "Deliberate practice" — names the pedagogy explicitly, commits the product to it rather than borrowing its language.
- Add "Setup-aware" — recognizes that "split-keyboard user" is not one journey (the honest frame from ADR-002).
- Add "Attention-driven" — signals the in-session loop is intentional, not decorative.
- Keep "Accuracy-first" — unchanged. Still the arbiter of tradeoffs when speed and accuracy conflict.

**Differentiator #4 replacement** (replaces current "Meta-cognitive transparency"):

> "**Deliberate-practice session architecture**: every session is an explicit intent-attention-evaluation cycle. You know what you're working on before you start, it stays present while you practice, and you see exactly how you did on that thing afterward. The platform surfaces clear numbers; you judge yourself."

The last sentence is load-bearing — it's the plain-English form of the non-judge principle that all future copy must honor.

**Core Value 2.2 update:**

> "**Deliberate practice, not addictive practice.** The platform is a tool for focused skill acquisition, not a slot machine.
>
> Deliberate practice requires structural attention: explicit target, persistent focus during execution, honest evaluation after. kerf embraces this — every session is built around it.
>
> What kerf rejects is _reward-engineered_ engagement: streaks that punish, FOMO timers, celebratory verdicts, dopamine loops. These are engagement mechanisms dressed as pedagogy. kerf distinguishes the two: **skill-engineered attention is a learning accelerator; reward-engineered engagement is a retention tactic.** The first, we build into every session. The second, we refuse.
>
> Specific consequences:
>
> - No leaderboards or speed competitions.
> - No streak-break anxiety.
> - **No session pass/fail verdicts.** The platform surfaces target performance numbers; the user evaluates themselves.
> - Engine insight stays honest: if the user hasn't improved in 2 weeks, the platform says so."

**Explicitly not added:** a new Core Value 2.5 "Meta-cognition is structural, not optional" (as ADR-001 had proposed). Values describe what the product is for, not what it does to the user. The better frame is that deliberate practice is the value, and structural attention is simply how the product implements it.

#### 2. Setup-aware journey model

**Journey axis (Phase A):** finger-assignment style on columnar physical layout. Two journeys:

- **Conventional-mapping** — QWERTY-like finger habits on split columnar board. Index finger still handles the two innermost columns per hand; fingers still reach diagonally in the user's mental model. Primary pain: vertical motion per column (row-staggered muscle memory → columnar physical adjustment). Secondary: thumb cluster (universally new), hand-isolation. Non-pain: inner column reach — finger for B is still left index, already part of QWERTY.
- **Strict-columnar** — user retrains finger-to-column map; each finger on its own column. Primary pain: inner-column reach (new finger territory). Secondary: finger-reassignment friction, thumb cluster, hand-isolation.

**Shared across both:** thumb-cluster adjustment, hand-isolation drills, adjusting to split-column gap, accuracy-building on the new physical layout.

**Alternative setups deferred to Phase B:** Colemak, Dvorak, home-row mods — all explicit non-scope for Phase A.

**Onboarding capture:** one new question added to onboarding (after keyboard-type selection, before first practice session). Stored on `keyboard_profile.finger_assignment` as enum `"conventional" | "columnar" | "unsure"`.

Wording (first draft, approved for Phase A):

> **How do you type on your split keyboard?**
>
> ● **Like QWERTY, just on a split board** — fingers reach diagonally the way they did on your old keyboard; F and J are home. _(Common for people coming directly from standard QWERTY. No re-learning of finger placements.)_
>
> ○ **One finger per column** — each finger stays on its own column; you've retrained your fingers to the columnar layout. _(Common among people who took the full columnar plunge. Inner columns (B, N) are new reach territory.)_
>
> ○ **I'm not sure** — we'll make a good guess based on how you type and you can change this later.
>
> _You can change this anytime in Settings._

"Not sure" defaults to `conventional` (lower-friction transition path, more common for QWERTY converts). Flag captured as `unsure` internally so Phase B can later add a diagnostic session that infers the actual style.

**Per-journey product adaptation (Phase A scope):**

| Product layer                   | Conventional                                                                                                                                                   | Columnar                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Engine — weakness score         | `INNER_COLUMN_BONUS` = 0; `VERTICAL_REACH_BONUS` = 0.3 applies                                                                                                 | `INNER_COLUMN_BONUS` = 0.3; `VERTICAL_REACH_BONUS` = 0                                              |
| Engine — phase coefficients     | Kept per §6 Option C (honest reframe, not removal)                                                                                                             | Same                                                                                                |
| Drill library emphasis          | Primary: vertical-column drills. Secondary: thumb-cluster, hand-isolation, cross-hand                                                                          | Primary: inner-column drills. Secondary: vertical-column, thumb-cluster, hand-isolation, cross-hand |
| Briefing copy (motion language) | "Vertical reach on your left-ring column" / "smooth home-row-to-top-row transitions"                                                                           | "Inner column reach" / "building index-stretch memory"                                              |
| SVG finger coloring             | **Shared finger table** — `SOFLE_BASE_LAYER` works for both Phase A journeys. Variant added in Phase B if a real user reports a genuinely different assignment | Same shared table                                                                                   |
| Dashboard copy variants         | Deferred to Phase B                                                                                                                                            | Same                                                                                                |
| Inferred-style diagnostic       | Deferred to Phase B                                                                                                                                            | Same                                                                                                |

**Data model change (minimal):** `keyboard_profile` adds one nullable field — `finger_assignment VARCHAR NULLABLE`. Backward-compatible migration. Existing users see a one-time selection card before `/practice` on next login. Once answered, nullable → persisted value.

**What this deliberately doesn't do in Phase A:**

- No inferred-style diagnostic session; "Not sure" defaults to conventional.
- No mid-session journey switching; journey is a profile-level property.
- No "suggest switching journey" nudges when data diverges — violates quietly-affirming tone.
- No per-journey dashboard copy; weekly insight and trajectory are identical across journeys for Phase A.

#### 3. Columnar-motion drill library

Purpose: make kerf's split-specificity _real_ rather than performative. Every entry targets a motion pattern or reach pattern that generic typing platforms cannot produce from a dictionary.

**Five drill categories:**

1. **Vertical-column drills** _(primary for conventional; secondary for columnar)_ — per-column, top-to-bottom-to-top motion. Examples: left pinky `qaz zaq qazqaz`, left ring `wsx xsw wsxwsx`, left middle `edc cde edcedc`, left index col 3 `rfv vfr rfvrfv`, left index col 4 (inner) `tgb bgt tgbtgb`, mirror for right hand. Target type: `vertical-column`, with `hand` + `finger` metadata.

2. **Inner-column drills** _(primary for columnar; secondary for conventional)_ — focused on B, G, T (left) and Y, H, N (right). Partially exists today via `generateInnerColumnDrill` in `drillGenerator.ts`. ADR-003 keeps it and adds curated alternating-hand variants (e.g. `gh bn ty`). Target type: `inner-column`, with `hand` metadata.

3. **Thumb-cluster drills** _(universal)_ — builds thumb-key activation without hand-displacement. Space-heavy short-word sequences. Phase A MVP targets just the space bar; enter/backspace deferred. Target type: `thumb-cluster`.

4. **Hand-isolation drills** _(universal)_ — already implemented as a filter via the `HandIsolation` type in `exerciseGenerator.ts`. ADR-003 promotes it to a first-class briefable target category rather than a quiet filter toggle. Target type: `hand-isolation`, with `hand` metadata.

5. **Cross-hand bigram drills** _(universal)_ — already exists via `generateCrossHandBigramDrill`. ADR-003 keeps it and promotes it to a first-class briefable target. Target type: `cross-hand-bigram`.

**Integration with adaptive mode (Option Y adopted):** engine's Target Selection layer (§5) picks between character/bigram targets and motion-pattern targets per session. If a motion-pattern target is selected, the session's exercise comes from the drill library; if a character/bigram target is selected, the session uses word-sampling (existing `generateExercise` path). The briefing (§4) then declares what was picked. Drill mode retains user-driven target selection as manual override.

**Bundling and content storage:** static JSON, bundled client-side — same pattern as the current word corpus. Exercise strings are **pre-authored, not runtime-sampled** (motion drills don't benefit from weighted word-sampling — they're curated sequences). Schema:

```ts
type DrillLibraryEntry = {
  id: string; // e.g. "left-ring-vertical-basic"
  category: DrillCategory;
  target: {
    type: DrillCategory;
    label: string; // "Left ring column vertical reach"
    keys: string[]; // keys involved — for briefing + post-session dot grid
    hand?: "left" | "right";
    finger?: Finger;
  };
  exercise: string; // the actual typed content — "wsx xsw wsxwsx"
  briefing: {
    conventional: string; // journey-specific briefing copy
    columnar: string;
  };
  appliesTo: JourneyCode[];
  estimatedSeconds: number;
};
```

**Phase A authoring target:** ~33 entries — ~20 vertical-column (10 columns × 2 variants), ~8 inner-column (curated variants + existing generator), ~5 thumb-cluster; hand-isolation (0 new, uses existing filter), cross-hand-bigram (0 new, uses existing generator). Content is Claude-Code-authored in the implementation session using the finger table (mechanical for exercise strings); human review focuses on briefing copy templates in §4.

**Per-journey emphasis (ties back to §2) — library is not per-entry per-journey; what differs is which entries the engine weights higher:**

| Journey      | Weighting (rough starting values, hand-tuned, to be revisited with beta data)                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Conventional | Vertical-column: ×1.0, inner-column: ×0.4, thumb-cluster: ×0.8, hand-isolation: ×0.6, cross-hand bigram: ×0.6 |
| Columnar     | Vertical-column: ×0.5, inner-column: ×1.0, thumb-cluster: ×0.8, hand-isolation: ×0.6, cross-hand bigram: ×0.6 |

**Drill mode UI impact:** `/practice/drill` gets two new presets — "Vertical reach" (user picks a column) and "Thumb cluster" (space-heavy exercise). Existing presets ("Drill weakness", "Inner column") unchanged. "Warm up" preset stays disabled as today.

**Deferred to Phase B:** drill library editor/CMS, user-created drills, drill difficulty progression (beginner/intermediate variants), LLM-generated drill content (reaffirmed — CLAUDE.md §B7 stays), drill-specific analytics panel on dashboard.

#### 4. Three-stage session loop (attention without verdict)

**Stage 1 — Briefing (pre-session):**

Role: declare this session's target clearly enough that attention can hold it through execution. Replaces the current minimal "What will you practice?" pre-session.

What's declared:

1. Target name (e.g. "Left-ring column vertical reach", "Inner-column reach — B, G, T", "Your weakness: G")
2. Short motion/reason copy (2–3 lines, from template library below)
3. Target keys visualized — a compact view showing which keys this session touches (not the full keyboard SVG; a small diagram)

**Explicitly NOT declared:**

- No numerical success threshold
- No "target met / missed" future-tense framing
- No "do X% or better" instruction
- No duration challenge

**Advance mechanism:** explicit start action (Enter or click). Not auto-dismiss — pedagogical activation, not passive consumption.

**Re-show / skip behavior:** briefing is non-skippable on first session of the day for a given target category. Subsequent same-day same-target sessions show a compact variant (target name + 1 line) to reduce fatigue. One `seen today` flag per target category.

**First-session (diagnostic) special case:** Template V7 — "Capturing your baseline on this split keyboard."

**Stage 2 — Execution with persistent attention:**

**Target ribbon placement:** one-line strip **above the typing text area** (where user attention naturally sits — confirmed during ADR drafting).

Visual design:

- Small text, neutral color (ivory-on-cream, not amber, not red)
- Small category icon on the left
- Target keys listed inline (e.g. `◎ Target: left-ring column — W S X`)
- **Static** — does not update per keystroke

**Keyboard SVG target emphasis:** target keys get a subtle border outline (not a fill color — fill reserved for cursor amber and error red). Thin ivory ring around target keys. Applies to drill and adaptive alike.

**What the ribbon does NOT do (load-bearing constraint):**

- **No live accuracy percentage during session.** A live "42% target accuracy so far" number would be a verdict-in-progress — the exact anti-pattern we rejected.
- **No live progress bar** ("3 of 5 target keystrokes complete") — same reason.
- **No color change based on performance.** Ribbon stays neutral regardless of how the session is going.

The principle: attention-setting is structural; judgment is not. The ribbon reminds the user what this session is about. The user judges the outcome for themselves in Stage 3.

**Stage 3 — Evaluation (post-session):**

Layered onto the existing post-session summary. Adds:

1. **Intent echo block** above existing summary: "You targeted: [target label]."
2. **Target performance breakdown** — per-target-key accuracy and attempt count, surfaced as plain numbers in a small table:
   ```
   W · 94% accuracy · 18 attempts
   S · 98% accuracy · 24 attempts
   X · 87% accuracy · 12 attempts
   ```
3. **Soft next-session preview:** "Next session will likely focus on: [engine-derived next target]. (You can override by picking a drill mode.)" — engine-transparency flavor per Core Value 2.4, not success-path flavor.

Existing sections (emergent weaknesses, error patterns, WPM + accuracy hero) retained below.

**What is NOT surfaced:**

- No "target met / target missed" badge.
- No celebratory language even on 100% target accuracy.
- No concerning language on low accuracy. Low accuracy is data, not failure — the text just shows the number.
- No score / grade / rank.
- No unlock / progression feel.

**Integration across modes:**

- **Adaptive mode:** engine's Target Selection picks the target; briefing fills from template; during-session ribbon shows target; post-session evaluates against target.
- **Drill mode:** user picks target via drill card selection; briefing still shows with the selected target; during-session ribbon shows target; post-session evaluates against target. Same loop, user-driven target.
- **First session (diagnostic):** briefing declares "baseline capture"; no target ribbon during (nothing specific to attend to); post-session evaluates whole-session baseline.

**Briefing copy templates (approved first drafts — owned by Claude, user reviews):**

Each template has placeholders in `{braces}` filled from drill metadata or engine output. Per-journey variants where motion language differs.

**Template V1 — Vertical-column drill**

_Conventional journey:_

> "Your **{finger}** column runs vertical on this board: **{topKey}** on top, **{homeKey}** on home, **{bottomKey}** below.
> Row-staggered muscle memory expects diagonal reach — columnar boards want straight vertical motion.
> This session trains the shift."

_Columnar journey:_

> "Column practice — **{finger}**, keys **{topKey} {homeKey} {bottomKey}**.
> Clean vertical transitions build the finger's sense of its own column.
> Focus on smoothness, not speed."

**Template V2 — Inner-column drill**

_Conventional:_

> "Inner column focus — **{keys}**.
> These are a stretch for your index finger on any keyboard; the split gap makes them less forgiving.
> Accuracy leads, speed follows."

_Columnar:_

> "Inner column reach — **{keys}**.
> The stretch from home row into the inner column is where new columnar fingers build memory.
> Take your time; clean reaches count more than fast ones."

**Template V3 — Thumb-cluster drill** _(shared, both journeys)_

> "Short words, lots of spaces.
> Your thumb is learning a new job — activating the space key without pulling your hand out of position.
> Notice how your thumb feels after each word."

**Template V4 — Hand-isolation drill** _(shared)_

> "This session isolates your **{hand}** hand — the other hand stays at rest.
> Isolated practice trains clean hand separation: each hand moves on its own.
> Watch for your resting hand creeping toward the keys."

**Template V5 — Cross-hand bigram drill** _(shared)_

> "Cross-hand transitions — key pairs where one hand hands off to the other.
> Smooth hand-to-hand bigrams are the foundation of flow.
> When one hand lags, the other waits."

**Template V6 — Character/bigram target (adaptive word-sampling default)** _(shared)_

> "This session leans on **{target}** — one of your current weaknesses.
> The words you'll type are weighted to give **{target}** extra reps.
> Accuracy on **{target}** is what we're watching."

**Template V7 — Diagnostic first session** _(shared)_

> "Capturing your baseline on this split keyboard.
> No specific focus yet — we'll build the plan from what this session reveals.
> Type naturally; don't over-think accuracy."

**Explicit non-features (Phase A):**

- No per-session numerical goal / threshold.
- No verdict badges.
- No celebratory animations on "good" sessions.
- No gentle-reprimand copy on "bad" sessions.
- No streak-based target progression.
- No target "unlock" mechanics.

#### 5. Engine + data model changes

**New engine layer — Target Selection.** Lives between weakness scoring and exercise generation:

```
┌──────────────────┐
│ Weakness scoring │  (existing — computeWeaknessScore per char/bigram)
└────────┬─────────┘
         ↓
┌────────────────────┐
│ Target Selection   │  (NEW — picks what this session is for)
└────────┬───────────┘
         ↓
┌───────────────────────────────┐
│ Exercise generation           │
│  character/bigram → words     │  (existing path: generateExercise)
│  motion/column   → drill      │  (new path: drill library lookup)
└───────────────────────────────┘
```

**Target Selection's job:** given stats, phase, and journey, evaluate a pool of candidate targets and pick the one with highest (weakness-score × journey-weight).

**Candidate types and score derivation** (all derivable from existing character/bigram stats — no new data capture required):

| Candidate              | Score derivation                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character target       | Existing `computeWeaknessScore` on `CharacterStat`; highest-scoring char                                                                              |
| Bigram target          | Existing `computeWeaknessScore` on `BigramStat`; highest-scoring bigram (includes cross-hand bigrams)                                                 |
| Vertical-column target | Aggregate error rate across the 3 keys in a column (top/home/bottom), normalized against baseline. 10 candidates (5 columns × 2 hands); best one wins |
| Inner-column target    | Aggregate error rate across B/G/T (left) or H/N/Y (right), normalized. 2 candidates                                                                   |
| Thumb-cluster target   | Space-key error rate (MVP). Above threshold = eligible                                                                                                |

**Journey-aware selection weighting:**

```ts
TARGET_JOURNEY_WEIGHTS = {
  conventional: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 1.2, // promoted — primary pain
    "inner-column": 0.6, // demoted — not the pain point
    "thumb-cluster": 1.0,
  },
  columnar: {
    character: 1.0,
    bigram: 1.0,
    "vertical-column": 0.8,
    "inner-column": 1.2, // promoted — primary pain
    "thumb-cluster": 1.0,
  },
};
```

Selected target = `argmax(candidate.score × journey_weight[candidate.type])`. Weights are hand-tuned starting values; the transparency panel says so explicitly.

**Hand-isolation and cross-hand-bigram as targets:** these stay drill-mode-only (user-initiated, not engine-selected). Reason: hand-isolation weakness isn't diagnostic (the "whole hand slow" signal is diffuse); cross-hand bigrams already fold into the bigram candidate path.

**Low-confidence fallback:** `isLowConfidence(stats)` from current weakness logic → default target = `"diagnostic"` (Template V7 briefing). Covers first sessions and cold-start scenarios.

**Exercise generation change:**

```ts
// BEFORE
generateExercise(corpus, profile, filters): Word[]

// AFTER — wraps Target Selection + generation
generateSession({
  phase, journey, stats, corpus, options
}): SessionOutput

type SessionOutput = {
  target: SessionTarget
  exercise: Word[]                // keep Word[] — drill strings treated as "words"
                                  //   to preserve uniform word-boundary UI handling
  briefing: {
    text: string                   // filled from templates §4
    keys: string[]                 // target keys for ribbon + SVG outline
  }
  estimatedSeconds: number
}

type SessionTarget = {
  type: "character" | "bigram" | "vertical-column" | "inner-column"
      | "thumb-cluster" | "hand-isolation" | "cross-hand-bigram" | "diagnostic"
  value: string                    // e.g. "G", "th", "left-ring", "left"
  keys: string[]                   // actual keys involved
  label: string                    // human-readable
  score?: number                   // debugging/transparency; null for user-picked
}
```

**`generateExercise` becomes a subroutine** — called by `generateSession` when selected target type is character/bigram. Drill library lookup handles motion/column target types. Existing callers get a shim that fills `target` from the result. Lowest-risk refactor shape.

**Drill mode integration:** drill mode's user-selected target skips the Target Selection algorithm and feeds directly into `generateSession` with pre-supplied `target` param. Same signature, just with target pre-derived from user input.

**Data model — new `session_targets` table:**

```sql
CREATE TABLE session_targets (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- What was declared (at session start)
  target_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  target_keys TEXT[] NOT NULL,
  target_label TEXT NOT NULL,
  selection_score NUMERIC,             -- null for user-picked (drill mode)
  declared_at TIMESTAMPTZ NOT NULL,

  -- Measured outcome (filled at session end)
  target_attempts INTEGER,
  target_errors INTEGER,
  target_accuracy NUMERIC(5,4),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_targets_session ON session_targets(session_id);
CREATE INDEX idx_session_targets_type_value ON session_targets(target_type, target_value);
```

**Why separate table (not JSON column on `sessions`):** target history is queryable (powers soft next-target preview), indexable by type+value for future analysis, clean one-to-one relationship that doesn't block hypothetical Phase B multi-target sessions.

**Migration:** historical sessions (pre-ADR-003) have no target record → post-session intent-echo block just doesn't render for those. All new sessions go through Target Selection; target row created at session start, outcome filled at session end.

**Target-performance computation:**

- **During session:** `useKeystrokeCapture` already captures every keystroke with correct/incorrect. Add derivation: on each keystroke, if character is in `target.keys`, increment `target_attempts` (and `target_errors` if incorrect). Client-side state only during session — no network round-trip per keystroke. Accumulator in `sessionStore`.
- **At session end:** accumulated target counts persisted to `session_targets` as part of existing `persistSession` transaction. Single write, no new round-trip.
- **Post-session display:** already-captured target metrics surface in the Stage 3 "How it went on those keys" block. Per-target-key breakdown requires iterating already-stored keystrokes and filtering to target keys. Pure client computation.

**Journey-aware weakness score update.** `computeWeaknessScore` grows a `journey` parameter. Existing call sites get the journey from `UserBaseline` (added at load time from `keyboard_profile.finger_assignment`).

```ts
// BEFORE (existing)
INNER_COLUMN_BONUS = 0.3; // hardcoded — applied to all inner-column chars
//  in transitioning phase, regardless of journey

// AFTER (ADR-003)
JOURNEY_BONUSES = {
  conventional: {
    INNER_COLUMN_BONUS: 0, // not their pain point
    VERTICAL_REACH_BONUS: 0.3, // their pain point
  },
  columnar: {
    INNER_COLUMN_BONUS: 0.3, // stays
    VERTICAL_REACH_BONUS: 0, // not primary for them
  },
};

// VERTICAL_REACH_BONUS applies when a character's row differs from home row
// (row 1 or row 3), scaled by the per-column error aggregate.
```

Honest framing in transparency panel: these bonus values are hand-tuned; the transparency copy says so explicitly. Per §6 Option C.

**New modules (domain, pure, testable):**

- `src/domain/adaptive/targetSelection.ts` — exhaustive unit tests per CLAUDE.md §B8
- `src/domain/adaptive/motionPatterns.ts` — derives vertical-column, inner-column, thumb-cluster scores from character stats
- `src/domain/adaptive/drillLibrary.ts` + `drillLibraryData.ts` — loader + static content

**What §5 commits the implementation to:**

- New pure-domain modules (above)
- Refactor: `generateExercise` wrapped by new `generateSession` (backward-compatible shim pattern)
- New DB table + Drizzle schema: `session_targets`
- `persistSession` extended to write one `session_targets` row per session
- `keyboard_profile` gets `finger_assignment` column (§2)
- `UserBaseline` type gets `journey: JourneyCode` field

**Deferred to Phase B:** multi-target sessions, target-history-influenced next-target selection (beyond trivial "don't pick same target twice in a row"), learned parameter tuning, user-level weakness-score customization, A/B variants of target selection.

#### 6. Scope boundaries, timeline, risks, reframe decisions

**Phase A commits (ADR-003 ships with):**

| Area                      | Committed                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Setup-awareness           | Onboarding journey question, DB migration, engine journey branching, Settings toggle, shared SVG finger table                   |
| Drill library             | All 5 categories, ~33 entries, client-side bundled JSON                                                                         |
| Session loop              | Briefing stage, during-session target ribbon (static, no live counter), post-session intent echo + target performance breakdown |
| Attention-without-verdict | No thresholds, no pass/fail badges, no celebratory or reprimand copy                                                            |
| Engine                    | `targetSelection.ts`, `motionPatterns.ts`, `generateSession` wrapping existing `generateExercise`, `session_targets` table      |
| Transparency reframe      | Honest copy on coefficients, columnar stability "experimental", phase-transition "engine hypothesis" framing                    |
| Positioning               | v0.5 positioning statement, refined Differentiator #4, updated Core Value 2.2                                                   |

**Phase B deferred (explicit list — these do NOT ship in Phase A):**

- Inferred-style diagnostic session (data-driven journey classification)
- Per-journey dashboard copy variants
- Mid-product journey switching with data retuning
- Drill difficulty progression (beginner/intermediate variants)
- User-authored drills / drill CMS
- Alternative layouts (Colemak, Dvorak, home-row mods)
- Multi-target sessions
- Target-history-influenced next-target selection (beyond trivial "don't repeat" rule)
- Learned parameter tuning (engine weights stay hand-set)
- Advanced post-session visualizations (motion-pattern diagrams, hand silhouettes)

**Timeline estimate:**

| Work stream                                                                 | Estimate                           |
| --------------------------------------------------------------------------- | ---------------------------------- |
| Journey capture (onboarding Q + migration + engine branch)                  | 3–4 days                           |
| Drill library (content gen + loader + data file)                            | 2–3 days (Claude-authored content) |
| `targetSelection.ts` + `motionPatterns.ts` + tests                          | 5–7 days                           |
| `generateSession` refactor + `session_targets` + `persistSession` extension | 3–5 days                           |
| Briefing UI + target ribbon + post-session intent-echo block                | 5–7 days                           |
| Template copy authoring + review pass                                       | 2 days                             |
| Transparency reframe (copy-only updates)                                    | 1–2 days                           |
| Integration + test + debug                                                  | 5–7 days                           |
| **Total**                                                                   | **~5–7 weeks of Claude Code work** |

Solo part-time developer calendar time: **6–9 weeks** with review cycles. Revised Phase A MVP estimate: **~18–26 weeks total** to beta launch (up from 12–18 weeks pre-ADR).

**Risks and mitigations:**

| Risk                                                                                                  | Mitigation                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Briefing fatigue — reading 3-line briefing every session gets old                                     | Compact variant (target name + 1 line) for same-target same-day repeats; explicit skip action; templates enforced ≤3 short lines                                                                                 |
| During-session ribbon distraction — ribbon competes with typing focus                                 | Neutral color, small font, static (no animation, no live counter), placed above typing text where attention already sits. Beta-signal-driven — if users report distraction, reduce or make toggleable in Phase B |
| Journey misclassification at onboarding — user picks wrong journey, engine tunes for wrong pain point | "Not sure" defaults to conventional (more common); Settings toggle allows change; Phase B inferred diagnostic as safety net                                                                                      |
| Verdict-drift in future copy — once "no verdict" principle is set, future additions could slip        | Add explicit rule to CLAUDE.md §B3: "No session pass/fail verdicts. Platform surfaces numbers; user evaluates themselves." Load-bearing for every future Claude Code session                                     |
| Content quality — drill library is small (~33 entries), each entry matters                            | Exercises are mechanical (derivable from finger table); briefing copy templates reviewed pre-launch in implementation PR                                                                                         |
| Scope creep during implementation — tempting to add "just one more" category                          | ADR-003 locks scope; new categories require explicit ADR-004                                                                                                                                                     |
| Two architectural shifts stacked without user feedback (original ADR-002 concern)                     | Addressed: developer did 2–3 days self-use before locking ADR-003 direction; content-first prioritization came from actual self-use signal, not speculation                                                      |

**Reframed per Option C (honest reframe, no code removal):**

- Phase coefficients transparency panel copy → "These coefficients are hand-tuned starting values, not derived from your data — we'll revisit with beta feedback."
- Columnar stability metric label → "Columnar stability (experimental)" with explanatory footnote
- Phase-transition auto-suggestion banner → framed as "engine hypothesis, you decide"
- Differentiator #4 → "Deliberate-practice session architecture" (per §1)
- Core Value 2.2 → clarified with skill-engineered vs reward-engineered distinction (per §1)

**Dropped from earlier drafts (not shipping):**

- Proposed Core Value 2.5 "Meta-cognition is structural, not optional" (ADR-001) — conflicts with refined 2.2 framing
- Numerical success thresholds per session (ADR-001) — violates attention-without-verdict
- "Target met / missed" verdict badges (ADR-001) — violates attention-without-verdict
- Live during-session target performance counter (ADR-001) — became static ribbon
- ADR-001's "next target preview" as implicit progression — replaced with soft engine-transparency form

**Stays unchanged (reassurance):**

- Core Values 2.1, 2.3, 2.4
- Tech stack (Tanstack Start, better-auth, Resend, Drizzle, Tailwind)
- Drizzle sessions/stats schema
- TypingArea, LiveWpm, pause behavior, keystroke capture
- Dashboard 6-section layout
- Drill mode location (`/practice/drill`)
- Keyboard SVG rendering (adds optional target-keys outline prop)
- `generateExercise` (becomes subroutine under `generateSession`)

### Alternatives Considered

1. **Keep ADR-001 and ADR-002 as separate sequential ADRs.** Rejected because the same underlying insight drove both; self-use evidence pointed at content-substance gaps that only the combined decision could address.

2. **Lightweight intent-echo loop** (pre-session target declaration + post-session echo, no during-session attention persistence). Rejected after developer clarification: attention persistence is pedagogically load-bearing for deliberate practice, not optional framing. Skipping it would preserve generic-feeling practice.

3. **Ship v0.4 as-is for extended self-beta before acting on either ADR.** Partially adopted — 2–3 days of self-use provided the "content feels generic" evidence that tipped ADR-003's center of gravity toward ADR-002's content direction rather than ADR-001's structure direction. Longer self-beta was not pursued because the signal was clear enough after 2–3 days.

4. **Narrow positioning to one journey only** (e.g. conventional-mapping only in Phase A, add strict-columnar in Phase B). Rejected because developer explicitly chose setup-awareness as a positioning claim, not aspiration.

5. **Keep ADR-001's declared numerical thresholds and pass/fail verdicts.** Rejected because platform-pronounced verdicts conflict with quietly-affirming tone and risk the exact reward-engineering anti-pattern Core Value 2.2 rejects. Attention without verdict preserves pedagogy without coercion.

6. **Remove weakly-grounded metrics from ADR-002 audit entirely** (phase coefficients, columnar stability metric, phase-transition suggestion). Rejected; Option C (honest reframe, no removal) adopted. Lower scope risk, preserves shipped work, improves honesty via copy-only changes.

7. **Keep drill library strictly separate from adaptive mode** (Option X in §3 discussion). Rejected; Option Y adopted — engine's Target Selection can pick motion-pattern targets and pull from drill library. Makes briefings substantive ("vertical reach on your left-ring column") rather than shallow ("inner column characters because formula said so").

8. **Author drill exercise content via LLM generation.** Rejected; pre-authored static content is finite but curated-quality, and CLAUDE.md §B7 (word-picker, not LLM) stays in effect for exercise content.

9. **Add explicit per-journey SVG finger-assignment variant.** Rejected for Phase A; investigation of `SOFLE_BASE_LAYER` showed the finger table works for both Phase A journeys. Variant added in Phase B if a beta user reports a genuinely different assignment.

10. **Inferred-style diagnostic session in Phase A.** Rejected for Phase A; explicit onboarding question covers 95% of users. Phase B addresses remaining ambiguity if beta signal shows it's needed.

### Related Changes

**Pass 1 — spec layer (next session):**

- `01-product-spec.md` (v0.4 → v0.5):
  - §1 positioning statement (per §1 above)
  - §2 Core Value 2.2 update (per §1 above)
  - §5.3 adaptive mode (three-stage session loop)
  - §5.5 targeted drill submode (expanded with new presets)
  - §5.7 meta-cognition dashboard (framed as deepening of in-session loop, not replacement)
- `02-architecture.md` (v0.2 → v0.3):
  - §4 adaptive engine (add Target Selection layer, motion patterns, journey-aware weakness scoring)
  - Data model: `session_targets`, `finger_assignment` column
  - Engine output struct (`SessionOutput`, `SessionTarget`)
- `03-task-breakdown.md` (v0.2 → v0.3):
  - New Phase A tasks for ADR-003 implementation; re-order if needed
- `CLAUDE.md`:
  - §B2 — journey parameter alongside phase in engine functions
  - §B3 — explicit rule "No session pass/fail verdicts. Platform surfaces numbers; user evaluates themselves."

**Pass 2 — wireframes (separate session):**

- `design/practice-page-wireframe.html` → new briefing state (state count 4 → 5), active typing state with target ribbon above text area, post-session with intent-echo block
- `design/onboarding-wireframe.html` → finger-assignment question
- `design/index.html` → version bump, reflect new wireframe state count

**Pass 3 — design summary (separate session):**

- `06-design-summary.md` (v0.4 → v0.5):
  - `/practice` section: document 5-state flow
  - Cross-page patterns: briefing/evaluation as shared pattern (also applies to drill mode)
  - Revision history entry for v0.5

### Execution Status

- **ADR-003 drafted and accepted**: ✅ 2026-04-22
- **Pass 1 (spec docs + CLAUDE.md)**: deferred to next session
- **Pass 2 (wireframes)**: deferred to separate session
- **Pass 3 (design summary)**: deferred to separate session
- **Implementation plan**: next step after ADR acceptance — invoke `writing-plans` skill in a separate session; no code changes in ADR session
- **ADR-001 and ADR-002**: superseded by ADR-003; content kept above as historical record showing the reasoning chain that led to ADR-003

Until Pass 1 completes, v0.4 spec docs remain canonical; readers should treat ADR-003 as the authoritative intent.

---

## ADR-004: Open-Core Licensing and Distribution

**Date**: 2026-04-24
**Status**: Accepted
**Version bump**: none (orthogonal to product version; no spec-doc changes)

### Context

kerf is pre-launch with no real users (per `MEMORY.md` / `project_prelaunch_status.md`). The question "open source or closed source" surfaced before any licensing decision had been made — the repo had no LICENSE file, which legally defaults to "all rights reserved" and blocks both contribution and self-hosting.

Relevant facts shaping the decision:

1. **The code is not the defensible asset.** The typing UI, word-picker, session flow, and engine are rebuildable by a moderately skilled developer in a weekend. The moat is the pedagogy (transition-phase model, accuracy-first copy, target-selection heuristics per ADR-003), the curated word corpus, and eventual ongoing refinement from real user data. A closed-source license does not protect any of those; a public repo does not leak any of those.
2. **The target audience is FOSS-sympathetic.** Split-keyboard culture orbits QMK, ZMK, VIA, Vial, Oryx's firmware — all open. A closed-source typing trainer aimed at that crowd pays a trust tax that a closed-source tool aimed at, e.g., enterprise SaaS buyers would not.
3. **Niche × solo × part-time ceiling.** Realistic upper bound for a pure-SaaS split-keyboard typing trainer is a few hundred to low thousands of paying users globally. That is "nice side income," not "full-time sustainable." Over-indexing on monetization protection pre-launch is premature optimization against a constraint that does not yet exist.
4. **Pre-launch, license choice has ~zero ROI on traction and ~∞ ROI on regret risk.** Getting to 100 engaged users matters more than margin protection. The license can be tightened later if justified (same repo can be relicensed for future contributions under OSI-compatible terms; existing MIT code remains MIT forever, which is the intended property).

### Decision

**Open-core with an MIT-licensed public repo for all Phase A artifacts.**

1. **License:** MIT, applied to the full repo — client, engine, corpus, docs, configs, wireframes. Added as `LICENSE` at repo root with copyright line `Copyright (c) 2026 Falahudin Halim Shariski`.
2. **Public repo:** the existing repo becomes (or remains) publicly accessible, with its full commit history. No rewrite. No squash.
3. **Hosted paid layer deferred.** No Phase A work on subscription infrastructure, payment, license-keys, or entitlement code. The hosted-vs-self-hosted split does not need to exist until there is evidence someone would pay for the hosted version.
4. **Revisit trigger: 500 weekly-active users.** At that milestone, re-evaluate whether a paid hosted tier (cloud sync, cross-device progress, premium corpora/layouts, etc.) is worth building. Below that threshold, treat kerf as a community tool.
5. **Trademark "kerf"** — developer-scope action (per `CLAUDE.md §B9`), tracked outside this repo. The permissive code license does not grant trademark rights, so a reserved mark keeps the door open for a future commercial hosted service without blocking the OSS code.

### Consequences

**Immediate:**

- `LICENSE` file added at repo root.
- Repo can now accept drive-by PRs, forks for self-hosting, and derivative work without legal ambiguity.
- No changes to Phase A scope, timeline, or product surface.

**Design implications (future-facing, not pre-emptive):**

- Telemetry / analytics must be explicit and consent-based from day one. Relying on "we're closed so we own the data" is not an option, and the accuracy-first / non-judging values in Core Value 2.2 already point in this direction anyway.
- Features should be designed to run standalone. If a Phase B feature requires a hosted-only backend, that is a deliberate choice that justifies the hosted tier — not an accidental coupling.
- When external contributions arrive, a `CONTRIBUTING.md` and possibly a DCO/CLA decision will be needed. Not pre-emptive; write them when the first contribution is imminent.

**Explicit non-consequences:**

- No CONTRIBUTING.md yet (no contributors yet).
- No dual-license scheme. The repo is MIT, full stop.
- No "core vs. commercial" code split in the codebase today. Open-core is a _future_ product shape; the code today is entirely OSS.
- No rush to announce publicly. The license decision enables openness; timing of the public announcement is a separate call.

### Alternatives Considered

1. **Pure closed-source SaaS.** Rejected. Code isn't defensible (point 1 above); audience is FOSS-sympathetic (point 2); monetization ceiling doesn't justify the trust tax (point 3). Closed-source SaaS works when the product itself is the protected asset (complex ML, proprietary data, network effects) — none apply here.

2. **Pure OSS with donations / sponsorships.** Rejected as a _complete_ strategy. Historical income-negative pattern for solo devs in niches this small; if the hosted layer eventually becomes valuable, purist OSS forecloses the option. Does not rule out accepting sponsorships once there is an audience; rules out relying on them as the business model.

3. **Source-available license (BSL, PolyForm Small Business, SSPL).** Rejected as premature optimization. These licenses exist to prevent a well-resourced competitor (AWS, etc.) from taking your code and running a competing hosted service. That threat does not apply to a pre-launch typing trainer for a niche hobbyist audience. Complexity cost of a non-OSI license is real (reduced drive-by contributions, confusion, lower visibility on OSS indexes) and not justified by the threat it protects against.

4. **Apache-2.0 instead of MIT.** Considered. Apache-2.0 offers an explicit patent grant and slightly stronger contributor clarity. Rejected for two reasons: (a) patent risk on a client-side typing trainer is negligible — there is no patentable surface area; (b) MIT is the ecosystem default in JS/TS and matches contributor expectations for this kind of project. Either would be defensible; MIT is marginally simpler and more familiar.

5. **Keep repo private, make public later.** Rejected. The value of public visibility is partly cumulative (trust built over time, search-indexed docs, drive-by interest). Delaying removes that compounding for no offsetting benefit — the repo is already in a presentable state and already licensed-compatible with public release.

### Related Changes

- `LICENSE` added at repo root (MIT).
- No spec-doc updates required (ADR-004 does not change the product; updating `01-product-spec.md` or `02-architecture.md` would be noise).
- Not a tracked task in `README.md` `## Status` — strategic decisions are not task units per `CLAUDE.md §B11`.
- Future (not in this ADR's commit): `CONTRIBUTING.md` when first external contribution arrives; trademark filing on developer scope; revisit at 500 WAU.

### Execution Status

- **ADR drafted and accepted**: ✅ 2026-04-24
- **LICENSE file committed**: ✅ 2026-04-24 (same PR as this ADR)
- **Trademark reservation**: pending — developer scope, out of repo
- **500 WAU revisit**: future

---

## Version Timeline (Reference)

For context when reading ADRs above:

| Version | Date       | Summary                                                                                                                                  |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1    | 2026-04-17 | Initial consolidation (leftype-rightype)                                                                                                 |
| v0.2    | 2026-04-18 | Transition-focused pivot                                                                                                                 |
| v0.2.1  | 2026-04-18 | Vim scroll shortcuts (post-session)                                                                                                      |
| v0.3    | 2026-04-18 | Rebrand to kerf                                                                                                                          |
| v0.4    | 2026-04-18 | Tech stack finalized (Tanstack Start, better-auth, Resend)                                                                               |
| v0.5    | (pending)  | **ADR-003: Deliberate-practice architecture** (accepted 2026-04-22, supersedes ADR-001 and ADR-002; pending Pass 1 spec-doc propagation) |

Minor/housekeeping versions (v0.2.1, v0.3, v0.4) are recorded in per-doc revision histories. Major architectural shifts get ADRs here.
