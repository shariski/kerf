/**
 * Corner-pinned live WPM widget shown during active typing.
 *
 * Updates on every keystroke (cheap — the computation is O(1) against
 * position/startedAt). Follows CLAUDE.md §B3 accuracy-first rule: WPM
 * is rendered small and subdued, never as the headline stat. The real
 * headline stat (accuracy) lives in the post-session card.
 *
 * WPM formula: (characters / 5) / (elapsedMs / 60000). Standard since
 * Gregg's 1890s spec — "word" = 5 chars.
 */

import { useEffect, useState } from "react";
import { useSessionStore } from "#/stores/sessionStore";

const MIN_ELAPSED_MS = 1000;
const TICK_MS = 500;

function computeWpm(position: number, startedAt: number | null): number {
  if (!startedAt) return 0;
  const elapsed = performance.now() - startedAt;
  if (elapsed < MIN_ELAPSED_MS) return 0;
  return Math.round((position / 5) / (elapsed / 60000));
}

type Props = {
  visible: boolean;
};

export function LiveWpm({ visible }: Props) {
  const position = useSessionStore((s) => s.position);
  const startedAt = useSessionStore((s) => s.startedAt);
  const status = useSessionStore((s) => s.status);
  const [wpm, setWpm] = useState(0);

  useEffect(() => {
    if (status !== "active") return;
    setWpm(computeWpm(position, startedAt));
    const id = setInterval(
      () => setWpm(computeWpm(position, startedAt)),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [position, startedAt, status]);

  return (
    <div
      className="kerf-live-wpm"
      data-visible={visible || undefined}
      aria-label={`Live speed: ${wpm} words per minute`}
    >
      <span className="kerf-live-wpm-value">{wpm}</span>
      <span className="kerf-live-wpm-unit"> wpm</span>
    </div>
  );
}
