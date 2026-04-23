import { useEffect } from "react";
import type { SessionTarget } from "#/domain/adaptive/targetSelection";

type Props = {
  target: SessionTarget;
  briefingText: string;
  onStart: () => void;
};

export function SessionBriefing({ target, briefingText, onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  return (
    <section className="max-w-2xl mx-auto p-8 space-y-6 text-center">
      <h1 className="text-3xl font-semibold text-kerf-amber-base">{target.label}</h1>
      <p className="whitespace-pre-line text-lg text-kerf-text-secondary">{briefingText}</p>
      {target.keys.length > 0 && (
        <div className="flex gap-2 justify-center">
          {target.keys.map((k) => (
            <kbd
              key={k}
              className="px-3 py-2 border border-kerf-amber-base rounded text-kerf-amber-base font-mono text-xl"
              style={{ borderWidth: "1.5px" }}
            >
              {k === " " ? "space" : k}
            </kbd>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onStart}
        className="px-6 py-3 rounded bg-kerf-amber-base text-kerf-text-inverse font-medium"
      >
        Start ⏎
      </button>
    </section>
  );
}
