import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "./db/index";
import { users, authSessions, authAccounts, authVerifications } from "./db/schema";

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
  secret: process.env.AUTH_SECRET ?? "dev-secret-change-me",
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  // Better Auth blocks requests whose Origin header doesn't match baseURL.
  // In dev, Vite may bump to any free port (3001, 5173…), so trust any
  // localhost origin. Stays empty in prod — baseURL is the only trusted one.
  trustedOrigins: process.env.NODE_ENV === "production" ? [] : ["http://localhost:*"],
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
        if (process.env.NODE_ENV === "production") {
          // Phase 4: wire Resend here using process.env.RESEND_API_KEY
          throw new Error("Email sending not configured — wire Resend in Phase 4");
        }
        console.log(`\n[MAGIC LINK] Login link for ${email}:\n${url}\n`);
      },
    }),
  ],
});
