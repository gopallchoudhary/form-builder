"use client";

import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetOverview } from "~/hooks/api/analytics";
import { RANGE_PRESETS, useAnalyticsStore, type RangePreset } from "~/stores/analytics-store";

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

/**
 * The dashboard overview, on real analytics.
 *
 * This replaces a page that rendered `data.json` — a hard-coded chart from the template —
 * and redirected to itself in an effect. The charts come with the analytics phase; the
 * numbers here are the real queries, so the page is worth having now.
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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              onClick={() => setPreset(option)}
            >
              {RANGE_PRESETS[option]}d
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Forms" value={String(data.totals.forms)} />
            <Stat label="Published" value={String(data.totals.published)} />
            <Stat label="Views" value={String(data.totals.views)} />
            <Stat
              label="Completion rate"
              value={percent(data.totals.completionRate)}
            />
          </div>

          {data.forms.length === 0 ? (
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
                <Link href="/dashboard/forms">Go to forms</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">Your forms and their totals</caption>
                <thead>
                  <tr className="bg-muted/40 border-b text-left">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Form
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Views
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Completions
                    </th>
                    <th scope="col" className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.forms.map((form) => (
                    <tr key={form.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">{form.title}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{form.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{form.views}</td>
                      <td className="px-4 py-2.5">{form.completions}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/dashboard/forms/${form.id}/build`}>
                            Open
                            <ArrowRightIcon className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
