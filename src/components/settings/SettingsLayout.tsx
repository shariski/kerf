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
    if (typeof window === "undefined") return;
    const sections = SIDEBAR_LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const TRIGGER_Y = 140;
    let raf = 0;

    const compute = () => {
      raf = 0;
      if (document.body.getBoundingClientRect().height === 0) return;
      let activeIndex = 0;
      for (let i = 0; i < sections.length; i++) {
        const top = sections[i]?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
        if (top <= TRIGGER_Y) activeIndex = i;
        else break;
      }
      const id = sections[activeIndex]?.id;
      if (id) setActiveId(id);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
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
