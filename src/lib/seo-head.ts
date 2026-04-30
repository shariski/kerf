export const SITE_ORIGIN = "https://typekerf.com";

export function canonicalLink(path: `/${string}`): { rel: "canonical"; href: string } {
  return {
    rel: "canonical",
    href: `${SITE_ORIGIN}${path}`,
  };
}

export function noindexHead(): { meta: Array<{ name: string; content: string }> } {
  return {
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  };
}
