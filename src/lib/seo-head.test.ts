import { describe, expect, it } from "vitest";
import { canonicalLink, noindexHead, SITE_ORIGIN } from "./seo-head";

describe("seo-head helpers", () => {
  it("SITE_ORIGIN is the production origin", () => {
    expect(SITE_ORIGIN).toBe("https://typekerf.com");
  });

  it("canonicalLink prefixes a path with the site origin", () => {
    expect(canonicalLink("/welcome")).toEqual({
      rel: "canonical",
      href: "https://typekerf.com/welcome",
    });
  });

  it("canonicalLink handles the root path", () => {
    expect(canonicalLink("/")).toEqual({
      rel: "canonical",
      href: "https://typekerf.com/",
    });
  });

  it("noindexHead returns a robots meta tag with noindex, nofollow", () => {
    const head = noindexHead();
    expect(head.meta).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });
});
