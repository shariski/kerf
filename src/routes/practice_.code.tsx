import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { CodePauseOverlay, type CodePauseDraft } from "#/components/practice/CodePauseOverlay";
import { CodePostSessionStage } from "#/components/practice/CodePostSessionStage";
import { computeWindowedWpm } from "#/components/practice/LiveWpm";
import { TargetRibbon } from "#/components/practice/TargetRibbon";
import {
  addCodeAdaptiveRun,
  pickAdaptiveCodeSnippet,
  suggestCodeFocus,
  type CodeAdaptiveEvidence,
} from "#/domain/codePractice/adaptive";
import { CODE_CORPUS_VERSION, type CodeSnippet } from "#/domain/codePractice/corpus";
import {
  codeLanguageLabel,
  isCodeLanguage,
  type CodeLanguage,
} from "#/domain/codePractice/languages";
import { codeFocusLabel, type CodeFocus } from "#/domain/codePractice/focus";
import { codeErrorPositions, summarizeCodeFocusEvidence } from "#/domain/codePractice/review";
import { type PersistCodeSessionInput, summarizeCodeSession } from "#/domain/codePractice/session";
import type { FocusOrigin } from "#/domain/practice/plan";
import { keystrokeReducer } from "#/domain/session/keystrokeReducer";
import { idleSessionState, type SessionState } from "#/domain/session/types";
import { getAuthSession } from "#/lib/require-auth";
import { noindexHead } from "#/lib/seo-head";
import { getCodePracticeContext, persistCodePracticeSession } from "#/server/codePractice";
import { useCodeSessionActivity } from "#/stores/codeSessionActivity";
import "./practice_.code.css";

type CodeSearch = { language?: CodeLanguage; focus?: CodeFocus; origin?: FocusOrigin };

function validateCodeSearch(search: Record<string, unknown>): CodeSearch {
  const language = isCodeLanguage(search.language) ? search.language : undefined;
  const focus =
    search.focus === "symbols" || search.focus === "brackets" || search.focus === "indentation"
      ? search.focus
      : undefined;
  const origin =
    search.origin === "manual" || search.origin === "recommended" ? search.origin : undefined;
  return {
    ...(language ? { language } : {}),
    ...(focus ? { focus } : {}),
    ...(origin ? { origin } : {}),
  };
}

export const Route = createFileRoute("/practice_/code")({
  beforeLoad: async () => {
    if (!(await getAuthSession())) throw redirect({ to: "/login" });
  },
  loader: () => getCodePracticeContext(),
  validateSearch: validateCodeSearch,
  head: () => noindexHead(),
  component: CodePracticePage,
});

type CodePlan = { language: CodeLanguage; focus: CodeFocus; origin: FocusOrigin };
type TypingSize = CodePauseDraft["typingSize"];

function evidenceForSnippet(
  language: CodeLanguage,
  focus: CodeFocus,
  byLanguage: Record<CodeLanguage, CodeAdaptiveEvidence>,
  allCode: CodeAdaptiveEvidence,
): CodeAdaptiveEvidence {
  const own = byLanguage[language];
  return own.focuses[focus].errors >= 2 ? own : allCode;
}

function CodePracticePage() {
  const { profile, recent, completedCounts, adaptiveByLanguage, allCodeEvidence } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const adaptiveByLanguageRef = useRef(adaptiveByLanguage);
  const allCodeEvidenceRef = useRef(allCodeEvidence);
  const completedCountsRef = useRef(completedCounts);
  const [plan, setPlan] = useState<CodePlan>(() => {
    const latestLanguage = recent[0]?.language;
    const language =
      search.language ?? (isCodeLanguage(latestLanguage) ? latestLanguage : "javascript");
    return {
      language,
      focus:
        search.focus ??
        suggestCodeFocus(adaptiveByLanguage[language], allCodeEvidence, completedCounts[language])
          .focus,
      origin: search.origin ?? "recommended",
    };
  });
  const [snippet, setSnippet] = useState<CodeSnippet>(() =>
    pickAdaptiveCodeSnippet(
      plan.language,
      plan.focus,
      recent.filter((item) => item.language === plan.language).map((item) => item.snippetId),
      evidenceForSnippet(plan.language, plan.focus, adaptiveByLanguage, allCodeEvidence),
      () => 0,
    ),
  );
  const [typingSize, setTypingSize] = useState<TypingSize>("M");
  const [runKey, setRunKey] = useState(0);
  const recentRef = useRef(recent);

  function chooseNext(language: CodeLanguage = plan.language, focus: CodeFocus = plan.focus) {
    recentRef.current = [
      { snippetId: snippet.id, language: snippet.language },
      ...recentRef.current,
    ].slice(0, 20);
    const recentIds = recentRef.current
      .filter((item) => item.language === language)
      .map((item) => item.snippetId);
    setSnippet(
      pickAdaptiveCodeSnippet(
        language,
        focus,
        recentIds,
        evidenceForSnippet(
          language,
          focus,
          adaptiveByLanguageRef.current,
          allCodeEvidenceRef.current,
        ),
      ),
    );
    setRunKey((key) => key + 1);
  }

  function restartExample() {
    setRunKey((key) => key + 1);
  }

  function applyOptions(draft: CodePauseDraft): boolean {
    const origin: FocusOrigin = draft.focusChoice === "recommended" ? "recommended" : "manual";
    const focus =
      origin === "recommended"
        ? suggestCodeFocus(
            adaptiveByLanguageRef.current[draft.language],
            allCodeEvidenceRef.current,
            completedCountsRef.current[draft.language],
          ).focus
        : (draft.focusChoice as CodeFocus);
    const contentChanged =
      draft.language !== plan.language || focus !== plan.focus || origin !== plan.origin;
    setTypingSize(draft.typingSize);
    if (contentChanged) {
      setPlan({ language: draft.language, focus, origin });
      chooseNext(draft.language, focus);
    }
    return contentChanged;
  }

  function continueAfterReview(payload: PersistCodeSessionInput | null, saved: boolean) {
    if (saved && payload) {
      const run = {
        snippetId: payload.snippetId,
        events: payload.events,
        tabCount: payload.tabCount,
      };
      adaptiveByLanguageRef.current[plan.language] = addCodeAdaptiveRun(
        adaptiveByLanguageRef.current[plan.language],
        run,
      );
      allCodeEvidenceRef.current = addCodeAdaptiveRun(allCodeEvidenceRef.current, run);
      completedCountsRef.current[plan.language]++;
    }
    const nextFocus =
      plan.origin === "recommended"
        ? suggestCodeFocus(
            adaptiveByLanguageRef.current[plan.language],
            allCodeEvidenceRef.current,
            completedCountsRef.current[plan.language],
          ).focus
        : plan.focus;
    if (nextFocus !== plan.focus) setPlan({ ...plan, focus: nextFocus });
    chooseNext(plan.language, nextFocus);
  }

  return (
    <CodeRun
      key={`${snippet.id}:${runKey}`}
      snippet={snippet}
      plan={plan}
      typingSize={typingSize}
      keyboardProfileId={profile.id}
      onApplyOptions={applyOptions}
      onEnd={() => navigate({ to: "/practice", search: {} })}
      onRestart={restartExample}
      onDrillFocus={() => {
        setPlan({ ...plan, origin: "manual" });
        chooseNext(plan.language, plan.focus);
      }}
      onViewDashboard={() => navigate({ to: "/dashboard", hash: "code-practice-history" })}
      onContinue={continueAfterReview}
    />
  );
}

function initialSession(text: string): SessionState {
  return keystrokeReducer(idleSessionState(), {
    type: "start",
    target: text,
    targetKeys: [],
    now: 0,
  });
}

function CodeRun({
  snippet,
  plan,
  typingSize,
  keyboardProfileId,
  onApplyOptions,
  onEnd,
  onRestart,
  onDrillFocus,
  onViewDashboard,
  onContinue,
}: {
  snippet: CodeSnippet;
  plan: CodePlan;
  typingSize: TypingSize;
  keyboardProfileId: string;
  onApplyOptions: (draft: CodePauseDraft) => boolean;
  onEnd: () => void;
  onRestart: () => void;
  onDrillFocus: () => void;
  onViewDashboard: () => void;
  onContinue: (payload: PersistCodeSessionInput | null, saved: boolean) => void;
}) {
  const [session, dispatch] = useReducer(keystrokeReducer, snippet.text, initialSession);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [draft, setDraft] = useState<CodePauseDraft>({
    language: plan.language,
    focusChoice: plan.origin === "recommended" ? "recommended" : plan.focus,
    typingSize,
  });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const tabCountRef = useRef(0);
  const tabEventIndexesRef = useRef(new Set<number>());
  const savePayloadRef = useRef<PersistCodeSessionInput | null>(null);
  const indentSpaces = remainingIndent(snippet.text, session.position);
  const isComplete = session.status === "complete";

  useEffect(() => {
    useCodeSessionActivity.getState().setActive(!optionsOpen && !isComplete);
    return () => useCodeSessionActivity.getState().setActive(false);
  }, [optionsOpen, isComplete]);

  useEffect(() => {
    if (!optionsOpen && !isComplete) surfaceRef.current?.focus();
  }, [optionsOpen, isComplete]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: position triggers a DOM measurement after the current character changes.
  useEffect(() => {
    const surface = surfaceRef.current;
    const current = surface?.querySelector<HTMLElement>(".kerf-typing-current, .kerf-typing-error");
    if (!surface || !current) return;
    const surfaceRect = surface.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const styles = getComputedStyle(surface);
    const fontSizePx = parseFloat(styles.fontSize);
    const lineHeightPx =
      styles.lineHeight === "normal"
        ? fontSizePx * 1.2
        : styles.lineHeight.endsWith("px")
          ? parseFloat(styles.lineHeight)
          : parseFloat(styles.lineHeight) * fontSizePx;
    const paddingTopPx = parseFloat(styles.paddingTop) || 0;
    if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) return;
    const charTopInContent = currentRect.top - surfaceRect.top + surface.scrollTop;
    const lineIndex = Math.max(0, Math.round((charTopInContent - paddingTopPx) / lineHeightPx));
    surface.scrollTop = Math.max(0, lineIndex * lineHeightPx);
  }, [session.position]);

  function openOptions() {
    if (isComplete || optionsOpen) return;
    setDraft({
      language: plan.language,
      focusChoice: plan.origin === "recommended" ? "recommended" : plan.focus,
      typingSize,
    });
    dispatch({ type: "pause", now: performance.now() });
    setOptionsOpen(true);
  }

  function resumeFromOptions() {
    const replaced = onApplyOptions(draft);
    if (replaced) return;
    dispatch({ type: "resume", now: performance.now() });
    setOptionsOpen(false);
  }

  const openOptionsRef = useRef(openOptions);
  const resumeFromOptionsRef = useRef(resumeFromOptions);
  const restartRef = useRef(onRestart);
  openOptionsRef.current = openOptions;
  resumeFromOptionsRef.current = resumeFromOptions;
  restartRef.current = onRestart;

  useEffect(() => {
    if (isComplete) return;
    const onShortcut = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (
          optionsOpen &&
          event.target instanceof HTMLElement &&
          event.target.closest('[role="listbox"]')
        )
          return;
        event.preventDefault();
        restartRef.current();
        return;
      }
      if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      if (optionsOpen) resumeFromOptionsRef.current();
      else openOptionsRef.current();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [isComplete, optionsOpen]);

  useEffect(() => {
    if (!isComplete || savePayloadRef.current) return;
    const endedAt = new Date();
    const activeMs =
      session.startedAt !== null && session.completedAt !== null
        ? Math.max(0, session.completedAt - session.startedAt - session.pausedMs)
        : 0;
    const payload: PersistCodeSessionInput = {
      sessionId: crypto.randomUUID(),
      keyboardProfileId,
      corpusVersion: CODE_CORPUS_VERSION,
      snippetId: snippet.id,
      startedAt: new Date(endedAt.getTime() - activeMs).toISOString(),
      endedAt: endedAt.toISOString(),
      tabCount: tabCountRef.current,
      events: session.events.map((event, index) => ({
        targetChar: event.targetChar,
        actualChar: event.actualChar,
        isError: event.isError,
        keystrokeMs: event.keystrokeMs,
        timestamp: event.timestamp.toISOString(),
        inputMethod: tabEventIndexesRef.current.has(index) ? "tabExpansion" : "key",
      })),
    };
    savePayloadRef.current = payload;
    setSaveStatus("saving");
    void persistCodePracticeSession({ data: payload })
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  }, [isComplete, session, keyboardProfileId, snippet.id]);

  function retrySave() {
    if (!savePayloadRef.current) return;
    setSaveStatus("saving");
    void persistCodePracticeSession({ data: savePayloadRef.current })
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (isComplete || optionsOpen || event.nativeEvent.isComposing) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Tab" && !event.shiftKey && indentSpaces > 0) {
      event.preventDefault();
      if (session.activeError) return;
      tabCountRef.current++;
      const now = performance.now();
      for (let i = 0; i < indentSpaces; i++) {
        tabEventIndexesRef.current.add(session.events.length + i);
        dispatch({ type: "keypress", char: " ", now });
      }
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      dispatch({ type: "backspace" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      dispatch({ type: "keypress", char: "\n", now: performance.now() });
    } else if (event.key.length === 1) {
      event.preventDefault();
      dispatch({ type: "keypress", char: event.key, now: performance.now() });
    }
  }

  const focusLabel = codeFocusLabel(plan.focus, plan.language);
  if (isComplete) {
    const payload = savePayloadRef.current;
    const summary = payload ? summarizeCodeSession(payload) : null;
    const evidence = summarizeCodeFocusEvidence(
      snippet.text,
      payload?.events ?? session.events,
      plan.focus,
    );
    const errors = codeErrorPositions(session.events);
    return (
      <main id="main-content" className="kerf-practice-main">
        <div className="kerf-practice-container">
          {summary ? (
            <CodePostSessionStage
              target={snippet.text}
              languageLabel={codeLanguageLabel(plan.language)}
              focusLabel={focusLabel}
              summary={summary}
              evidence={evidence}
              errors={errors}
              tabCount={tabCountRef.current}
              saveStatus={saveStatus}
              onRetrySave={retrySave}
              onContinue={() => onContinue(payload, saveStatus === "saved")}
              onDrillFocus={onDrillFocus}
              onViewDashboard={onViewDashboard}
            />
          ) : (
            <p role="status" className="kerf-pre-subtitle">
              Preparing your Coding review…
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="kerf-practice-main kerf-practice-main--active kerf-code-session-main kerf-stage-fade-in"
    >
      <h1 className="sr-only">Code practice</h1>
      <TargetRibbon label={`${codeLanguageLabel(plan.language)} · ${focusLabel}`} keys={[]} />
      <div className="kerf-active-session kerf-code-active-session" data-typing-size={typingSize}>
        <div className="kerf-active-session-typing">
          {/* biome-ignore lint/a11y/useSemanticElements: per-character feedback and newline markers cannot be rendered inside a native input. */}
          <div
            ref={surfaceRef}
            className="kerf-typing kerf-code-typing"
            role="textbox"
            tabIndex={0}
            aria-label="Type the code shown here"
            aria-multiline="true"
            onKeyDown={onKeyDown}
          >
            <pre>
              <code>
                {[...snippet.text].map((expected, index) => {
                  const isCurrent = index === session.position;
                  const error = isCurrent ? session.activeError : null;
                  const shown = error?.actual ?? expected;
                  const statusClass =
                    index < session.position
                      ? "kerf-typing-typed"
                      : error
                        ? "kerf-typing-error"
                        : isCurrent
                          ? "kerf-typing-current"
                          : "kerf-typing-upcoming";
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: snippet positions stay fixed for this keyed run.
                    <span key={index} className={`kerf-typing-char ${statusClass}`}>
                      {shown === "\n" ? "↵" : shown}
                      {error && (
                        <span className="kerf-typing-expected" aria-hidden="true">
                          {error.expected === "\n"
                            ? "↵"
                            : error.expected === " "
                              ? "␣"
                              : error.expected}
                        </span>
                      )}
                      {expected === "\n" && "\n"}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      </div>
      <div className="kerf-shortcut-hints" data-visible aria-hidden="true">
        <div>
          <kbd className="kerf-kbd">Esc</kbd> pause · settings
        </div>
        <div>
          <kbd className="kerf-kbd">Tab</kbd> indent
        </div>
        <div>
          <kbd className="kerf-kbd">⌃↵</kbd> restart
        </div>
      </div>
      <div className="kerf-live-wpm" data-visible aria-live="off">
        <span className="kerf-live-wpm-value">{computeWindowedWpm(session.events)}</span>
        <span className="kerf-live-wpm-unit"> code wpm</span>
      </div>
      {optionsOpen && (
        <CodePauseOverlay
          draft={draft}
          onChange={setDraft}
          onResume={resumeFromOptions}
          onRestart={onRestart}
          onEnd={onEnd}
        />
      )}
    </main>
  );
}

function remainingIndent(source: string, position: number): number {
  if (source[position] !== " ") return 0;
  const lineStart = source.lastIndexOf("\n", position - 1) + 1;
  if (!/^ *$/.test(source.slice(lineStart, position))) return 0;
  let count = 0;
  while (source[position + count] === " ") count++;
  return count;
}
