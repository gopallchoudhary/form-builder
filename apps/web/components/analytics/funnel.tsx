"use client";

import { cn } from "~/lib/utils";

/**
 * The funnel: views → starts → completes.
 *
 * Drawn rather than charted, because the thing worth seeing is the *width* at each step and
 * the size of the fall between them, and a bar chart of three numbers says that less
 * directly than three narrowing bars do. Each gap states how many people it cost, in
 * people, because "completion rate 24%" does not tell a creator which step to fix.
 */

export interface FunnelData {
  views: number;
  starts: number;
  completions: number;
  viewToStartRate: number;
  startToCompleteRate: number;
  overallRate: number;
}

const STEPS = [
  { key: "views", label: "Opened the form" },
  { key: "starts", label: "Started answering" },
  { key: "completions", label: "Finished" },
] as const;

const percent = (rate: number) =>
  `${rate >= 0 && rate < 0.005 ? "<1" : Math.round(rate * 100)}%`;

export function Funnel({ data }: { data: FunnelData }) {
  const values: Record<(typeof STEPS)[number]["key"], number> = {
    views: data.views,
    starts: data.starts,
    completions: data.completions,
  };
  const widest = Math.max(data.views, data.starts, data.completions, 1);

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-sm font-medium">Funnel</h2>

      <ol className="mt-4 flex flex-col gap-1">
        {STEPS.map((step, index) => {
          const value = values[step.key];
          // Width is relative to the widest step, not to the total, so a healthy middle
          // step is not flattened to nothing by a large view count.
          const width = Math.max(6, Math.round((value / widest) * 100));

          return (
            <li key={step.key} className="flex flex-col">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{step.label}</span>
                <span className="text-sm font-semibold tabular-nums">{value}</span>
              </div>

              <div className="mt-1 h-7 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${width}%` }}
                />
              </div>

              {index < STEPS.length - 1 && (
                <DropOff next={STEPS[index + 1]!.key as "starts" | "completions"} data={data} />
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-muted-foreground mt-4 text-xs">
        {percent(data.overallRate)} of everyone who opened the form finished it.
      </p>
    </section>
  );
}

function DropOff({ next, data }: { next: "starts" | "completions"; data: FunnelData }) {
  const lost = next === "starts" ? data.views - data.starts : data.starts - data.completions;
  const rate = next === "starts" ? data.viewToStartRate : data.startToCompleteRate;
  const noun = next === "starts" ? "started" : "finished";

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 py-1.5 pl-1 text-xs",
        // A step that keeps almost nobody is the one to fix, so it is called out rather
        // than left for the reader to compute.
        lost > 0 && rate < 0.5 ? "text-[#b86700]" : "text-muted-foreground",
      )}
    >
      <span aria-hidden className="text-muted-foreground/50">
        ↓
      </span>
      {lost > 0 ? (
        <span>
          {lost} {lost === 1 ? "person" : "people"} did not {noun} ({percent(rate)} carried
          over)
        </span>
      ) : (
        <span>Nobody stopped here</span>
      )}
    </p>
  );
}
