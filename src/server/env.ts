/**
 * Centralized env-var validation. Reads process.env once at module
 * load and exports a typed config object. In production, throws at
 * import time if any required variable is missing — preferable to
 * silently signing sessions with the dev-fallback secret. In dev/test,
 * falls back to a known-insecure default with a console warning so
 * first-run setup is frictionless.
 *
 * Server-side only. Importing this from client code risks bundling
 * process.env reads into the browser bundle. The fallback values here
 * are deliberately the same strings the call sites previously used
 * inline, so behavior in dev is identical — only the prod-without-env
 * path changed (silent insecure → loud crash).
 *
 * Optional env vars (RESEND_API_KEY, EMAIL_DEV_MODE, OAUTH_*) stay
 * inline at their use sites because each has its own validation shape
 * (e.g. EMAIL_DEV_MODE must be "send" | "log"; Google needs *both* id
 * and secret or neither). Centralizing those would require either
 * duplicating that logic or making this module aware of every shape.
 */

const isProduction = process.env.NODE_ENV === "production";

function read(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (isProduction) {
    throw new Error(
      `[env] ${key} is required in production. Set it in the deployment environment.`,
    );
  }
  console.warn(
    `[env] ${key} unset — using insecure dev fallback. Do not deploy without setting it.`,
  );
  return devFallback;
}

export const env = {
  databaseUrl: read("DATABASE_URL", "postgresql://kerf:kerf_dev@localhost:5432/kerf_dev"),
  authSecret: read("AUTH_SECRET", "dev-secret-change-me"),
  authUrl: read("AUTH_URL", "http://localhost:3000"),
} as const;
