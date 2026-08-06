/**
 * Fixed tag set for manual passage annotation. Shared by the client
 * (annotation chips) and the server (zod whitelist) — keep in sync.
 */
export const REVIEW_TAGS = [
  "too easy",
  "too hard",
  "bad density",
  "meta words",
  "good density",
  "good title",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];
export type ReviewVerdict = "good" | "not_good";
