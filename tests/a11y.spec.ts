import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Axe sweep over every route/state reachable without typing a live
 * session. States that require mid-typing interaction (active typing,
 * post-session summary) are excluded per docs/a11y.md known deferrals.
 */

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

type PageCase = {
  name: string;
  path: string;
  viewport?: { width: number; height: number };
  setup?: (page: import('@playwright/test').Page) => Promise<void>;
};

const pageCases: PageCase[] = [
  { name: 'home (returning user)', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'practice pre-session', path: '/practice' },
  { name: 'practice drill pre-drill', path: '/practice/drill' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'keyboards', path: '/keyboards' },
  { name: 'mobile gate (home)', path: '/', viewport: MOBILE_VIEWPORT },
  { name: 'how-it-works', path: '/how-it-works' },
  { name: 'why-split-is-hard', path: '/why-split-is-hard' },
  { name: 'faq', path: '/faq' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  // Pause overlay (triggered mid-session) is covered by the
  // PauseOverlay.test.tsx unit test and a manual deferral noted in
  // docs/a11y.md — driving it from Playwright requires starting a
  // real session which tears down the page context.
];

for (const tc of pageCases) {
  test(`no critical or serious a11y violations: ${tc.name}`, async ({ page }) => {
    await page.setViewportSize(tc.viewport ?? DESKTOP_VIEWPORT);
    await page.goto(tc.path);
    await page.waitForLoadState('domcontentloaded');
    // Short settling wait — dev-mode Tanstack devtools keep long-poll
    // connections open so "networkidle" never fires. DOM-ready + a
    // small pause is sufficient for the a11y audit since axe inspects
    // the rendered DOM, not the network state.
    await page.waitForTimeout(500);
    if (tc.setup) await tc.setup(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');

    if (critical.length || serious.length) {
      // Readable digest for the engineer fixing the issues.
      console.log(
        `\n[${tc.name}] violations:\n` +
          [...critical, ...serious]
            .map(
              (v) =>
                `  [${v.impact}] ${v.id}: ${v.description}\n    nodes: ${v.nodes.length}`,
            )
            .join('\n'),
      );
    }

    expect(critical, `critical violations on ${tc.name}`).toEqual([]);
    expect(serious, `serious violations on ${tc.name}`).toEqual([]);
  });
}
