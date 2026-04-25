import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type SidebarLink = {
  id: string;
  label: string;
  danger?: boolean;
};

const SIDEBAR_LINKS: ReadonlyArray<SidebarLink> = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "theme", label: "Theme" },
  { id: "data", label: "Data" },
  { id: "danger", label: "Danger zone", danger: true },
];

type SettingsLayoutProps = {
  children: ReactNode;
};

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const [activeId, setActiveId] = useState<string>("account");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: "-128px 0px -60% 0px", threshold: 0 },
    );
    for (const link of SIDEBAR_LINKS) {
      const el = document.getElementById(link.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveId(id);
    const target = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!target || typeof target.scrollIntoView !== "function") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "32px",
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: "48px",
      }}
    >
      <aside style={{ position: "sticky", top: "128px", alignSelf: "start" }}>
        <h1
          className="text-kerf-text-primary"
          style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}
        >
          Settings
        </h1>
        <p
          className="text-kerf-text-tertiary"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "24px",
          }}
        >
          preferences & account
        </p>
        <nav aria-label="Settings sections" className="flex flex-col" style={{ gap: "2px" }}>
          {SIDEBAR_LINKS.map((link) => {
            const isActive = link.id === activeId;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => handleClick(e, link.id)}
                className={
                  "block " +
                  (link.danger
                    ? "text-kerf-error"
                    : isActive
                      ? "text-kerf-amber-base bg-kerf-amber-faint"
                      : "text-kerf-text-secondary hover:text-kerf-text-primary hover:bg-kerf-bg-surface")
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  borderLeft:
                    isActive && !link.danger
                      ? "2px solid var(--lr-amber-base)"
                      : "2px solid transparent",
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: "none",
                  transition: "all 150ms",
                }}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div style={{ minWidth: 0 }}>{children}</div>
    </main>
  );
}
