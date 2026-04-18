import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { db } from "./db/index"
import {
  users,
  authSessions,
  authAccounts,
  authVerifications,
} from "./db/schema"

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET ?? "dev-secret-change-me",
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: { enabled: false },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV === "production") {
          // Phase 4: wire Resend here using process.env.RESEND_API_KEY
          throw new Error("Email sending not configured — wire Resend in Phase 4")
        }
        console.log(`\n[MAGIC LINK] Login link for ${email}:\n${url}\n`)
      },
    }),
  ],
})
