# kerf: Design Evolution

> Architectural Decision Records (ADRs) documenting major shifts in product philosophy, positioning, or structure.
> **Read this first** if you're picking up the project after time away, onboarding a new collaborator, or feeding Claude Code fresh context.

## ⚠ Current Status (2026-04-20)

Two ADRs exist in this document. **Read both before acting on either**:

- **ADR-001** (Meta-cognition loop): Status **Accepted**, but pending implementation.
- **ADR-002** (Split-specific practice mechanisms): Status **Draft, not accepted** — pending deliberation. Raises fundamental questions about kerf's positioning that may affect how ADR-001 should be implemented, or whether ADR-001's framing should be revisited.

Until ADR-002 resolves (accept / reject / merge into revised ADR-001), **do not proceed with ADR-001 Pass 1 spec implementation**. The two may need to be resolved together.

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
**Status**: Accepted
**Version bump**: v0.4 → v0.5 (major, not minor — reshapes session model)

### Context

Through v0.2 (transition-focused pivot), kerf established meta-cognition as one of five core differentiators: *"Meta-cognitive transparency: Users see what they're learning, why, and how progress is measured. No black-box gamification."* (01-product-spec.md §1)

This was implemented as **surface transparency** — dashboard formulas, weakness rankings, decision rationale, always-expanded calculation values. User could *opt into* meta-cognition by visiting the dashboard.

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
- Positioning statement unchanged: still *"Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first."* The meta-cognition loop reinforces this positioning rather than replacing it
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

**Alternative 2 — Modest (Opsi B from session):** Pre-session briefing + post-session evaluation, skip during-session persistence. Effort: medium. Impact: two-thirds of the loop. Considered seriously as a scope-control compromise. Rejected because during-session persistence is what makes attention *sustained*, not just *set and reviewed*. Without it, user can read the briefing and then drift back into generic typing.

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
  - §5.7 meta-cognition dashboard: update to reflect dashboard as *deepening* of in-session loop, not *replacement* for missing loop

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

**Update 2026-04-20 (same day)**: Later in the same session, ADR-002 surfaced insight that may affect ADR-001's implementation approach or framing. Pass 1 is now additionally gated on ADR-002 resolution. ADR-001's core thesis (meta-cognition as structural loop) likely remains valid regardless of ADR-002 outcome, but the *content* of what sessions target (the "what" that briefings declare) depends on ADR-002's resolution.

---

## ADR-002: Split-Keyboard-Specific Practice Mechanisms (Draft, Not Accepted)

**Date drafted**: 2026-04-20
**Status**: 🟡 **Draft — requires deeper deliberation before acceptance**
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

4. **How does this interact with ADR-001 (meta-cognition loop)?** ADR-001's briefing declares "what this session targets." If session target is "vertical reach on left pinky column," that's a concrete intent that fits the loop well. ADR-001 may actually become *more* meaningful with ADR-002 content, not less.

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

But ADR-001's *content* — what sessions target, what briefings declare — depends on ADR-002's resolution. Current ADR-001 examples reference "inner column (B, G, H, N, T, Y)" as target — which may not apply to conventional-mapping users.

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

## Version Timeline (Reference)

For context when reading ADRs above:

| Version | Date | Summary |
|---------|------|---------|
| v0.1 | 2026-04-17 | Initial consolidation (leftype-rightype) |
| v0.2 | 2026-04-18 | Transition-focused pivot |
| v0.2.1 | 2026-04-18 | Vim scroll shortcuts (post-session) |
| v0.3 | 2026-04-18 | Rebrand to kerf |
| v0.4 | 2026-04-18 | Tech stack finalized (Tanstack Start, better-auth, Resend) |
| v0.5 | (pending) | **ADR-001: Meta-cognition as structural loop** (accepted, gated on ADR-002) |
| v0.6? | (draft) | **ADR-002: Split-keyboard-specific practice mechanisms** (not accepted, parked for deliberation) |

Minor/housekeeping versions (v0.2.1, v0.3, v0.4) are recorded in per-doc revision histories. Major architectural shifts get ADRs here.
