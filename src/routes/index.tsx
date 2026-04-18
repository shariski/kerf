import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen bg-kerf-bg-base flex items-center justify-center flex-col gap-3">
      {/* Wordmark: Fraunces 700, opsz 144, SOFT 100, 48px hero size */}
      <h1
        className="text-kerf-text-primary tracking-tight select-none"
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 700,
          fontSize: "48px",
          lineHeight: 1.1,
          fontVariationSettings: '"opsz" 144, "SOFT" 100',
          letterSpacing: "-0.02em",
        }}
      >
        kerf
        <span className="text-kerf-amber-base">.</span>
      </h1>

      {/* Sanity check caption: JetBrains Mono, tertiary color */}
      <p
        className="text-kerf-text-tertiary"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.04em",
        }}
      >
        v0 · tanstack start scaffolding ok
      </p>
    </main>
  );
}
