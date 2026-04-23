import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { getAuthSession } from "../lib/require-auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/" });
    // no session — render login page
  },
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/",
    });

    setLoading(false);

    if (authError) {
      setError("Something went wrong. Try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-kerf-bg-base flex items-center justify-center"
      >
        <div className="max-w-sm w-full px-6 text-center space-y-3">
          <p
            className="text-kerf-text-primary"
            style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}
          >
            Magic link sent.
          </p>
          <p
            className="text-kerf-text-secondary"
            style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
          >
            Check your email — or, in local dev, check the server terminal.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-kerf-bg-base flex items-center justify-center"
    >
      <div className="max-w-sm w-full px-6 space-y-6">
        <h1
          className="text-kerf-text-primary tracking-tight"
          style={{
            fontFamily: "var(--font-brand)",
            fontWeight: 700,
            fontSize: "32px",
            fontVariationSettings: '"opsz" 144, "SOFT" 100',
          }}
        >
          kerf<span className="text-kerf-amber-base">.</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-kerf-text-secondary"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.04em" }}
            >
              email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-kerf-bg-surface border border-kerf-border-subtle rounded px-3 py-2 text-kerf-text-primary outline-none focus:border-kerf-amber-base"
              style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
            />
          </div>

          {error && (
            <p
              className="text-kerf-error-base"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kerf-amber-base text-kerf-bg-base rounded px-4 py-2 disabled:opacity-50"
            style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600 }}
          >
            {loading ? "sending…" : "send magic link"}
          </button>
        </form>
      </div>
    </main>
  );
}
