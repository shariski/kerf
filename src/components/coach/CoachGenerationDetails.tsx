import type { TransitionProfile } from "#/domain/coach/triggerDensity";
import type { PassageRecord } from "#/server/coach/catalog";

type Props = {
  passage: PassageRecord;
  reviewMode: boolean;
};

// triggerTargets uses snake_case keys; measuredDensity uses the
// camelCase TransitionProfile keys. Map one to the other for display.
const MEASURED_KEY: Record<string, keyof TransitionProfile> = {
  cross_hand_rate: "crossHand",
  row_cross_rate: "rowCross",
  same_finger_rate: "sameFinger",
  vowel_initial_words: "vowelInitialWords",
};

// Prompt templates contain <PLACEHOLDER> tokens (e.g. <WHY_REPORT>);
// filled prompts have real values. Old passages store the template.
const PROMPT_PLACEHOLDER = /<[A-Z][A-Z0-9_]*>/;

function promptLabel(kind: string, text: string): string {
  return PROMPT_PLACEHOLDER.test(text) ? `${kind} prompt (template)` : `${kind} prompt (filled)`;
}

/**
 * Review-mode only: collapsible panel showing the gate verdict, measured
 * densities vs required thresholds, the raw DeepSeek outputs, and passage
 * metadata. Rendered in the Coach briefing. Hidden when reviewMode is off.
 */
export function CoachGenerationDetails({ passage, reviewMode }: Props) {
  if (!reviewMode) return null;
  const gate = passage.qualityGate;
  const targets = passage.triggerTargets ?? {};
  const measured = passage.measuredDensity ?? {};
  const llm = passage.llmOutput;

  return (
    <details className="kerf-coach-details">
      <summary>Generation details</summary>
      <section aria-label="Gate verdict">
        <p>
          Gate: <strong>{gate.passed ? "passed" : "failed"}</strong>
        </p>
        {gate.violations.length > 0 && (
          <ul>
            {gate.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Measured densities">
        {Object.entries(targets).map(([k, required]) => {
          const measuredKey = MEASURED_KEY[k];
          const value = measuredKey ? measured[measuredKey] : measured[k];
          return (
            <p key={k}>
              {k}: measured {value ?? "—"} vs required {required}
            </p>
          );
        })}
      </section>
      <section aria-label="Passage metadata">
        <p>
          {passage.title} · {passage.topic} · {passage.wordCount} words ·{" "}
          {passage.paragraphs} paragraph(s) · {passage.source} ·{" "}
          {passage.mechanisms.join(", ")}
        </p>
      </section>
      {llm && (
        <>
          {llm.prompts && (
            <section aria-label="Generation prompt">
              <p>{promptLabel("Analysis", llm.prompts.analysis)}</p>
              <pre>{llm.prompts.analysis}</pre>
              <p>{promptLabel("Generation", llm.prompts.generation)}</p>
              <pre>{llm.prompts.generation}</pre>
            </section>
          )}
          <section aria-label="Raw LLM output">
            <p>
              {llm.model} · {llm.latencyMs}ms
            </p>
            <pre>{llm.analysis.content}</pre>
            <pre>{llm.generation.content}</pre>
          </section>
        </>
      )}
    </details>
  );
}
