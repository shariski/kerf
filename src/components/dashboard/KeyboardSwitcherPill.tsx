/**
 * Dashboard-only keyboard switcher pill. Displays the active profile and
 * opens a dropdown to switch profiles or jump to the full /keyboards
 * management page. The /keyboards page remains the source of truth for
 * creating profiles (Task 3.5); this pill is a faster inline swap for
 * users who just want to flip between existing ones on the dashboard.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { KeyboardType } from "#/server/profile";

export type KeyboardSwitcherProfile = {
  id: string;
  keyboardType: KeyboardType;
  isActive: boolean;
};

type Props = {
  profiles: KeyboardSwitcherProfile[];
  onSwitchProfile: (profileId: string) => void;
};

export function KeyboardSwitcherPill({ profiles, onSwitchProfile }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = profiles.find((p) => p.isActive);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"])',
          ) ?? [],
        );
        if (items.length === 0) return;
        const current = document.activeElement as HTMLElement | null;
        const idx = current ? items.indexOf(current) : -1;
        const next =
          e.key === "ArrowDown"
            ? (idx + 1) % items.length
            : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div className="kerf-kb-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="kerf-kb-switcher-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>⌨</span>
        <span>viewing</span>
        <span className="kerf-kb-switcher-active">{active.keyboardType}</span>
        <span aria-hidden>▼</span>
      </button>
      {open && (
        <div ref={menuRef} role="menu" className="kerf-kb-switcher-menu">
          {profiles.map((p) =>
            p.isActive ? (
              <div
                key={p.id}
                role="menuitem"
                tabIndex={-1}
                aria-disabled="true"
                className="kerf-kb-switcher-item kerf-kb-switcher-item--current"
              >
                <span className="kerf-kb-switcher-item-dot" aria-hidden>
                  ●
                </span>
                <span>{p.keyboardType}</span>
                <span className="kerf-kb-switcher-item-suffix">current</span>
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="kerf-kb-switcher-item"
                onClick={() => {
                  onSwitchProfile(p.id);
                  setOpen(false);
                }}
              >
                <span className="kerf-kb-switcher-item-dot" aria-hidden>
                  ○
                </span>
                <span>{p.keyboardType}</span>
              </button>
            ),
          )}
          <div className="kerf-kb-switcher-divider" aria-hidden />
          <Link to="/keyboards" className="kerf-kb-switcher-manage">
            Manage all →
          </Link>
        </div>
      )}
    </div>
  );
}
