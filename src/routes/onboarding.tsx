import {
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Lily58SVG, SofleSVG } from "#/components/keyboard";
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

type Step = 1 | 2 | 3;

export function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [keyboardType, setKeyboardType] = useState<KeyboardType | null>(null);
  const [dominantHand, setDominantHand] = useState<DominantHand | null>(null);
  const [initialLevel, setInitialLevel] = useState<InitialLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance =
    (step === 1 && keyboardType !== null) ||
    (step === 2 && dominantHand !== null) ||
    (step === 3 && initialLevel !== null);

  async function handleNext() {
    if (!canAdvance) return;
    if (step === 1) return setStep(2);
    if (step === 2) return setStep(3);

    if (!keyboardType || !dominantHand || !initialLevel) return;
    setSubmitting(true);
    setError(null);
    try {
      await createKeyboardProfile({
        data: { keyboardType, dominantHand, initialLevel },
      });
      router.navigate({ to: "/practice" });
    } catch {
      setSubmitting(false);
      setError("Couldn't save your setup. Try again.");
    }
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  return (
    <main className="min-h-screen bg-kerf-bg-base flex flex-col">
      <ProgressBar step={step} />

      <section className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {step === 1 && (
            <StepKeyboard
              selected={keyboardType}
              onSelect={setKeyboardType}
            />
          )}
          {step === 2 && (
            <StepHand selected={dominantHand} onSelect={setDominantHand} />
          )}
          {step === 3 && (
            <StepLevel
              selected={initialLevel}
              onSelect={setInitialLevel}
            />
          )}

          {error && (
            <p
              role="alert"
              className="text-kerf-error-base"
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || submitting}
              className="text-kerf-text-secondary disabled:opacity-30 px-3 py-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
            >
              ← back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance || submitting}
              className="bg-kerf-amber-base text-kerf-bg-base rounded px-6 py-2 disabled:opacity-30"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {step === 3
                ? submitting
                  ? "saving…"
                  : "start first session"
                : "next →"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="border-b border-kerf-border-subtle px-6 py-4 flex items-center justify-between">
      <span
        className="text-kerf-text-primary"
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 700,
          fontSize: "20px",
          fontVariationSettings: '"opsz" 144, "SOFT" 100',
        }}
      >
        kerf<span className="text-kerf-amber-base">.</span>
      </span>

      <div
        className="flex items-center gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-label={`onboarding step ${step} of 3`}
      >
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={
              n <= step
                ? "h-1 w-8 rounded-full bg-kerf-amber-base"
                : "h-1 w-8 rounded-full bg-kerf-border-subtle"
            }
          />
        ))}
        <span
          className="text-kerf-text-tertiary ml-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          step {step} of 3
        </span>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-kerf-text-tertiary"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </p>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-kerf-text-primary tracking-tight"
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "28px",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h1>
  );
}

type CardProps = {
  selected: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
};

function Card({ selected, onClick, ariaLabel, children }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={
        "text-left rounded-lg border p-5 transition-colors " +
        (selected
          ? "border-kerf-amber-base bg-kerf-bg-surface"
          : "border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
      }
    >
      {children}
    </button>
  );
}

function StepKeyboard({
  selected,
  onSelect,
}: {
  selected: KeyboardType | null;
  onSelect: (k: KeyboardType) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Eyebrow>first, your keyboard</Eyebrow>
        <Heading>Which split keyboard are you using?</Heading>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          selected={selected === "sofle"}
          onClick={() => onSelect("sofle")}
          ariaLabel="Sofle"
        >
          <div className="flex flex-col gap-3">
            <SofleSVG
              className="w-full h-auto"
              style={{ maxHeight: "80px" }}
            />
            <p
              className="text-kerf-text-primary"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Sofle
            </p>
            <p
              className="text-kerf-text-secondary"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
            >
              6×4+5 with thumb cluster
            </p>
          </div>
        </Card>

        <Card
          selected={selected === "lily58"}
          onClick={() => onSelect("lily58")}
          ariaLabel="Lily58"
        >
          <div className="flex flex-col gap-3">
            <Lily58SVG
              className="w-full h-auto"
              style={{ maxHeight: "80px" }}
            />
            <p
              className="text-kerf-text-primary"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Lily58
            </p>
            <p
              className="text-kerf-text-secondary"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
            >
              5×6 with 4-key thumb cluster
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StepHand({
  selected,
  onSelect,
}: {
  selected: DominantHand | null;
  onSelect: (h: DominantHand) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Eyebrow>your dominant hand</Eyebrow>
        <Heading>Which hand do you write with?</Heading>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card
          selected={selected === "left"}
          onClick={() => onSelect("left")}
          ariaLabel="Left-handed"
        >
          <p
            className="text-kerf-text-primary text-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Left
          </p>
        </Card>
        <Card
          selected={selected === "right"}
          onClick={() => onSelect("right")}
          ariaLabel="Right-handed"
        >
          <p
            className="text-kerf-text-primary text-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Right
          </p>
        </Card>
      </div>
    </div>
  );
}

const LEVELS: ReadonlyArray<{
  value: InitialLevel;
  eyebrow: string;
  name: string;
  description: string;
  effect: string;
}> = [
  {
    value: "first_day",
    eyebrow: "level 1",
    name: "First day on split",
    description: "You just plugged it in. Letters are hard to find.",
    effect: "Engine starts slow: one finger at a time, accuracy-first drills.",
  },
  {
    value: "few_weeks",
    eyebrow: "level 2",
    name: "A few weeks in",
    description: "Home row is coming back. Some columns still cost you.",
    effect: "Engine targets your weak columns and builds muscle memory there.",
  },
  {
    value: "comfortable",
    eyebrow: "level 3",
    name: "Comfortable already",
    description: "You type fine. You're here to polish, not relearn.",
    effect: "Engine skips basics and works on bigram smoothing and flow.",
  },
];

function StepLevel({
  selected,
  onSelect,
}: {
  selected: InitialLevel | null;
  onSelect: (l: InitialLevel) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Eyebrow>where you&apos;re at</Eyebrow>
        <Heading>How comfortable are you on split already?</Heading>
      </div>
      <div className="flex flex-col gap-3">
        {LEVELS.map((level) => (
          <Card
            key={level.value}
            selected={selected === level.value}
            onClick={() => onSelect(level.value)}
            ariaLabel={level.name}
          >
            <div className="space-y-1">
              <p
                className="text-kerf-text-tertiary"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {level.eyebrow}
              </p>
              <p
                className="text-kerf-text-primary"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {level.name}
              </p>
              <p
                className="text-kerf-text-secondary"
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
              >
                {level.description}
              </p>
              <p
                className="text-kerf-text-tertiary pt-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontStyle: "italic",
                }}
              >
                {level.effect}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
