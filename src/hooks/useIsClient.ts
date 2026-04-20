import { useEffect, useState } from "react";

/**
 * Returns `true` once the component has mounted on the client.
 *
 * Intended for gating libraries that can't safely run during SSR —
 * notably Recharts's `ResponsiveContainer`, which tries to measure
 * its parent via `getBoundingClientRect()` on first render and logs
 * `width(-1) and height(-1) of chart should be greater than 0` when
 * the DOM doesn't exist yet. Rendering a placeholder server-side and
 * swapping to the real chart after mount eliminates the warning
 * without changing the resulting layout.
 *
 * Hydration-safe — the server and the client's very first render
 * both return `false`, so the initial tree matches. React then runs
 * the effect and the chart mounts on the second pass.
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}
