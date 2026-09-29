"use client";

import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { FileTextIcon } from "lucide-react";

import { KpiRow } from "~/components/analytics/kpi-row";
import { TrendChart } from "~/components/analytics/trend-chart";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetOverview } from "~/hooks/api/analytics";
import { RANGE_PRESETS, useAnalyticsStore, type RangePreset } from "~/stores/analytics-store";

/**
 * The overview: every form at once.
 *
 * The same KPI row and trend chart the per-form page uses, over the same range — so the two
 * pages cannot disagree about how a number is defined, which is the usual way a dashboard
 * stops being trusted.
 *
 * The per-form list lives on `/forms`, not here. This page had a second copy of it — a
 * table of the same forms with their counts — and two pages that list the same things in
 * different shapes is one more than a person can be reminded of. `getOverview` still
 * returns the list, because the ordering guarantee behind it is deliberate and tested; it
 * is simply not rendered.
 */
export default function OverviewPage() {
  const { preset, setPreset, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      setPreset: state.setPreset,
      toQuery: state.toQuery,
    })),
  );

  const { data, isLoading } = useGetOverview(toQuery());

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every form you have created, and how it is doing.
          </p>
        </div>

        <div className="flex gap-1">
          {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={preset === option ? "default" : "outline"}
              aria-pressed={preset === option}
              onClick={() => setPreset(option)}
            >
              {RANGE_PRESETS[option]}d
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        data && (
          <KpiRow
            kpis={{
              responses: data.totals.completions,
              views: data.totals.views,
              completionRate: data.totals.completionRate,
              // Time to complete is per form; there is no single honest number across a
              // set of forms with wildly different lengths, so it is left out rather than
              // averaged into something meaningless.
              averageSeconds: null,
            }}
            caption={`${data.totals.forms} form${data.totals.forms === 1 ? "" : "s"}, ${data.totals.published} published.`}
          />
        )
      )}

      {data && <TrendChart series={data.series} granularity={data.granularity} />}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {data && data.totals.forms === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            <FileTextIcon className="text-muted-foreground size-7" />
          </div>
          <div>
            <p className="font-medium">No forms yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Create your first form to start collecting responses.
            </p>
          </div>
          <Button asChild>
            <Link href="/forms">Go to forms</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
