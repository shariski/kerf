import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "./db/index";
import { users, authSessions, authAccounts, authVerifications } from "./db/schema";
import { sendMagicLinkEmail } from "./email/send";
import { env } from "./env";

/**
 * Build the social-providers config conditionally — each provider is
 * only included if both its CLIENT_ID and CLIENT_SECRET env vars are
 * set. Lets you enable Google or GitHub independently (e.g. configure
 * Google first, ship, add GitHub later) without crashing on missing
 * env vars at startup. Missing-credential providers are simply absent
 * from the auth config; their UI buttons no-op and Better Auth never
 * exposes the corresponding /api/auth/callback/<provider> route.
 */
function buildSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret };
  }
  const githubId = process.env.GITHUB_CLIENT_ID;
  const githubSecret = process.env.GITHUB_CLIENT_SECRET;
  if (githubId && githubSecret) {
    providers.github = { clientId: githubId, clientSecret: githubSecret };
  }
  return providers;
}

export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: env.authUrl,
  // Better Auth blocks requests whose Origin header doesn't match baseURL.
  // In dev, Vite may bump to any free port (3001, 5173…), so trust any
  // localhost origin. Stays empty in prod — baseURL is the only trusted one.
  trustedOrigins: process.env.NODE_ENV === "production" ? [] : ["http://localhost:*"],
  /**
   * Rate limit magic-link sends to protect Resend's monthly quota.
   *
   * Better Auth's default special rule for /sign-in/* is window=10s,
   * max=3 — burst-tight, but extrapolated over an hour an attacker
   * who paces requests perfectly could still trigger ~1080 sends from
   * a single IP. Better Auth's *other* email-sending paths
   * (/send-verification-email, /request-password-reset) ship with a
   * tighter window=60s, max=3 — same convention applied here so the
   * magic-link send endpoint matches its real cost profile.
   *
   * customRules keys must match the *exact* path (no prefix), see
   * better-auth/dist/api/rate-limiter/index.mjs:131. The path is
   * relative to the auth handler's mount point, not the full URL.
   *
   * IMPORTANT — deployment dependency: the limiter buckets per client
   * IP via getIp(req). Behind a reverse proxy (nginx/Caddy/Cloudflare)
   * every request looks like it's from the proxy unless Better Auth
   * is told which header carries the real client IP. When deploying,
   * also set advanced.ipAddress.ipAddressHeaders to whatever your
   * proxy uses (typically ["x-forwarded-for"] or
   * ["cf-connecting-ip"]). Without it, every request shares one
   * bucket and the limit becomes app-wide instead of per-IP.
   *
   * enabled: defers to Better Auth's default (on in prod, off in dev)
   * so iterating on the login page locally doesn't trip the limiter.
   */
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/sign-in/social": { window: 60, max: 10 },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  advanced: {
    // users.id is a Postgres uuid column, so better-auth's default nanoid
    // generator produces values Postgres rejects. Force UUIDs everywhere —
    // the other auth_* tables use text ids, and UUID strings fit fine there.
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  emailAndPassword: { enabled: false },
  /**
   * Auto-merge accounts that share the same verified email across the
   * trusted providers. Without this, a user who signs in with Google
   * and later with GitHub using the same email would end up with two
   * separate kerf profiles and split stats. Magic-link is also a
   * verified-email path, so all three flows converge into a single
   * user row when the emails match.
   */
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  socialProviders: buildSocialProviders(),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
    }),
  ],
});
