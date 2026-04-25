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
  // Tracks which OAuth button the user just clicked so the matching
  // button shows a "redirecting…" state. Cleared if the redirect fails.
  const [oauthInFlight, setOauthInFlight] = useState<"google" | "github" | null>(null);

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

  async function handleOAuth(provider: "google" | "github") {
    setOauthInFlight(provider);
    setError(null);
    // Better Auth performs a full-page redirect to the provider's
    // authorize URL on success. If the call returns an error (e.g. the
    // server didn't have credentials configured for this provider),
    // surface it and let the user retry — otherwise the page
    // navigates away and the in-flight state never matters.
    const { error: authError } = await authClient.signIn.social({
      provider,
      callbackURL: "/",
    });
    if (authError) {
      setError(`Couldn't continue with ${provider}. Try again or use email.`);
      setOauthInFlight(null);
    }
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
          className="text-kerf-text-primary tracking-tight text-center"
          style={{
            fontFamily: "var(--font-brand)",
            fontWeight: 700,
            fontSize: "32px",
            fontVariationSettings: '"opsz" 144, "SOFT" 100',
          }}
        >
          kerf<span className="text-kerf-amber-base">.</span>
        </h1>

        <div className="space-y-2">
          <OAuthButton
            provider="google"
            label="Continue with Google"
            inFlight={oauthInFlight === "google"}
            disabled={oauthInFlight !== null || loading}
            onClick={() => handleOAuth("google")}
          />
          <OAuthButton
            provider="github"
            label="Continue with GitHub"
            inFlight={oauthInFlight === "github"}
            disabled={oauthInFlight !== null || loading}
            onClick={() => handleOAuth("github")}
          />
        </div>

        <div
          className="flex items-center gap-3 text-kerf-text-tertiary"
          style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em" }}
        >
          <div className="flex-1 h-px bg-kerf-border-subtle" />
          <span>or</span>
          <div className="flex-1 h-px bg-kerf-border-subtle" />
        </div>

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

/**
 * Quiet OAuth provider button. Monochrome icon to fit the kerf brand
 * (single-color, calm), even though Google's official "Sign in with
 * Google" guidelines technically prefer the multi-color G mark on the
 * full branded button — the monochrome treatment is widely tolerated
 * for indie/dev projects and reads cleaner on the dark surface here.
 * If Google ever flags it during a brand audit, swap to their
 * official component without changing the layout.
 */
function OAuthButton({
  provider,
  label,
  inFlight,
  disabled,
  onClick,
}: {
  provider: "google" | "github";
  label: string;
  inFlight: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 bg-kerf-bg-surface hover:bg-kerf-bg-elevated border border-kerf-border-subtle hover:border-kerf-amber-base text-kerf-text-primary rounded px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-kerf-bg-surface disabled:hover:border-kerf-border-subtle"
      style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500 }}
    >
      <span aria-hidden className="text-kerf-text-secondary">
        {provider === "google" ? <GoogleIcon /> : <GitHubIcon />}
      </span>
      <span>{inFlight ? "redirecting…" : label}</span>
    </button>
  );
}

/**
 * Monochrome stylized Google "G" — single path, currentColor fill.
 * Simplified silhouette of the multi-color G mark; no per-segment
 * colors so it reads as a quiet provider hint, not a brand stamp.
 */
function GoogleIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative — the button's text "Continue with Google" is the accessible label; the SVG is aria-hidden.
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
    </svg>
  );
}

/** GitHub mark — Octocat silhouette path, currentColor fill. */
function GitHubIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative — the button's text "Continue with GitHub" is the accessible label; the SVG is aria-hidden.
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
