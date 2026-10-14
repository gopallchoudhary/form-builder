import { describe, expect, it } from "vitest";

import { applyLiveCounts, withPercentages } from "~/lib/poll-tally";

/**
 * The arithmetic behind the Results bars.
 *
 * Percentages and live-count merging are the only logic the results view owns — everything
 * else is rendering. Both are pure, so both are pinned here rather than left to eyeballing
 * a chart.
 */

const BUCKETS = [
  { optionId: "ramen", label: "Ramen", count: 3 },
  { optionId: "thali", label: "Thali", count: 1 },
];

describe("withPercentages", () => {
  it("attaches a one-decimal percentage to each row", () => {
    const rows = withPercentages(BUCKETS, 4);

    expect(rows).toEqual([
      { optionId: "ramen", label: "Ramen", count: 3, percent: 75 },
      { optionId: "thali", label: "Thali", count: 1, percent: 25 },
    ]);
  });

  it("keeps one decimal on close races instead of collapsing to 0 or 100", () => {
    const rows = withPercentages(
      [
        { optionId: "a", label: "A", count: 2 },
        { optionId: "b", label: "B", count: 1 },
      ],
      3,
    );

    expect(rows[0]!.percent).toBe(66.7);
    expect(rows[1]!.percent).toBe(33.3);
  });

  it("returns all-zero rows on an empty tally rather than dividing by zero", () => {
    const rows = withPercentages(BUCKETS.map((bucket) => ({ ...bucket, count: 0 })), 0);

    expect(rows.every((row) => row.percent === 0)).toBe(true);
  });

  it("keeps the poll's option order rather than re-sorting by count", () => {
    const rows = withPercentages(
      [
        { optionId: "loser", label: "Loser", count: 1 },
        { optionId: "winner", label: "Winner", count: 9 },
      ],
      10,
    );

    expect(rows.map((row) => row.optionId)).toEqual(["loser", "winner"]);
  });
});

describe("applyLiveCounts", () => {
  it("moves the numbers while labels and order stay put", () => {
    const merged = applyLiveCounts(BUCKETS, { ramen: 5, thali: 2 });

    expect(merged).toEqual([
      { optionId: "ramen", label: "Ramen", count: 5 },
      { optionId: "thali", label: "Thali", count: 2 },
    ]);
  });

  it("ignores option ids that are not on the poll", () => {
    // The payload is a broadcast anyone in the room receives; an id outside the poll's
    // frozen options is stale or forged, and either way it is not something to draw.
    const merged = applyLiveCounts(BUCKETS, { ramen: 5, pizza: 99 });

    expect(merged).toEqual([
      { optionId: "ramen", label: "Ramen", count: 5 },
      { optionId: "thali", label: "Thali", count: 1 },
    ]);
  });

  it("leaves rows alone when the payload carries nothing for them", () => {
    const merged = applyLiveCounts(BUCKETS, {});

    expect(merged).toEqual(BUCKETS);
  });

  it("does not mutate the input buckets", () => {
    const before = BUCKETS.map((bucket) => ({ ...bucket }));

    applyLiveCounts(BUCKETS, { ramen: 9, thali: 9 });

    expect(BUCKETS).toEqual(before);
  });
});
