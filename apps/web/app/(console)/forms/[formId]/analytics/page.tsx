"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import { BuilderChrome } from "~/components/builder/builder-chrome";
import { AnswerDistributions } from "~/components/analytics/answer-distribution";
import { Funnel } from "~/components/analytics/funnel";
import { KpiRow } from "~/components/analytics/kpi-row";
import { QuestionDropOff } from "~/components/analytics/question-dropoff";
import { TimeToComplete } from "~/components/analytics/time-to-complete";
import { TrendChart } from "~/components/analytics/trend-chart";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  useGetFormAnalytics,
  useGetFunnel,
  useGetQuestionDropOff,
  useGetTimeToComplete,
} from "~/hooks/api/analytics";
import {
  RANGE_PRESETS,
  useAnalyticsStore,
  type RangePreset,
} from "~/stores/analytics-store";

/**
 * Analytics for one form.
 *
 * The five procedures are fetched together rather than as a waterfall, because a creator
 * opening this page wants all of it at once and the data is small. The range lives in the
 * store, so switching between this page and the overview keeps the same window.
 */
function AnalyticsBody() {
  const { formId } = useParams<{ formId: string }>();
  const [rangeKey, setRangeKey] = useState<RangePreset>("30d");

  const { preset, setPreset, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      setPreset: state.setPreset,
      toQuery: state.toQuery,
    })),
  );

  const range = toQuery();

  const headline = useGetFormAnalytics(formId, range);
  const funnel = useGetFunnel(formId, range);
  const dropOff = useGetQuestionDropOff(formId, range);
  const timing = useGetTimeToComplete(formId, range);

  // `rangeKey` is the local echo of the click, so the buttons respond immediately; the
  // store is what survives navigating away and back.
  const activePreset = rangeKey || preset;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={activePreset === option ? "default" : "outline"}
            aria-pressed={activePreset === option}
            onClick={() => {
              setRangeKey(option);
              setPreset(option);
            }}
          >
            {RANGE_PRESETS[option]} days
          </Button>
        ))}
      </div>

      {headline.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : headline.data ? (
        <KpiRow
          kpis={{
            responses: headline.data.totals.completions,
            views: headline.data.totals.views,
            completionRate: headline.data.totals.completionRate,
            averageSeconds: timing.data?.averageSeconds ?? null,
          }}
          caption={
            timing.data && timing.data.count > 0
              ? `From ${timing.data.count} completed response${timing.data.count === 1 ? "" : "s"}, bucketed by ${headline.data.granularity}.`
              : undefined
          }
        />
      ) : null}

      {headline.data && (
        <TrendChart series={headline.data.series} granularity={headline.data.granularity} />
      )}

      {funnel.data && <Funnel data={funnel.data} />}

      {dropOff.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : dropOff.data ? (
        <QuestionDropOff rows={dropOff.data} />
      ) : null}

      <AnswerDistributions />

      {timing.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : timing.data ? (
        <TimeToComplete timing={timing.data} />
      ) : null}
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
