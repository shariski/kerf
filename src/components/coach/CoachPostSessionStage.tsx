import { PostSessionStage } from "#/components/practice";
import type { SessionSummary } from "#/domain/session/summarize";

type Props = {
  target: string;
  summary: SessionSummary;
  onAgain: () => void;
};

export function CoachPostSessionStage({ target, summary, onAgain }: Props) {
  return (
    <PostSessionStage
      target={target}
      title="Session complete."
      summary={summary}
      onPracticeAgain={onAgain}
    />
  );
}
