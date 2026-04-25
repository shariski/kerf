import { ThemeCard } from "../ThemeCard";

export function ThemeSection() {
  return (
    <section
      id="theme"
      aria-labelledby="theme-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="theme-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Theme
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Dark mode is the primary experience. Light mode is planned for v2.
        </p>
      </header>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
        <ThemeCard label="Dark (default)" badge="active" variant="dark" />
        <ThemeCard label="Light" badge="v2" variant="light" />
      </div>
    </section>
  );
}
