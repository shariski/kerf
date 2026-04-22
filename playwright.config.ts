import { defineConfig } from '@playwright/test';

/**
 * Playwright is used only for a11y audits in this repo (Task 4.4).
 * Single Chromium project, single URL prefix, dev server starts
 * automatically and is reused between local invocations.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
