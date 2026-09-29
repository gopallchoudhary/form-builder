/**
 * Which form a console section shows.
 *
 * Three sources, in order, and the order is the whole design:
 *
 *   1. `?form=` in the URL — a link somebody was sent, so it has to win
 *   2. the last form this creator looked at — so leaving and coming back is not a reset
 *   3. the most recently updated form — for a first visit, and only then
 *
 * Before this, step 2 did not exist: the choice lived only in the URL, and the sidebar
 * links to a bare `/responses`, so every return visit fell through to step 3 and showed the
 * newest form. That is the bug this rule exists to fix.
 */

export interface FormLike {
  id: string;
  updatedAt?: Date | string | null;
}

export function mostRecentlyUpdated(forms: readonly FormLike[]): string | null {
  if (forms.length === 0) return null;

  const sorted = [...forms].sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  );

  return sorted[0]?.id ?? null;
}

/**
 * Resolves which form to show, and whether the choice still holds.
 *
 * A remembered or linked id that is no longer in the list is *stale* — a form deleted, or one
 * belonging to another account. It is dropped rather than fetched, because fetching it would
 * render a table and charts that are permanently empty, with no way for the creator to tell
 * that apart from a form nobody has answered yet.
 *
 * Returns `stale` so the caller can tell "you asked for something that is gone" from "you
 * have not chosen yet" — the first deserves a word, the second does not.
 */
export function resolveSelectedForm({
  fromUrl,
  remembered,
  forms,
}: {
  fromUrl: string | null;
  remembered: string | null;
  forms: readonly FormLike[];
}): { selected: string | null; stale: boolean } {
  const known = (id: string | null): id is string =>
    id !== null && forms.some((form) => form.id === id);

  if (known(fromUrl)) return { selected: fromUrl, stale: false };
  if (known(remembered)) return { selected: remembered, stale: false };

  const fallback = mostRecentlyUpdated(forms);

  // Only a *stated* preference going missing is worth reporting. Falling through to the
  // newest form on a first visit is not a complaint, it is the intended default.
  return {
    selected: fallback,
    stale: fallback !== null && (fromUrl !== null || remembered !== null),
  };
}
