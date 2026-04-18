import { defineConfig } from "vitest/config";

/**
 * Dedicated vitest config. Kept separate from vite.config.ts so the
 * tanstackStart() plugin (which transforms code for SSR/RSC) doesn't
 * apply to the unit test runner — that transform breaks React hooks
 * when tests mount components via @testing-library/react.
 *
 * JSX is compiled by Vitest's built-in esbuild transform. Per-file
 * environment is selected with the `@vitest-environment jsdom` pragma
 * at the top of any .tsx test that mounts React.
 */
export default defineConfig({
  test: {
    environment: "node",
  },
});
