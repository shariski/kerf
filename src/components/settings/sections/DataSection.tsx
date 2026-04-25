import { COMING_SOON_HINT } from "../InlineEditField";
import { FieldRow } from "../FieldRow";

type DataSectionProps = {
  profiles: ReadonlyArray<{
    id: string;
    keyboardType: string;
    sessionCount: number;
    isActive: boolean;
  }>;
};

function DisabledActionButton({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={COMING_SOON_HINT}
      className={
        danger
          ? "text-kerf-error border"
          : "text-kerf-text-primary border border-kerf-border-default"
      }
      style={{
        background: "transparent",
        padding: "8px 16px",
        borderRadius: "4px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "not-allowed",
        opacity: 0.5,
        fontFamily: "var(--font-sans)",
        borderColor: danger ? "rgba(239, 68, 68, 0.3)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function DataSection({ profiles }: DataSectionProps) {
  return (
    <section
      id="data"
      aria-labelledby="data-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="data-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Data
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Export your data, or reset stats for a specific keyboard profile.
        </p>
      </header>

      <FieldRow labelName="Export all data" labelHint="JSON · all keyboards, all sessions">
        <DisabledActionButton>Download JSON</DisabledActionButton>
      </FieldRow>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "12px",
          padding: "16px 0",
        }}
      >
        <div className="flex flex-col" style={{ gap: "2px" }}>
          <span className="text-kerf-text-primary" style={{ fontSize: "13px", fontWeight: 500 }}>
            Reset stats by keyboard
          </span>
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
          >
            clears sessions & weakness data · does not delete keyboard profile
          </span>
        </div>
        <div className="flex flex-col" style={{ gap: "8px", width: "100%" }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border border-kerf-border-subtle bg-kerf-bg-surface"
              style={{ padding: "12px 16px", borderRadius: "6px" }}
            >
              <div className="flex items-center" style={{ gap: "12px" }}>
                <div
                  aria-hidden="true"
                  className="border border-kerf-border-default bg-kerf-bg-elevated text-kerf-text-tertiary"
                  style={{
                    width: "32px",
                    height: "20px",
                    borderRadius: "3px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                  }}
                >
                  ⊞⊞
                </div>
                <span
                  className="text-kerf-text-primary"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {p.keyboardType}
                </span>
                <span
                  className="text-kerf-text-tertiary"
                  style={{ fontSize: "11px", marginLeft: "8px" }}
                >
                  {p.sessionCount} {p.sessionCount === 1 ? "session" : "sessions"}
                  {p.isActive ? " · active" : ""}
                </span>
              </div>
              <DisabledActionButton danger>Reset stats</DisabledActionButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
