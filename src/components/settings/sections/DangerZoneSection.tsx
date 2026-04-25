const DELETE_HINT = "coming soon — verified-by-email flow";

export function DangerZoneSection() {
  return (
    <section id="danger" aria-labelledby="danger-heading" style={{ padding: "32px 0" }}>
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="danger-heading"
          className="text-kerf-error"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Danger zone
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Permanent actions. Proceed with care.
        </p>
      </header>

      <div
        style={{
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "8px",
          padding: "24px",
          background: "rgba(239, 68, 68, 0.03)",
        }}
      >
        <div className="grid items-center" style={{ gridTemplateColumns: "1fr auto", gap: "16px" }}>
          <div>
            <div
              className="text-kerf-text-primary"
              style={{ fontSize: "13px", fontWeight: 500, marginBottom: "2px" }}
            >
              Delete account
            </div>
            <div className="text-kerf-text-secondary" style={{ fontSize: "12px", lineHeight: 1.5 }}>
              Permanently deletes your account, all keyboard profiles, stats, and session history.
              This cannot be undone.
            </div>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={DELETE_HINT}
            className="text-kerf-error"
            style={{
              background: "transparent",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "8px 16px",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.6,
              fontFamily: "var(--font-sans)",
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </section>
  );
}
