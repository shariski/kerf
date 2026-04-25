type ThemeCardProps = {
  label: string;
  badge: "active" | "v2";
  variant: "dark" | "light";
};

export function ThemeCard({ label, badge, variant }: ThemeCardProps) {
  const isActive = badge === "active";
  const barBg = variant === "dark" ? "var(--lr-bg-surface)" : "#E5E0D5";
  const previewBg = variant === "dark" ? undefined : "#F5F2ED";
  return (
    <div
      aria-disabled={isActive ? undefined : "true"}
      className={`border-2 ${isActive ? "border-kerf-amber-base" : "border-kerf-border-subtle opacity-40"}`}
      style={{
        borderRadius: "8px",
        overflow: "hidden",
        cursor: isActive ? "default" : "not-allowed",
      }}
    >
      <div
        aria-hidden="true"
        className={variant === "dark" ? "bg-kerf-bg-base" : ""}
        style={{
          aspectRatio: "16 / 9",
          display: "flex",
          flexDirection: "column",
          padding: "12px",
          gap: "8px",
          background: previewBg,
        }}
      >
        <div style={{ height: "6px", width: "60%", background: barBg, borderRadius: "2px" }} />
        <div style={{ height: "6px", width: "48%", background: barBg, borderRadius: "2px" }} />
        <div
          className="bg-kerf-amber-base"
          style={{ height: "16px", width: "40%", borderRadius: "2px" }}
        />
        <div style={{ height: "6px", width: "27%", background: barBg, borderRadius: "2px" }} />
      </div>
      <div
        className="flex items-center justify-between border-t border-kerf-border-subtle"
        style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}
      >
        {label}
        <span
          className={
            isActive
              ? "bg-kerf-amber-base text-kerf-text-inverse"
              : "bg-kerf-bg-elevated text-kerf-text-tertiary"
          }
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "2px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}
