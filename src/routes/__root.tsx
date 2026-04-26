import { useEffect, useState } from "react";
import { HeadContent, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AppNav } from "#/components/nav/AppNav";
import { AppFooter } from "#/components/nav/AppFooter";
import { MobileGate } from "#/components/MobileGate";

// Routes that own their full viewport chrome and should not render the
// global AppNav:
//   - /onboarding has its own logo + progress bar
//   - /login is a centered full-screen card
//   - /welcome is the public landing page (unauth-redirect target)
const CHROMELESS_PATHS = ["/onboarding", "/login", "/welcome"];

// Routes that manage footer visibility per-stage rather than letting
// the root render it unconditionally. /practice and /practice/drill
// (matched via prefix) hide the footer while the user is actively
// typing and render it inline in pre-/post-session stages. Every other
// non-chromeless route gets the global footer — including /dashboard,
// where CSS handles hint-strip clearance.
const NO_GLOBAL_FOOTER_PATHS = ["/practice"];

import appCss from "../styles.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "kerf",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // SVG favicon — modern browsers prefer this over the legacy
      // `/favicon.ico` (Tanstack template default). The .ico file ships
      // alongside as a fallback for older clients that don't request SVG.
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chromeless = CHROMELESS_PATHS.some((p) => pathname.startsWith(p));
  const noGlobalFooter = chromeless || NO_GLOBAL_FOOTER_PATHS.some((p) => pathname.startsWith(p));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className="kerf-skip-link">
          Skip to main content
        </a>
        <MobileGate />
        <div className="kerf-app-root">
          {!chromeless && <AppNav />}
          {children}
          {!noGlobalFooter && <AppFooter />}
          {import.meta.env.DEV && <DevtoolsLazy />}
          <Scripts />
        </div>
      </body>
    </html>
  );
}

/**
 * Tanstack Devtools only in dev — keeps prod bundles lean and the UI
 * free of the corner launcher. Lazy-loaded so the two devtools packages
 * don't bloat the server render path either.
 */
function DevtoolsLazy() {
  const [panel, setPanel] = useState<React.ReactNode>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
        import("@tanstack/react-devtools"),
        import("@tanstack/react-router-devtools"),
      ]);
      if (cancelled) return;
      setPanel(
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return <>{panel}</>;
}
