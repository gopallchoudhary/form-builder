"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { AnswerDistributions } from "~/components/analytics/answer-distribution";
import { Funnel } from "~/components/analytics/funnel";
import { KpiRow } from "~/components/analytics/kpi-row";
import { QuestionDropOff } from "~/components/analytics/question-dropoff";
import { TimeToComplete } from "~/components/analytics/time-to-complete";
import { TrendChart } from "~/components/analytics/trend-chart";
import { FormPicker, useSelectedForm } from "~/components/console/form-picker";
import { SectionHeader } from "~/components/console/section-header";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  useGetFormAnalytics,
  useGetFunnel,
  useGetQuestionDropOff,
  useGetTimeToComplete,
} from "~/hooks/api/analytics";
import { useGetForm } from "~/hooks/api/form";
import {
  RANGE_PRESETS,
  useAnalyticsStore,
  type RangePreset,
} from "~/stores/analytics-store";

/**
 * How one form is doing, in depth.
 *
 * A top-level section with a form picker rather than a form's fifth tab, because the way to
 * read it is "show me a form", not "I am currently in a form". The dashboard answers the
 * other half of the question — how everything is doing at once — and the two do not overlap.
 *
 * The five procedures are fetched together rather than as a waterfall, because a creator
 * opening this page wants all of it at once and the data is small. The range lives in the
 * store, so switching between here and the overview keeps the same window.
 */
export default function AnalyticsPage() {
  const { selected, select, forms = [], isLoading } = useSelectedForm();
  const formId = selected;

  const [rangeKey, setRangeKey] = useState<RangePreset>("30d");
  const { preset, setPreset, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      setPreset: state.setPreset,
      toQuery: state.toQuery,
    })),
  );

  const range = toQuery();
  const { form } = useGetForm(formId);

  const headline = useGetFormAnalytics(formId, range);
  const funnel = useGetFunnel(formId, range);
  const dropOff = useGetQuestionDropOff(formId, range);
  const timing = useGetTimeToComplete(formId, range);

  // `rangeKey` is the local echo of the click, so the buttons respond immediately; the store
  // is what survives navigating away and back.
  const activePreset = rangeKey || preset;

  if (forms.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <SectionHeader
          formId={null}
          title="Analytics"
          description="How one form is performing."
        />
        <p className="text-muted-foreground text-sm">
          Share a form and its numbers will start arriving here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <SectionHeader
        formId={formId}
        title="Analytics"
        description={
          formId
            ? `How ${form?.title ?? "this form"} is performing.`
            : "How one form is performing."
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormPicker value={formId} onChange={select} />

        <div className="flex gap-1">
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
      </div>

      {formId && (
        <>
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

          <AnswerDistributions
            formId={formId}
            questions={(form?.questions ?? []).map((question) => ({
              id: question.id,
              kind: question.kind,
              label: question.label,
            }))}
          />

          {timing.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : timing.data ? (
            <TimeToComplete timing={timing.data} />
          ) : null}
        </>
      )}
    </div>
  );
}
