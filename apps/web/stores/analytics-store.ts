import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The date range and bucket size the analytics pages read.
 *
 * Persisted because a range is a view preference, not form data: coming back to the
 * dashboard should not silently reset someone who is comparing the last 30 days.
 */

export type Granularity = "day" | "week" | "month";

export const GRANULARITIES: Granularity[] = ["day", "week", "month"];

export interface DateRange {
  from: string | null;
  to: string | null;
}

export const RANGE_PRESETS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

export interface AnalyticsState {
  range: DateRange;
  /** `custom` once a range has been set by hand, so no preset button stays lit. */
  preset: RangePreset | "custom";
  granularity: Granularity;

  setPreset: (preset: RangePreset) => void;
  setRange: (range: DateRange) => void;
  setGranularity: (granularity: Granularity) => void;
  /** The `{ from, to }` pair the analytics hooks take, omitting an unbounded end. */
  toQuery: () => { from?: string; to?: string };
}

/**
 * The ISO strings the API expects.
 *
 * `to` is the *start* of the last day rather than its end, so a range ending today does
 * not depend on what time it is now — otherwise the last bucket would be a partial day
 * that disagreed with the total.
 */
function rangeFromPreset(preset: RangePreset): DateRange {
  const days = RANGE_PRESETS[preset];
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  return {
    from: from.toISOString(),
    to: startOfDay(to).toISOString(),
  };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      range: rangeFromPreset("30d"),
      preset: "30d",
      granularity: "day",

      setPreset: (preset) => set({ preset, range: rangeFromPreset(preset) }),

      setRange: (range) => set({ range, preset: "custom" }),

      setGranularity: (granularity) => set({ granularity }),

      toQuery: () => {
        const { from, to } = get().range;
        return {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        };
      },
    }),
    { name: "streamyst:analytics" },
  ),
);

/**
 * A sensible bucket for the range: 90 days of hours is unreadable, and 7 days of months
 * is a single bar. Only used when the caller has not chosen.
 */
export function defaultGranularity(range: DateRange): Granularity {
  if (!range.from || !range.to) return "day";
  const days =
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000;
  if (days > 120) return "month";
  if (days > 45) return "week";
  return "day";
}
