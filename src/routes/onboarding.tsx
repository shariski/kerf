import {
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type {
  DominantHand,
  KeyboardType,
} from "#/server/profile";
import {
  createKeyboardProfile,
  getActiveProfile,
} from "#/server/profile";
import type { InitialLevel } from "#/domain/profile/initialPhase";
import { getAuthSession } from "#/lib/require-auth";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
    const profile = await getActiveProfile();
    if (profile) throw redirect({ to: "/" });
  },
  component: OnboardingPage,
});

type Stage = "step1" | "step2" | "step3" | "landing";

const LEVELS: ReadonlyArray<{
  value: InitialLevel;
  eyebrow: string;
  name: string;
  desc: string;
  effect: string;
  summary: string;
}> = [
  {
    value: "first_day",
    eyebrow: "level 1",
    name: "First day on split",
    desc: "Just unboxed it, or barely touched it. Your fingers don't know where keys are yet.",
    effect:
      "→ engine starts with single-letter drills, expects high error rate baseline",
    summary: "first day on split",
  },
  {
    value: "few_weeks",
    eyebrow: "level 2",
    name: "Few weeks in",
    desc: "Getting accustomed. Most letters work, but some columns still feel awkward (esp. inner B/G/T/Y).",
    effect:
      "→ engine focuses on common transitioner pain points, mixed difficulty",
    summary: "few weeks in",
  },
  {
    value: "comfortable",
    eyebrow: "level 3",
    name: "Comfortable, refining",
    desc: "Already proficient. Looking to push WPM, smooth out bigrams, eliminate residual quirks.",
    effect:
      "→ engine pushes speed-focused exercises, narrow-focus drills",
    summary: "comfortable, refining",
  },
];

export function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("step1");
  // Defaults per docs/06-design-summary.md §/onboarding: Lily58 (keyboard),
  // Right (90% of population), Level 1 (first day). User can still change any
  // of them; pre-selecting lowers friction for the common case.
  const [keyboardType, setKeyboardType] = useState<KeyboardType | null>(
    "lily58",
  );
  const [dominantHand, setDominantHand] = useState<DominantHand | null>(
    "right",
  );
  const [initialLevel, setInitialLevel] = useState<InitialLevel | null>(
    "first_day",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance =
    (stage === "step1" && keyboardType !== null) ||
    (stage === "step2" && dominantHand !== null) ||
    (stage === "step3" && initialLevel !== null);

  const goPractice = useCallback(() => {
    router.navigate({ to: "/practice" });
  }, [router]);

  const handleNext = useCallback(async () => {
    if (stage === "step1") {
      if (keyboardType) setStage("step2");
      return;
    }
    if (stage === "step2") {
      if (dominantHand) setStage("step3");
      return;
    }
    if (stage === "step3") {
      if (!keyboardType || !dominantHand || !initialLevel) return;
      setSubmitting(true);
      setError(null);
      try {
        await createKeyboardProfile({
          data: { keyboardType, dominantHand, initialLevel },
        });
        setStage("landing");
      } catch {
        setError("Couldn't save your setup. Try again.");
      } finally {
        setSubmitting(false);
      }
    }
  }, [stage, keyboardType, dominantHand, initialLevel]);

  const handleBack = useCallback(() => {
    if (stage === "step2") setStage("step1");
    else if (stage === "step3") setStage("step2");
  }, [stage]);

  // Enter key: advance on steps 1-3, fire redirect on landing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (stage === "landing") {
        e.preventDefault();
        goPractice();
        return;
      }
      if (canAdvance && !submitting) {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, canAdvance, submitting, handleNext, goPractice]);

  // Landing auto-redirect after 3s.
  useEffect(() => {
    if (stage !== "landing") return;
    const t = window.setTimeout(goPractice, 3000);
    return () => window.clearTimeout(t);
  }, [stage, goPractice]);

  return (
    <main id="main-content" className="min-h-screen bg-kerf-bg-base text-kerf-text-primary flex flex-col">
      <TopBar stage={stage} />

      <section className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-[1100px] w-full mx-auto">
        {stage === "step1" && (
          <Step1Keyboard selected={keyboardType} onSelect={setKeyboardType} />
        )}
        {stage === "step2" && (
          <Step2Hand selected={dominantHand} onSelect={setDominantHand} />
        )}
        {stage === "step3" && (
          <Step3Level selected={initialLevel} onSelect={setInitialLevel} />
        )}
        {stage === "landing" && (
          <Landing
            keyboardType={keyboardType}
            dominantHand={dominantHand}
            initialLevel={initialLevel}
            onStart={goPractice}
          />
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 text-kerf-error-base"
            style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
          >
            {error}
          </p>
        )}
      </section>

      {stage !== "landing" && (
        <BottomActions
          stage={stage}
          canAdvance={canAdvance}
          submitting={submitting}
          onBack={handleBack}
          onNext={handleNext}
        />
      )}
    </main>
  );
}

/* ─── Top bar ─────────────────────────────────────────────────────────── */

function TopBar({ stage }: { stage: Stage }) {
  const stepNum =
    stage === "step1" ? 1 : stage === "step2" ? 2 : stage === "step3" ? 3 : 3;

  return (
    <div className="px-12 py-6 flex items-center justify-between gap-8">
      <span
        className="text-kerf-text-primary leading-none"
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 700,
          fontSize: "20px",
          fontVariationSettings: '"opsz" 144, "SOFT" 100',
          letterSpacing: "-0.01em",
        }}
      >
        kerf<span className="text-kerf-amber-base">.</span>
      </span>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={stage === "landing" ? 3 : stepNum}
        aria-label="onboarding progress"
        className="flex items-center gap-3 flex-1 max-w-[400px] mx-auto"
      >
        {[1, 2, 3].map((n) => {
          const done = stage === "landing" || n < stepNum;
          const active = stage !== "landing" && n === stepNum;
          return (
            <span
              key={n}
              className={
                "flex-1 h-1 rounded " +
                (done || active
                  ? "bg-kerf-amber-base"
                  : "bg-kerf-bg-elevated")
              }
            />
          );
        })}
      </div>

      <span
        className="text-kerf-text-tertiary text-right min-w-[48px]"
        style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
      >
        {stage === "landing" ? "all set" : `step ${stepNum} of 3`}
      </span>
    </div>
  );
}

/* ─── Shared text bits ────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-kerf-amber-base mb-3 text-center"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </p>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-center mb-3 max-w-[700px] mx-auto tracking-tight"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "36px",
        fontWeight: 700,
        lineHeight: 1.2,
      }}
    >
      {children}
    </h1>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-kerf-text-secondary text-center mb-12 max-w-[560px] mx-auto"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "15px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </p>
  );
}

/* ─── Step 1 ──────────────────────────────────────────────────────────── */

type KeyboardOption = {
  value: KeyboardType;
  name: string;
  meta: string;
  desc: string;
  leftThumbs: Array<"small" | "large">;
  rightThumbs: Array<"small" | "large">;
};

const KEYBOARDS: ReadonlyArray<KeyboardOption> = [
  {
    value: "sofle",
    name: "Sofle",
    meta: "58 keys · 6×4+5 thumbs · split columnar",
    desc: "Popular split with rotary encoder and OLED. 5 thumb keys per side. The classic transitioner pick.",
    leftThumbs: ["small", "large"],
    rightThumbs: ["large", "small"],
  },
  {
    value: "lily58",
    name: "Lily58",
    meta: "58 keys · 6×4+4 thumbs · split columnar",
    desc: "Compact split with thumb cluster. 4 thumb keys per side, no number row. Lighter, more focused layout.",
    leftThumbs: ["small", "small"],
    rightThumbs: ["small", "small"],
  },
];

function Step1Keyboard({
  selected,
  onSelect,
}: {
  selected: KeyboardType | null;
  onSelect: (k: KeyboardType) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <Eyebrow>first, your keyboard</Eyebrow>
      <Question>Which split keyboard are you using?</Question>
      <Helper>
        Pick the keyboard you&apos;ll be practicing on. We&apos;ll tailor the
        visual layout and finger assignments to match. You can add more
        keyboards later.
      </Helper>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[800px]">
        {KEYBOARDS.map((kb) => (
          <KeyboardCard
            key={kb.value}
            option={kb}
            selected={selected === kb.value}
            onClick={() => onSelect(kb.value)}
          />
        ))}
      </div>
    </div>
  );
}

function KeyboardCard({
  option,
  selected,
  onClick,
}: {
  option: KeyboardOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={option.name}
      className={
        "text-left rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 " +
        (selected
          ? "border-2 border-kerf-amber-base bg-kerf-amber-faint"
          : "border-2 border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
      }
    >
      <div className="relative bg-kerf-bg-base border-b border-kerf-border-subtle flex items-center justify-center aspect-[16/10] overflow-hidden">
        <PhotoPlaceholder
          leftThumbs={option.leftThumbs}
          rightThumbs={option.rightThumbs}
        />
        <span
          className="absolute bottom-2 left-2 text-kerf-text-tertiary rounded px-1.5 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.05em",
            background: "rgba(0, 0, 0, 0.5)",
          }}
        >
          PHOTO PLACEHOLDER
        </span>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="text-kerf-text-primary flex-1"
            style={{ fontSize: "20px", fontWeight: 700 }}
          >
            {option.name}
          </span>
          {selected && (
            <span
              aria-hidden
              className="text-kerf-amber-base"
              style={{ fontSize: "18px" }}
            >
              ✓
            </span>
          )}
        </div>
        <p
          className="text-kerf-text-tertiary"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {option.meta}
        </p>
        <p
          className="text-kerf-text-secondary mt-3"
          style={{ fontSize: "13px", lineHeight: 1.6 }}
        >
          {option.desc}
        </p>
      </div>
    </button>
  );
}

function PhotoPlaceholder({
  leftThumbs,
  rightThumbs,
}: {
  leftThumbs: Array<"small" | "large">;
  rightThumbs: Array<"small" | "large">;
}) {
  return (
    <div
      className="flex justify-between gap-8"
      style={{ width: "80%", opacity: 0.7 }}
    >
      <PhotoHalf thumbs={leftThumbs} />
      <PhotoHalf thumbs={rightThumbs} />
    </div>
  );
}

function PhotoHalf({ thumbs }: { thumbs: Array<"small" | "large"> }) {
  return (
    <div
      className="flex-1 flex flex-col justify-between bg-kerf-bg-elevated border border-kerf-border-default rounded-md p-3"
      style={{ aspectRatio: "5 / 3" }}
    >
      <div className="grid grid-cols-6 gap-[3px]">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="bg-kerf-bg-overlay rounded-sm"
            style={{ aspectRatio: "1" }}
          />
        ))}
      </div>
      <div className="flex justify-center gap-1 mt-2">
        {thumbs.map((size, i) => (
          <span
            key={i}
            className="bg-kerf-bg-overlay rounded-sm"
            style={{
              width: size === "large" ? "24px" : "16px",
              height: "12px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Step 2 ──────────────────────────────────────────────────────────── */

function Step2Hand({
  selected,
  onSelect,
}: {
  selected: DominantHand | null;
  onSelect: (h: DominantHand) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <Eyebrow>your dominant hand</Eyebrow>
      <Question>Which hand do you write with?</Question>
      <Helper>
        This helps us calibrate exercises that emphasize building both-hand
        balance, especially in the early sessions.
      </Helper>

      <div className="grid grid-cols-2 gap-6 max-w-[600px] w-full">
        <HandCard
          letter="L"
          name="Left-handed"
          meta="10% of population"
          selected={selected === "left"}
          onClick={() => onSelect("left")}
        />
        <HandCard
          letter="R"
          name="Right-handed"
          meta="90% of population"
          selected={selected === "right"}
          onClick={() => onSelect("right")}
        />
      </div>
    </div>
  );
}

function HandCard({
  letter,
  name,
  meta,
  selected,
  onClick,
}: {
  letter: string;
  name: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={name}
      className={
        "text-center rounded-xl transition-all duration-200 hover:-translate-y-0.5 " +
        (selected
          ? "border-2 border-kerf-amber-base bg-kerf-amber-faint"
          : "border-2 border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
      }
      style={{ padding: "40px 32px" }}
    >
      <div
        className={
          "mb-4 " +
          (selected ? "text-kerf-amber-base" : "text-kerf-text-secondary")
        }
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: "48px",
        }}
      >
        {letter}
      </div>
      <div
        className="text-kerf-text-primary mb-1"
        style={{ fontSize: "18px", fontWeight: 600 }}
      >
        {name}
      </div>
      <div
        className="text-kerf-text-tertiary"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {meta}
      </div>
    </button>
  );
}

/* ─── Step 3 ──────────────────────────────────────────────────────────── */

function Step3Level({
  selected,
  onSelect,
}: {
  selected: InitialLevel | null;
  onSelect: (l: InitialLevel) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <Eyebrow>where you&apos;re at</Eyebrow>
      <Question>How comfortable are you on split already?</Question>
      <Helper>
        Pick honestly — this calibrates how the engine starts. You can change
        this anytime in settings if it doesn&apos;t feel right.
      </Helper>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[900px] w-full">
        {LEVELS.map((level) => {
          const isSelected = selected === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onSelect(level.value)}
              aria-pressed={isSelected}
              aria-label={level.name}
              className={
                "text-left rounded-xl flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 " +
                (isSelected
                  ? "border-2 border-kerf-amber-base bg-kerf-amber-faint"
                  : "border-2 border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
              }
              style={{ padding: "28px 24px" }}
            >
              <p
                className={
                  isSelected
                    ? "text-kerf-amber-base"
                    : "text-kerf-text-tertiary"
                }
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {level.eyebrow}
              </p>
              <p
                className="text-kerf-text-primary"
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {level.name}
              </p>
              <p
                className="text-kerf-text-secondary flex-1"
                style={{ fontSize: "13px", lineHeight: 1.6 }}
              >
                {level.desc}
              </p>
              <p
                className={
                  "pt-3 border-t border-kerf-border-subtle " +
                  (isSelected
                    ? "text-kerf-amber-base"
                    : "text-kerf-text-tertiary")
                }
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  lineHeight: 1.5,
                }}
              >
                {level.effect}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Landing ─────────────────────────────────────────────────────────── */

function Landing({
  keyboardType,
  dominantHand,
  initialLevel,
  onStart,
}: {
  keyboardType: KeyboardType | null;
  dominantHand: DominantHand | null;
  initialLevel: InitialLevel | null;
  onStart: () => void;
}) {
  const levelSummary = LEVELS.find((l) => l.value === initialLevel)?.summary;

  return (
    <div className="text-center w-full max-w-[640px] mx-auto">
      <div
        className="text-kerf-amber-base mb-6"
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: "56px",
        }}
      >
        ⏎
      </div>
      <h1
        className="text-kerf-text-primary mb-4 tracking-tight"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "28px",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        You&apos;re ready
      </h1>
      <p
        className="text-kerf-text-secondary mb-6"
        style={{ fontSize: "15px", lineHeight: 1.7 }}
      >
        We&apos;ll start you with a curated warm-up exercise — words
        you&apos;ll likely find familiar, just to capture an honest baseline.
        After that, the adaptive engine takes over.
      </p>

      <div className="bg-kerf-bg-surface border border-kerf-border-subtle rounded-lg text-left my-8 px-6 py-5">
        <p
          className="text-kerf-text-tertiary mb-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Your setup
        </p>
        <SummaryRow label="keyboard" value={keyboardType ?? "—"} />
        <SummaryRow label="dominant hand" value={dominantHand ?? "—"} />
        <SummaryRow
          label="starting level"
          value={levelSummary ?? "—"}
          last
        />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="bg-kerf-amber-base text-kerf-text-inverse rounded-md inline-flex items-center gap-3"
        style={{
          padding: "14px 32px",
          fontWeight: 600,
          fontSize: "15px",
        }}
      >
        Start first session
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            background: "rgba(0, 0, 0, 0.2)",
            padding: "3px 8px",
            borderRadius: "3px",
          }}
        >
          ⏎ enter
        </span>
      </button>

      <p
        className="mt-4 text-kerf-text-tertiary"
        style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
      >
        auto-redirecting in 3s · or press enter to start now
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={
        "flex justify-between py-2 " +
        (last ? "" : "border-b border-kerf-border-subtle")
      }
      style={{ fontSize: "13px" }}
    >
      <span className="text-kerf-text-secondary">{label}</span>
      <span
        className="text-kerf-text-primary"
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Bottom actions ──────────────────────────────────────────────────── */

function BottomActions({
  stage,
  canAdvance,
  submitting,
  onBack,
  onNext,
}: {
  stage: Stage;
  canAdvance: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const isFinalStep = stage === "step3";
  const backHidden = stage === "step1";
  const nextLabel = submitting
    ? "Saving…"
    : isFinalStep
    ? "Finish setup"
    : "Continue";

  return (
    <div className="px-12 py-6 flex items-center justify-between gap-4 border-t border-kerf-border-subtle">
      <button
        type="button"
        onClick={onBack}
        className="rounded px-6 py-3 text-kerf-text-secondary border border-kerf-border-default hover:bg-kerf-bg-elevated hover:text-kerf-text-primary transition-colors flex items-center gap-2"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          visibility: backHidden ? "hidden" : "visible",
        }}
      >
        ← Back
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!canAdvance || submitting}
        className="rounded px-6 py-3 bg-kerf-amber-base text-kerf-text-inverse hover:bg-kerf-amber-hover disabled:bg-kerf-bg-elevated disabled:text-kerf-text-tertiary disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        {nextLabel}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            background: "rgba(0, 0, 0, 0.2)",
            padding: "2px 6px",
            borderRadius: "3px",
          }}
        >
          ⏎ enter
        </span>
      </button>
    </div>
  );
}
