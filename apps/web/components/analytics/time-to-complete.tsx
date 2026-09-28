"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { formatDuration } from "~/components/analytics/kpi-row";

/**
 * How long responses take.
 *
 * The average is drawn on the histogram rather than only stated, because "2m 10s on
 * average" and a distribution can be very different stories — a bimodal curve with a mean in
 * the empty middle is the usual sign that some people finish instantly and others abandon.
 */

const config = {
  responses: { label: "Responses" },
} satisfies ChartConfig;

export interface Timing {
  count: number;
  averageSeconds: number | null;
  medianSeconds: number | null;
  histogram: Array<{ label: string; min: number; max: number | null; count: number }>;
}

export function TimeToComplete({ timing }: { timing: Timing }) {
  const data = timing.histogram
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      label: bucket.label,
      count: bucket.count,
      // The header states the window, so the value below it can just be the count.
      window:
        bucket.max === null
          ? `${formatDuration(bucket.min)} and over`
          : `${formatDuration(bucket.min)}–${formatDuration(bucket.max)}`,
    }));

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Time to complete</h2>
        <p className="text-muted-foreground text-xs">
          {timing.count > 0
            ? `Average ${formatDuration(timing.averageSeconds)} · median ${formatDuration(timing.medianSeconds)}`
            : "No completed responses yet"}
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Timing appears once somebody has finished the form.
        </p>
      ) : (
        <ChartContainer config={config} className="mt-4 aspect-auto h-48 w-full">
          <BarChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    const window = (payload?.[0]?.payload as { window?: string } | undefined)
                      ?.window;
                    return window ? `${String(value)} — ${window}` : String(value);
                  }}
                />
              }
            />
            {timing.medianSeconds !== null && (
              <ReferenceLine
                // Placed by label because the buckets are uneven: a 0–30s bucket and a
                // 5–10m one are not the same distance apart, so a value axis would lie.
                x={timing.histogram.find((bucket) => {
                  const max = bucket.max ?? Number.POSITIVE_INFINITY;
                  return timing.medianSeconds! >= bucket.min && timing.medianSeconds! < max;
                })?.label}
                stroke="var(--foreground)"
                strokeDasharray="3 3"
                label={{ value: "median", position: "top", fontSize: 10 }}
              />
            )}
            <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
}
