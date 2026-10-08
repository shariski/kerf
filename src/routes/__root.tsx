import { createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileGate } from "#/components/MobileGate";
import { AppFooter } from "#/components/nav/AppFooter";
import { AppNav } from "#/components/nav/AppNav";

// Routes that own their full viewport chrome and should not render the
// global AppNav:
//   - /onboarding has its own logo + progress bar
//   - /login is a centered full-screen card
//   - /welcome is the public landing page (unauth-redirect target)
const CHROMELESS_PATHS = ["/onboarding", "/login", "/welcome"];
const MOBILE_READING_PATHS = new Set([
  "/welcome",
  "/login",
  "/how-it-works",
  "/why-split-is-hard",
  "/faq",
  "/privacy",
  "/terms",
  "/contact",
]);

import appCss from "../styles.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "kerf — adaptive typing practice for split keyboards" },
      {
        name: "description",
        content:
          "Adaptive typing practice that targets the keys you're still building muscle memory for. Built for split keyboards like Sofle and Lily58.",
      },
      { name: "theme-color", content: "#181410" },

      // Open Graph defaults — overridden per route where appropriate
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "kerf" },
      { property: "og:title", content: "kerf — adaptive typing practice for split keyboards" },
      {
        property: "og:description",
        content:
          "Adaptive typing practice that targets the keys you're still building muscle memory for.",
      },
      { property: "og:image", content: "https://typekerf.com/og-image.png" },
      { property: "og:url", content: "https://typekerf.com/" },

      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "kerf — adaptive typing practice for split keyboards" },
      {
        name: "twitter:description",
        content:
          "Adaptive typing practice that targets the keys you're still building muscle memory for.",
      },
      { name: "twitter:image", content: "https://typekerf.com/og-image.png" },
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
  const mobileGated = !MOBILE_READING_PATHS.has(pathname);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: THEME_INIT_SCRIPT is a compile-time module constant (no user input). Inlined to set data-theme synchronously before body paint, avoiding FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <a href="#main-content" className="kerf-skip-link">
          Skip to main content
        </a>
        <MobileGate visible={mobileGated} />
        <div className="kerf-app-root" data-mobile-gated={mobileGated || undefined}>
          {!chromeless && <AppNav />}
          {children}
          {!chromeless && <AppFooter />}
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
