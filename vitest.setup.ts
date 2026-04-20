/**
 * Global vitest setup.
 *
 * Swallows ONE specific benign error class that React 19's concurrent
 * scheduler emits when a jsdom window is torn down before the
 * scheduler has drained. The error surface is always identical:
 *
 *   ReferenceError: window is not defined
 *     at performWorkOnRootViaSchedulerTask (react-dom/...)
 *     at performWorkUntilDeadline (scheduler/...)
 *
 * It fires AFTER the test file that queued it has already completed —
 * every test assertion passed; the crash is in a post-teardown
 * scheduler task, not in test code. We let Node's default handler
 * process everything else normally so real uncaught errors still
 * bubble up and fail the run.
 *
 * Filter narrowly to avoid masking unrelated bugs: both the message
 * shape AND the React/scheduler frames in the stack must match.
 */
function isReactSchedulerTeardownRace(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (!/window is not defined/.test(err.message)) return false;
  const stack = err.stack ?? "";
  // Stack frames read "functionName ... file/path" — so the function
  // name comes before the file. Match either the react-dom frame OR
  // the scheduler frame; both are part of the same benign race.
  return (
    /performWorkOnRootViaSchedulerTask/.test(stack) ||
    /performWorkUntilDeadline/.test(stack)
  );
}

process.on("uncaughtException", (err) => {
  if (isReactSchedulerTeardownRace(err)) return;
  throw err;
});

process.on("unhandledRejection", (reason) => {
  if (isReactSchedulerTeardownRace(reason)) return;
  throw reason;
});
