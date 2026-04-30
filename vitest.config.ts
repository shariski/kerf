import { configDefaults, defineConfig } from "vitest/config";

/**
 * Dedicated vitest config. Kept separate from vite.config.ts so the
 * tanstackStart() plugin (which transforms code for SSR/RSC) doesn't
 * apply to the unit test runner — that transform breaks React hooks
 * when tests mount components via @testing-library/react.
 *
 * JSX is compiled by Vitest's built-in esbuild transform. Per-file
 * environment is selected with the `@vitest-environment jsdom` pragma
 * at the top of any .tsx test that mounts React.
 *
 * Pool: forks with per-file isolation. The default `threads` pool
 * shares the jsdom environment across files in a worker, which races
 * with React 19's concurrent scheduler — a scheduler task queued via
 * `setImmediate` during one file can fire after that file's jsdom
 * teardown, crashing with "ReferenceError: window is not defined" on
 * a subsequent file's run. `forks + isolate` gives each file its own
 * process, so the scheduler can't leak across files. The cost is a
 * ~1-2s overall suite slowdown; in return the run is deterministic.
 */
export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
    setupFiles: ["./vitest.setup.ts"],
    // Playwright specs live under `tests/` (see playwright.config.ts).
    // Vitest's default include pattern matches `.spec.ts`, so without
    // this exclude vitest tries to run the Playwright file and fails
    // with "test() not expected to be called here".
    exclude: [...configDefaults.exclude, "tests/**"],
  },
});
