/**
 * Turning vote counts into the percentages the Results section shows.
 *
 * Pure and exported so it can be tested without rendering: the bar chart is a component
 * test, and this repo's Vitest runs in a node environment with no Testing Library. The
 * server sends counts only, so every percentage on screen comes from here.
 */

export interface TallyBucket {
  optionId: string;
  label: string;
  count: number;
}

export interface TallyRow extends TallyBucket {
  /** 0–100, rounded to one decimal. Sums may not total exactly 100; see below. */
  percent: number;
}

/**
 * Attach a percentage to each bucket.
 *
 * Rounds to one decimal rather than whole numbers: with few votes, whole-number rounding
 * collapses everything to 0 or 100 and the chart lies about close races. The rows keep the
 * input order — the server returns options in poll order, and re-sorting by count on every
 * vote would make bars jump past each other, which reads as flicker rather than movement.
 *
 * A zero total yields all-zero rows rather than dividing by zero.
 */
export function withPercentages(buckets: readonly TallyBucket[], total: number): TallyRow[] {
  if (total <= 0) {
    return buckets.map((bucket) => ({ ...bucket, percent: 0 }));
  }

  return buckets.map((bucket) => ({
    ...bucket,
    percent: Math.round((bucket.count / total) * 1000) / 10,
  }));
}

/**
 * Fold a socket tally into the buckets a tRPC fetch produced.
 *
 * The two shapes differ on purpose. The socket carries a bare `{optionId: count}` map plus
 * a total — small, and enough for a broadcast — while the fetch carries labels, which only
 * the database join knows. Merging keeps the labels and order stable while the numbers move,
 * so a vote never reorders or renames a row mid-watch.
 *
 * Unknown option ids in the payload are ignored rather than appended: the poll's options
 * froze when it opened, so an id outside them is stale or forged, and either way it is not
 * something to draw a bar for.
 */
export function applyLiveCounts(
  buckets: readonly TallyBucket[],
  counts: Record<string, number>,
): TallyBucket[] {
  return buckets.map((bucket) => {
    const count = counts[bucket.optionId];
    return typeof count === "number" ? { ...bucket, count } : bucket;
  });
}
