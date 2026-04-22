import { useEffect, useState } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { AppNav } from '#/components/nav/AppNav'
import { AppFooter } from '#/components/nav/AppFooter'
import { MobileGate } from '#/components/MobileGate'

// Routes that own their full viewport chrome and should not render the
// global AppNav:
//   - /onboarding has its own logo + progress bar
//   - /login is a centered full-screen card
const CHROMELESS_PATHS = ['/onboarding', '/login']

// Routes where the global AppFooter is suppressed because the route
// owns its own bottom chrome (hint strip) or manages footer visibility
// internally per stage.
//   - /dashboard always shows .kerf-post-hint-strip at viewport bottom
//   - /practice renders its own <AppFooter /> only in pre-session;
//     active and post-session stages have their own bottom affordances.
//   - /practice/drill matches via prefix; same rule applies.
const NO_GLOBAL_FOOTER_PATHS = ['/dashboard', '/practice']

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'kerf',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const chromeless = CHROMELESS_PATHS.some((p) => pathname.startsWith(p))
  const noGlobalFooter =
    chromeless || NO_GLOBAL_FOOTER_PATHS.some((p) => pathname.startsWith(p))
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
  )
}

/**
 * Tanstack Devtools only in dev — keeps prod bundles lean and the UI
 * free of the corner launcher. Lazy-loaded so the two devtools packages
 * don't bloat the server render path either.
 */
function DevtoolsLazy() {
  const [panel, setPanel] = useState<React.ReactNode>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] =
        await Promise.all([
          import('@tanstack/react-devtools'),
          import('@tanstack/react-router-devtools'),
        ])
      if (cancelled) return
      setPanel(
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return <>{panel}</>
}
