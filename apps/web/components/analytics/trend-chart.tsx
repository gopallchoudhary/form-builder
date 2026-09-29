"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";

/**
 * Views, starts and submissions over the range.
 *
 * Three series on one axis rather than three charts, because the question is how they move
 * *relative* to each other: views rising while submissions stay flat is the shape of a link
 * people do not trust, and three stacked panels would hide that.
 */

const config = {
  views: { label: "Opened", color: "var(--chart-4)" },
  starts: { label: "Started", color: "var(--chart-3)" },
  submissions: { label: "Finished", color: "var(--chart-2)" },
} satisfies ChartConfig;

export interface TrendPoint {
  at: string;
  views: number;
  starts: number;
  submissions: number;
}

export function TrendChart({
  series,
  granularity,
}: {
  series: TrendPoint[];
  /** The bucket the server chose, shown so the x-axis is never ambiguous. */
  granularity: "day" | "week" | "month";
}) {
  if (series.length === 0) {
    return <Empty label="No activity in this range" />;
  }

  const data = series.map((point) => ({
    ...point,
    // Buckets are labelled by day, because "2026-03-01 00:00" is not something a person
    // reads at a glance.
    label: formatBucket(point.at, granularity),
  }));

  return (
    <section className="rounded-lg bg-card p-5 ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Trend</h2>
        <p className="text-muted-foreground text-xs">by {granularity}</p>
      </div>

      <ChartContainer config={config} className="mt-4 aspect-auto h-56 w-full">
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
          <defs>
            {(["views", "starts", "submissions"] as const).map((key) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.7} />
                <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            width={32}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <ChartLegend content={<ChartLegendContent />} />

          {(["views", "starts", "submissions"] as const).map((key) => (
            <Area
              key={key}
              dataKey={key}
              type="monotone"
              stackId="a"
              stroke={`var(--color-${key})`}
              fill={`url(#fill-${key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </section>
  );
}

function formatBucket(at: string, granularity: "day" | "week" | "month"): string {
  const date = new Date(at);
  if (granularity === "month") {
    return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Empty({ label }: { label: string }) {
  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-sm font-medium">Trend</h2>
      <p className="text-muted-foreground mt-4 text-sm">{label}</p>
    </section>
  );
}
