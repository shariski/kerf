import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

function NotFound() {
  return (
    <main className="min-h-screen bg-kerf-bg-base flex items-center justify-center">
      <div className="max-w-sm w-full px-6 text-center space-y-3">
        <p
          className="text-kerf-text-primary"
          style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}
        >
          This page doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-block text-kerf-text-secondary hover:text-kerf-amber-base"
          style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
        >
          ← back to home
        </Link>
      </div>
    </main>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
