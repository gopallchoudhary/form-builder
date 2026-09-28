import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The date range and bucket size the analytics pages read.
 *
 * Persisted because a range is a view preference, not form data: coming back to the
 * dashboard should not silently reset someone who is comparing the last 30 days.
 */

/**
 * The bucket size is chosen by the service from the range and returned with the series —
 * 90 days of hourly buckets is unreadable and 7 days of monthly buckets is one bar. A client
 * control could only ever disagree with the server, so the UI shows what it was sent.
 */
export type Granularity = "day" | "week" | "month";

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

  setPreset: (preset: RangePreset) => void;
  setRange: (range: DateRange) => void;
  /** The `{ from, to }` pair the analytics hooks take, omitting an unbounded end. */
  toQuery: () => { from?: string; to?: string };
}

/**
 * The ISO strings the API expects.
 *
 * `to` is the *end* of today, so a response that arrived an hour ago is inside the window.
 * Ending the range at midnight instead made every total silently exclude today — a creator
 * who had just received a response saw zero, which is the one number they cannot explain
 * away. The daily buckets still line up with whole days either way.
 */
function rangeFromPreset(preset: RangePreset): DateRange {
  const days = RANGE_PRESETS[preset];
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  return {
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
  };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      range: rangeFromPreset("30d"),
      preset: "30d",

      setPreset: (preset) => set({ preset, range: rangeFromPreset(preset) }),

      setRange: (range) => set({ range, preset: "custom" }),

      toQuery: () => {
        const { from, to } = get().range;
        return {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        };
      },
    }),
    {
      name: "streamyst:analytics",
      /*
       * A relative preset is a window, not two dates, so it is recomputed on every load.
       * Persisting the resolved range meant someone who opened the page on Monday was still
       * looking at a window ending that Monday the following week.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.preset === "custom") return;
        state.setPreset(state.preset);
      },
    },
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
