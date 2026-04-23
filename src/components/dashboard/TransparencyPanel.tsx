import type { WeaknessBreakdown } from "#/domain/dashboard/breakdown";
import { COEFFICIENTS } from "#/domain/adaptive/weaknessScore";
import type { TransitionPhase } from "#/domain/stats/types";

/**
 * Dashboard Section 7 — power-user transparency panel (Task 3.3).
 *
 * Always-expanded "How is this calculated?" card that shows:
 *
 *   1. The live weakness-score formula with the phase-active
 *      coefficients baked in (they visibly shift when phase changes).
 *   2. A per-component table for the user's current #1 weakness —
 *      raw value, baseline, normalized ratio, and the signed
 *      contribution to the total. This is the "live calculation
 *      breakdown" called out in docs/03-task-breakdown.md §3.3.
 *   3. The inner-column bonus explanation only when it actually
 *      fires — we don't show a 0-value row that would just add noise.
 *   4. A small phase-note that tells the user which lever is heaviest
 *      right now and when that shifts.
 *
 * Accuracy-first copy per CLAUDE.md §B3: no hype, no "amazing", no
 * exclamation stacks; calm mentor tone. The formula itself is the
 * star — the prose only exists to make it legible.
 */

type Props = {
  breakdown: WeaknessBreakdown | null;
  phase: TransitionPhase;
};

export function TransparencyPanel({ breakdown, phase }: Props) {
  if (!breakdown) {
    return (
      <div className="kerf-dash-transparency kerf-dash-transparency--empty">
        <p className="kerf-dash-transparency-empty-note">
          The formula is ready, but nothing has cleared the 5-attempt confidence bar yet. Keep
          practicing — a few more sessions will surface a top weakness and you'll see the live
          component breakdown here.
        </p>
        <Formula phase={phase} coefficients={COEFFICIENTS[phase]} />
      </div>
    );
  }

  return (
    <div className="kerf-dash-transparency">
      <Formula phase={phase} coefficients={breakdown.coefficients} />

      <section className="kerf-dash-transparency-block">
        <header className="kerf-dash-transparency-block-head">
          <span className="kerf-dash-transparency-eyebrow">applied to your top weakness</span>
          <span className="kerf-dash-transparency-unit">{breakdown.unit}</span>
          <span className="kerf-dash-transparency-attempts">
            {breakdown.attempts} attempts observed
          </span>
        </header>

        <table className="kerf-dash-transparency-table">
          <thead>
            <tr>
              <th>component</th>
              <th className="kerf-dash-transparency-num">your value</th>
              <th className="kerf-dash-transparency-num">baseline</th>
              <th className="kerf-dash-transparency-num">× normalized</th>
              <th className="kerf-dash-transparency-num">contribution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="kerf-dash-transparency-symbol">α</span> error rate
              </td>
              <td className="kerf-dash-transparency-num">{formatPct(breakdown.errorRate.raw)}</td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-muted">
                {formatPct(breakdown.errorRate.baseline)}
              </td>
              <td className="kerf-dash-transparency-num">
                {breakdown.errorRate.normalized.toFixed(2)}×
              </td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-contribution">
                {formatContribution(breakdown.errorRate.contribution)}
              </td>
            </tr>

            {breakdown.hesitation ? (
              <tr>
                <td>
                  <span className="kerf-dash-transparency-symbol">β</span> hesitation
                </td>
                <td className="kerf-dash-transparency-num">
                  {formatPct(breakdown.hesitation.raw)}
                </td>
                <td className="kerf-dash-transparency-num kerf-dash-transparency-muted">
                  {formatPct(breakdown.hesitation.baseline)}
                </td>
                <td className="kerf-dash-transparency-num">
                  {breakdown.hesitation.normalized.toFixed(2)}×
                </td>
                <td className="kerf-dash-transparency-num kerf-dash-transparency-contribution">
                  {formatContribution(breakdown.hesitation.contribution)}
                </td>
              </tr>
            ) : (
              <tr>
                <td>
                  <span className="kerf-dash-transparency-symbol">β</span> hesitation
                </td>
                <td className="kerf-dash-transparency-muted" colSpan={4}>
                  not tracked for bigrams in the current schema
                </td>
              </tr>
            )}

            <tr>
              <td>
                <span className="kerf-dash-transparency-symbol">γ</span> slowness
              </td>
              <td className="kerf-dash-transparency-num">{Math.round(breakdown.slowness.raw)}ms</td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-muted">
                {breakdown.slowness.baseline}ms
              </td>
              <td className="kerf-dash-transparency-num">
                {breakdown.slowness.normalized.toFixed(2)}×
              </td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-contribution">
                {formatContribution(breakdown.slowness.contribution)}
              </td>
            </tr>

            <tr>
              <td>
                <span className="kerf-dash-transparency-symbol">δ</span> corpus frequency
              </td>
              <td className="kerf-dash-transparency-muted" colSpan={3}>
                not loaded in the dashboard read path
              </td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-contribution">
                {formatContribution(breakdown.frequency.contribution)}
              </td>
            </tr>

            {breakdown.innerColumnBonus > 0 ? (
              <tr className="kerf-dash-transparency-bonus-row">
                <td>
                  <span className="kerf-dash-transparency-symbol">+</span> inner-column bonus
                </td>
                <td className="kerf-dash-transparency-muted" colSpan={3}>
                  {breakdown.unit} is an inner-column reach
                </td>
                <td className="kerf-dash-transparency-num kerf-dash-transparency-contribution">
                  {formatContribution(breakdown.innerColumnBonus)}
                </td>
              </tr>
            ) : null}

            <tr className="kerf-dash-transparency-total-row">
              <td colSpan={4}>total score</td>
              <td className="kerf-dash-transparency-num kerf-dash-transparency-total">
                {breakdown.total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {breakdown.innerColumnBonus > 0 ? (
          <p className="kerf-dash-transparency-bonus-note">
            The +{breakdown.innerColumnBonus.toFixed(1)} inner-column bonus only applies while
            you're in the transitioning phase and only to <code>b g h n t y</code> — the keys that
            row-stagger typists reach past, and split-columnar typists have to learn as a fresh
            column.
          </p>
        ) : null}

        <PhaseNote phase={phase} />
      </section>
    </div>
  );
}

// --- sub-components ------------------------------------------------------

function Formula({
  phase,
  coefficients,
}: {
  phase: TransitionPhase;
  coefficients: { ALPHA: number; BETA: number; GAMMA: number; DELTA: number };
}) {
  return (
    <section className="kerf-dash-transparency-formula">
      <header className="kerf-dash-transparency-formula-head">
        <span className="kerf-dash-transparency-eyebrow">weakness score formula</span>
        <span className={`kerf-dash-transparency-phase kerf-dash-transparency-phase--${phase}`}>
          {phase} coefficients
        </span>
      </header>
      <div className="kerf-dash-transparency-formula-body">
        <span className="kerf-dash-transparency-formula-var">score</span>
        <span className="kerf-dash-transparency-formula-op">=</span>
        <CoefficientTerm c={coefficients.ALPHA} symbol="α" name="error" />
        <span className="kerf-dash-transparency-formula-op">+</span>
        <CoefficientTerm c={coefficients.BETA} symbol="β" name="hesitation" />
        <span className="kerf-dash-transparency-formula-op">+</span>
        <CoefficientTerm c={coefficients.GAMMA} symbol="γ" name="slowness" />
        <span className="kerf-dash-transparency-formula-op">−</span>
        <CoefficientTerm c={coefficients.DELTA} symbol="δ" name="frequency" />
        {phase === "transitioning" ? (
          <>
            <span className="kerf-dash-transparency-formula-op">+</span>
            <span className="kerf-dash-transparency-formula-term">
              <span className="kerf-dash-transparency-formula-coef">0.3</span>
              <span className="kerf-dash-transparency-formula-name">inner-column</span>
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}

function CoefficientTerm({ c, symbol, name }: { c: number; symbol: string; name: string }) {
  return (
    <span className="kerf-dash-transparency-formula-term">
      <span className="kerf-dash-transparency-formula-coef">{c.toFixed(2)}</span>
      <span className="kerf-dash-transparency-formula-sym">{symbol}</span>
      <span className="kerf-dash-transparency-formula-name">{name}</span>
    </span>
  );
}

function PhaseNote({ phase }: { phase: TransitionPhase }) {
  if (phase === "transitioning") {
    return (
      <p className="kerf-dash-transparency-phase-note">
        You're in the <strong>transitioning</strong> phase — errors carry the most weight (α = 0.6)
        while you're still building muscle memory. Once your error rate consistently tracks below
        baseline, the engine moves you to <em>refining</em>, where hesitation becomes the dominant
        lever (β = 0.35).
      </p>
    );
  }
  return (
    <p className="kerf-dash-transparency-phase-note">
      You're in the <strong>refining</strong> phase — hesitation now carries the most weight (β =
      0.35) because errors on their own don't say much at this level. The engine focuses on letters
      you know but still pause on, to turn recognition into flow.
    </p>
  );
}

// --- helpers -------------------------------------------------------------

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function formatContribution(v: number): string {
  if (Math.abs(v) < 0.005) return "0.00";
  const sign = v > 0 ? "+" : "−";
  return `${sign}${Math.abs(v).toFixed(2)}`;
}
