"use client";

import { useParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { FormTabs } from "~/components/form-tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
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
    <div className="rounded-xl border bg-card p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default function FormAnalyticsPage() {
  const { formId } = useParams<{ formId: string }>();

  const { preset, granularity, setPreset, setGranularity, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      granularity: state.granularity,
      setPreset: state.setPreset,
      setGranularity: state.setGranularity,
      toQuery: state.toQuery,
    })),
  );

  const { data, isLoading } = useGetFormAnalytics(formId, toQuery());
  const { data: funnel } = useGetFunnel(formId, toQuery());

  return (
    <div className="flex flex-1 flex-col">
      <FormTabs formId={formId} />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={preset === option ? "default" : "outline"}
                  onClick={() => setPreset(option)}
                >
                  {RANGE_PRESETS[option]}d
                </Button>
              ))}
            </div>
            <select
              aria-label="Bucket size"
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value as (typeof GRANULARITIES)[number])
              }
              className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            >
              {GRANULARITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
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

            <section className="rounded-xl border bg-card p-5">
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
          <section className="rounded-xl border bg-card p-5">
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
      </div>
    </div>
  );
}
