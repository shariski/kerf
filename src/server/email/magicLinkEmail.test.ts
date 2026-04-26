import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "./magicLinkEmail";

const URL_INPUT = "https://typekerf.com/api/auth/magic-link/verify?token=abc&id=1";
const EMAIL_INPUT = "user@example.com";
const LOGO_URL_INPUT = "https://typekerf.com/email-logo.png";

describe("renderMagicLinkEmail", () => {
  it("returns {subject, html, text} of non-empty strings", () => {
    const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT, logoUrl: LOGO_URL_INPUT });
    expect(typeof r.subject).toBe("string");
    expect(typeof r.html).toBe("string");
    expect(typeof r.text).toBe("string");
    expect(r.subject.length).toBeGreaterThan(0);
    expect(r.html.length).toBeGreaterThan(0);
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("uses the locked subject", () => {
    const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT, logoUrl: LOGO_URL_INPUT });
    expect(r.subject).toBe("Your kerf sign-in link");
  });

  describe("html", () => {
    it("contains wordmark, heading, body phrase, and footer", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      expect(r.html).toContain("kerf");
      expect(r.html).toContain("Sign in to kerf");
      expect(r.html).toContain("10 minutes");
      expect(r.html).toContain("If you didn't request this");
    });

    it("contains the URL twice — CTA href + visible fallback (HTML-escaped)", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      // The & in the URL should be escaped to &amp; in HTML output.
      const escapedUrl = "https://typekerf.com/api/auth/magic-link/verify?token=abc&amp;id=1";
      const occurrences = r.html.split(escapedUrl).length - 1;
      expect(occurrences).toBe(2);
    });

    it("has no <style>, <link>, or <script> blocks (CSS must be inline)", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      expect(r.html).not.toMatch(/<style[\s>]/i);
      expect(r.html).not.toMatch(/<link[\s>]/i);
      expect(r.html).not.toMatch(/<script[\s>]/i);
    });

    it("renders the kerf wordmark as an <img> with the supplied logoUrl + alt='kerf'", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      // Email clients strip @font-face / web fonts, so the brand wordmark
      // ships as a pre-rendered raster image referenced by absolute URL.
      // (Earlier iteration used a base64 data URI but Gmail strips those
      // in <img> tags as an anti-phishing measure.) This test catches
      // accidental reverts to font-dependent text or to data URIs.
      expect(r.html).toMatch(/<img[^>]*alt="kerf"[^>]*>/);
      expect(r.html).toContain(LOGO_URL_INPUT);
      expect(r.html).not.toContain("data:image/png;base64,");
    });

    it("HTML-escapes the logoUrl (defense-in-depth, even though it's controlled by the transport)", () => {
      const malicious = `javascript:alert(1)"><script>alert(2)</script>`;
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: malicious,
      });
      expect(r.html).not.toContain("<script>alert(2)</script>");
      expect(r.html).toContain("&lt;script&gt;");
    });
  });

  describe("text", () => {
    it("contains the URL on its own line (raw, unescaped)", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      expect(r.text).toContain(`\n${URL_INPUT}\n`);
    });

    it("contains heading and disclaimer", () => {
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: URL_INPUT,
        logoUrl: LOGO_URL_INPUT,
      });
      expect(r.text).toContain("Sign in to kerf");
      expect(r.text).toContain("If you didn't request this");
    });
  });

  describe("URL escaping", () => {
    it("HTML-escapes URLs containing scriptish characters", () => {
      const malicious = `https://example.com/?t="><script>alert(1)</script>`;
      const r = renderMagicLinkEmail({
        email: EMAIL_INPUT,
        url: malicious,
        logoUrl: LOGO_URL_INPUT,
      });
      expect(r.html).not.toContain("<script>alert(1)</script>");
      expect(r.html).toContain("&lt;script&gt;");
      expect(r.html).toContain("&quot;");
    });
  });

  it("is idempotent (same input → deep-equal output)", () => {
    const a = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT, logoUrl: LOGO_URL_INPUT });
    const b = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT, logoUrl: LOGO_URL_INPUT });
    expect(a).toEqual(b);
  });
});
