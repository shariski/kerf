# Implementation Notes

## Task 0.1 — Scaffold structure

- CLI used: @tanstack/cli@latest (v6.14.17)
- Routes directory: `src/routes/` (matches docs/02-architecture.md §5)
- Global stylesheet: `src/styles.css`
- Tailwind version: v4 (`@import "tailwindcss"` directive, package `tailwindcss@^4.1.18`)
- Dev server port: 3000 (falls back to 3001 if 3000 is occupied)
- Node.js requirement: >=22.12.0 (TanStack Start packages require Node 22+; default system node v14 is too old — must use `nvm use 22` or set default to v22)
- Package name: renamed from `kerf-scaffold` to `kerf` in package.json

### Divergences from docs/02-architecture.md §5

None at scaffold level. The scaffold uses `src/` as the application root with `src/routes/` for file-based routing, which is consistent with the architecture doc. The subdirectory structure (`domain/`, `ui/`, `api/`, `server/`) will be added in subsequent tasks.

### Scaffold contents

The @tanstack/cli generated a complete starter with:
- `src/routes/__root.tsx` — root layout with Header, Footer, ThemeToggle
- `src/routes/index.tsx` — home page
- `src/routes/about.tsx` — about page
- `src/components/` — Header, Footer, ThemeToggle components
- `src/styles.css` — Tailwind v4 with custom CSS variables for theming (light/dark)
- `vite.config.ts` — Vite 8 + @tanstack/router-plugin
- `tsconfig.json` — TypeScript strict config

### Scripts (package.json)

```json
{
  "dev": "vite dev --port 3000",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```
