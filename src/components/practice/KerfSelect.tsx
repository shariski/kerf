import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type KerfSelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly KerfSelectOption<T>[];
  onChange: (value: T) => void;
  onSelectionComplete?: () => void;
  className?: string;
};

export function KerfSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  onSelectionComplete,
  className,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = useState(300);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const typeaheadRef = useRef({ text: "", at: 0 });
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedLabel = options[selectedIndex]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>(
      `[id='${id}-option-${activeIndex}']`,
    );
    if (typeof option?.scrollIntoView === "function") option.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id, open]);

  function openList(startIndex = selectedIndex) {
    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = rootRef.current?.closest(".kerf-pause-panel")?.getBoundingClientRect();
    if (trigger) {
      const desired = Math.min(300, options.length * 36 + 8, window.innerHeight * 0.45);
      const below = Math.max(
        0,
        Math.min(window.innerHeight, panel?.bottom ?? Infinity) - trigger.bottom - 8,
      );
      const above = Math.max(0, trigger.top - Math.max(0, panel?.top ?? 0) - 8);
      const nextPlacement = below < desired && above > below ? "top" : "bottom";
      setPlacement(nextPlacement);
      setMenuMaxHeight(Math.max(80, Math.min(desired, nextPlacement === "top" ? above : below)));
    }
    setActiveIndex(startIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
    onSelectionComplete?.();
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length,
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = performance.now();
      const previous = typeaheadRef.current;
      const text = (now - previous.at > 600 ? "" : previous.text) + event.key.toLowerCase();
      typeaheadRef.current = { text, at: now };
      const match = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (match >= 0) setActiveIndex(match);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`kerf-select ${className ?? ""}`}>
      <span className="kerf-select-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="kerf-select-trigger"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList(selectedIndex);
          }
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-option-${activeIndex}`}
          tabIndex={-1}
          className="kerf-select-list"
          data-placement={placement}
          style={{ maxHeight: menuMaxHeight }}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className="kerf-select-option"
              data-active={activeIndex === index || undefined}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(index);
                }
              }}
            >
              <span className="kerf-select-check" aria-hidden="true">
                {option.value === value ? "✓" : ""}
              </span>
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
