"use client";

import { useParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { BuilderChrome } from "~/components/builder/builder-chrome";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetFormAnalytics, useGetFunnel } from "~/hooks/api/analytics";
import {
  GRANULARITIES,
  RANGE_PRESETS,
  useAnalyticsStore,
  type RangePreset,
} from "~/stores/analytics-store";

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function AnalyticsBody() {
  const { formId } = useParams<{ formId: string }>();

  const { preset, setPreset, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      setPreset: state.setPreset,
      toQuery: state.toQuery,
    })),
  );

  const { data, isLoading } = useGetFormAnalytics(formId, toQuery());
  const { data: funnel } = useGetFunnel(formId, toQuery());

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={preset === option ? "default" : "outline"}
            aria-pressed={preset === option}
            onClick={() => setPreset(option)}
          >
            {RANGE_PRESETS[option]} days
          </Button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-28 w-full" />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Views" value={String(data.totals.views)} />
            <Stat label="Starts" value={String(data.totals.starts)} />
            <Stat label="Completions" value={String(data.totals.completions)} />
            <Stat label="Completion rate" value={percent(data.totals.completionRate)} />
          </div>

          <section className="rounded-xl bg-card p-5 ring-1 ring-border">
            <h2 className="text-sm font-medium">Trend</h2>
            {data.series.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                No activity in this range.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {data.series.map((point) => (
                  <li
                    key={point.at}
                    className="text-muted-foreground flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-xs">
                      {new Date(point.at).toLocaleDateString()}
                    </span>
                    <span>
                      {point.views} views · {point.submissions} completed
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {funnel && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-sm font-medium">Funnel</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">View → start</p>
              <p className="font-semibold">{percent(funnel.viewToStartRate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Start → complete</p>
              <p className="font-semibold">{percent(funnel.startToCompleteRate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Overall</p>
              <p className="font-semibold">{percent(funnel.overallRate)}</p>
            </div>
          </div>
        </section>
      )}

      {/*
        The trend chart and the answer breakdowns are the analytics phase. What is here is
        the real numbers, from the real range, rather than template placeholders.
      */}
      <p className="text-muted-foreground text-xs">
        Bucketing: {GRANULARITIES.join(", ")} — chosen per view in the analytics phase.
      </p>
    </div>
  );
}

export default function FormAnalyticsPage() {
  const { formId } = useParams<{ formId: string }>();

  return (
    <BuilderChrome formId={formId}>
      <AnalyticsBody />
    </BuilderChrome>
  );
}
