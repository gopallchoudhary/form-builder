"use client";

import { useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetAnswerDistribution } from "~/hooks/api/analytics";
import { cn } from "~/lib/utils";
import { useBuilderStore } from "~/stores/builder-store";

/**
 * How people answered one question.
 *
 * The mark depends on the shape of the answer rather than on taste: a two-way question is a
 * donut because "yes" and "no" are parts of a whole, and a five-option question is bars
 * because its options are not parts of anything. Forcing a donut onto a rating scale would
 * imply five shares of one thing.
 */

const config = {
  count: { label: "Responses" },
} satisfies ChartConfig;

/** The categorical slice of the brand palette, in order. */
const SLICES = [
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
];

export function AnswerDistributions() {
  const formId = useBuilderStore((state) => state.definition?.id ?? null);
  const questions = useBuilderStore((state) => state.definition?.questions ?? []);

  // Only the kinds whose answers are worth a chart. A free-text field has no distribution.
  const chartable = questions.filter(
    (question) =>
      ["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN", "RATING", "YES_NO"].includes(question.kind),
  );

  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? chartable[0]?.id ?? null;
  const active = chartable.find((question) => question.id === activeId) ?? null;

  const { data, isLoading } = useGetAnswerDistribution(formId, activeId);

  if (chartable.length === 0) {
    return (
      <section className="rounded-xl bg-card p-5 ring-1 ring-border">
        <h2 className="text-sm font-medium">Answers</h2>
        <p className="text-muted-foreground mt-3 text-sm">
          Nothing to chart yet — add a choice, rating or yes/no question and the distribution
          appears here once people answer it.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-sm font-medium">Answers</h2>

      {/*
        A picker rather than a grid of one chart per question: a form can have twenty
        questions, and twenty charts is a page nobody reads.
      */}
      {chartable.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Question">
          {chartable.map((question) => (
            <button
              key={question.id}
              type="button"
              role="tab"
              aria-selected={question.id === activeId}
              onClick={() => setSelected(question.id)}
              className={cn(
                "rounded-pill px-3 py-1 text-xs font-medium transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                question.id === activeId
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {question.label}
            </button>
          ))}
        </div>
      )}

      {active && (
        <p className="text-muted-foreground mt-3 text-xs">
          {active.label} · {data?.total ?? 0} answered
        </p>
      )}

      {isLoading && <Skeleton className="mt-4 h-48 w-full" />}

      {data && data.buckets.length === 0 && !isLoading && (
        <p className="text-muted-foreground mt-4 text-sm">Nobody has answered this yet.</p>
      )}

      {data && data.buckets.length > 0 && (
        <div className="mt-4">
          {active?.kind === "YES_NO" ? (
            <YesNoPie total={data.total} buckets={data.buckets} />
          ) : (
            <OptionBars
              total={data.total}
              buckets={data.buckets}
              horizontal={data.buckets.length > 4}
            />
          )}
        </div>
      )}
    </section>
  );
}

type Buckets = Array<{ value: string; label: string; count: number }>;

function YesNoPie({ total, buckets }: { total: number; buckets: Buckets }) {
  const data = buckets.map((bucket, index) => ({
    name: bucket.label || bucket.value,
    value: bucket.count,
    fill: index === 0 ? "var(--chart-2)" : "var(--muted)",
  }));

  return (
    <div className="flex flex-wrap items-center gap-6">
      <ChartContainer config={config} className="mx-auto aspect-square h-40 w-40">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        </PieChart>
      </ChartContainer>

      <ul className="flex flex-col gap-2">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-pill" style={{ background: entry.fill }} />
            <span>{entry.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {entry.value} · {total === 0 ? "0" : Math.round((entry.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OptionBars({
  total,
  buckets,
  horizontal,
}: {
  total: number;
  buckets: Buckets;
  horizontal: boolean;
}) {
  const data = buckets.map((bucket) => ({
    label: bucket.label || bucket.value,
    count: bucket.count,
    // Carried on the payload so the tooltip header can show it. `labelFormatter` takes a
    // much simpler signature than Recharts' `formatter`, and "The API · 48%" reads better
    // in a header than a value like "12 · 48%".
    share: total === 0 ? "0%" : `${Math.round((bucket.count / total) * 100)}%`,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <RechartsBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: horizontal ? 8 : 4, right: 8 }}
      >
        <CartesianGrid
          vertical={!horizontal}
          horizontal={horizontal}
          stroke="var(--border)"
        />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
          </>
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value, payload) => {
                const share = (payload?.[0]?.payload as { share?: string } | undefined)?.share;
                return share ? `${String(value)} · ${share}` : String(value);
              }}
            />
          }
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.label} fill={SLICES[index % SLICES.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  );
}
