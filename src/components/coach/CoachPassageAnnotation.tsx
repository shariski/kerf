import { useState } from "react";
import { REVIEW_TAGS, type ReviewTag, type ReviewVerdict } from "#/domain/coach/review";

type Props = {
  reviewMode: boolean;
  saved: boolean;
  /** Gate verdict of the annotated passage (review mode). */
  gatePassed?: boolean;
  gateViolations?: string[];
  onSave: (input: {
    verdict: ReviewVerdict;
    rating: number;
    tags: ReviewTag[];
    note: string;
  }) => Promise<void>;
};

/** Review-mode only: human verdict card shown after a Coach session. */
export function CoachPassageAnnotation({
  reviewMode,
  saved,
  gatePassed,
  gateViolations,
  onSave,
}: Props) {
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!reviewMode) return null;
  if (saved) {
    return (
      <section className="kerf-coach-review" aria-label="Passage annotation">
        <p>Saved — thank you.</p>
      </section>
    );
  }

  const toggleTag = (tag: ReviewTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const canSave = verdict !== null && rating !== null;

  return (
    <section className="kerf-coach-review" aria-label="Passage annotation">
      {gatePassed !== undefined && (
        <p>
          Gate: <strong>{gatePassed ? "passed" : "failed"}</strong>
          {!gatePassed && gateViolations?.length ? ` — ${gateViolations.join("; ")}` : ""}
        </p>
      )}
      <p>How was this passage?</p>
      <div className="kerf-coach-review-row">
        {(["good", "not_good"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className="kerf-coach-chip"
            onClick={() => setVerdict(v)}
            aria-pressed={verdict === v}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="kerf-coach-review-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="kerf-coach-chip"
            onClick={() => setRating(n)}
            aria-pressed={rating === n}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="kerf-coach-review-row">
        {REVIEW_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className="kerf-coach-chip"
            onClick={() => toggleTag(tag)}
            aria-pressed={tags.includes(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
        rows={2}
      />
      <button
        type="button"
        className="kerf-coach-btn-primary"
        disabled={!canSave || saving}
        onClick={async () => {
          if (!verdict || rating === null) return;
          setSaving(true);
          try {
            await onSave({ verdict, rating, tags, note });
          } finally {
            setSaving(false);
          }
        }}
      >
        Save verdict
      </button>
    </section>
  );
}
