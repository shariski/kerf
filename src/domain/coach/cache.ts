type CachedCoachState = {
  passage: { id: string };
  quota: { remaining: number };
  reviewMode: boolean;
};

/** A completed passage should advance when another new session is available. */
export function shouldRestoreCoachCache(
  cached: CachedCoachState,
  completedPassageId: string | null,
): boolean {
  if (cached.reviewMode) return false;
  return cached.passage.id !== completedPassageId || cached.quota.remaining <= 0;
}
