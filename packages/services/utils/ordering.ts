/**
 * Fractional indexing.
 *
 * `position` is a fixed-scale decimal rather than an integer so a row can be
 * inserted between two neighbours without renumbering the whole list. When a gap
 * runs out the caller renumbers instead, which keeps the column a fixed scale and
 * therefore comparable and storable without surprises.
 */

export const POSITION_SCALE = 2;
const STEP = 10 ** POSITION_SCALE; // 100 at scale 2

export class PositionExhaustedError extends Error {
  constructor() {
    super("No room between these two positions; renumber the list and try again");
    this.name = "PositionExhaustedError";
  }
}

/** Parses a stored position. Throws on anything that is not a plain non-negative number. */
export function parsePosition(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid position: ${value}`);
  }
  return parsed;
}

/** Formats a number as a fixed-scale position string, e.g. `1` -> `"1.00"`. */
export function formatPosition(value: number): string {
  return value.toFixed(POSITION_SCALE);
}

/** The position for the nth row of a list that starts at 1. */
export function positionForIndex(index: number): string {
  return formatPosition(index + 1);
}

/**
 * A position strictly between `before` and `after`. Either bound may be null to mean
 * "at the start" or "at the end" respectively — pass `null` for both to get the
 * first position.
 *
 * Throws `PositionExhaustedError` when the gap is too small; the caller should then
 * renumber the list and retry.
 */
export function positionBetween(before: string | null, after: string | null): string {
  const low = before === null ? null : parsePosition(before);
  const high = after === null ? null : parsePosition(after);

  if (low === null && high === null) return formatPosition(1);
  if (low === null) return formatPosition(high! / 2);
  if (high === null) return formatPosition(low + 1);

  if (high <= low) {
    throw new Error(`Positions out of order: ${before} then ${after}`);
  }

  const candidate = (low + high) / 2;

  // No representable value strictly between them at this scale.
  if (Math.round(candidate * STEP) / STEP <= low || Math.round(candidate * STEP) / STEP >= high) {
    throw new PositionExhaustedError();
  }

  return formatPosition(candidate);
}

/** Sequential positions for a list, in the given order. */
export function sequentialPositions(count: number): string[] {
  return Array.from({ length: count }, (_, index) => positionForIndex(index));
}

/** True when the list is already 1.00, 2.00, ... in order, i.e. renumbering is a no-op. */
export function isSequential(positions: string[]): boolean {
  return positions.every(
    (value, index) => Math.abs(parsePosition(value) - (index + 1)) < 10 ** -POSITION_SCALE,
  );
}

/**
 * Park positions far above any real one, used as the first phase of a renumber.
 * `numeric(8,2)` tops out at 99999999.99, so this is comfortably in range.
 */
const TEMP_BASE = 100000;

function temporaryPosition(index: number): string {
  return formatPosition(TEMP_BASE + index);
}

/**
 * Rewrites positions to 1.00, 2.00, ... in the order given.
 *
 * Two phases, because `position` is under a unique index: writing the final values one
 * at a time would transiently collide with a row that has not moved yet — swapping the
 * first and third of three questions fails on the very first update. So every row is
 * first parked out of range, then moved to its destination.
 */
export async function renumberInOrder(
  orderedIds: string[],
  apply: (id: string, position: string) => Promise<void>,
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await apply(id, temporaryPosition(index));
  }

  const positions = sequentialPositions(orderedIds.length);
  for (const [index, id] of orderedIds.entries()) {
    await apply(id, positions[index]!);
  }
}
