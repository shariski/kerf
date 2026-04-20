import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    // `routeFileIgnorePattern` keeps Tanstack Router from treating
    // co-located `*.test.tsx` files in `src/routes/**` as routes.
    // Without it, the router both logs "does not export a Route" at
    // startup and tries to bundle the test into the route tree.
    tanstackStart({ router: { routeFileIgnorePattern: '\\.test\\.' } }),
    viteReact(),
  ],
})

export default config
