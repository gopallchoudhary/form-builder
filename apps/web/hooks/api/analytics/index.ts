import { trpc } from "~/trpc/client";

/**
 * Analytics hooks.
 *
 * `from` / `to` are ISO strings, so the range the analytics store holds can be passed
 * straight through as a query key.
 */

export type AnalyticsRange = { from?: string; to?: string };

export const useGetFormAnalytics = (formId: string | null, range: AnalyticsRange = {}) =>
  trpc.analytics.getFormAnalytics.useQuery(
    { formId: formId ?? "", ...range },
    { enabled: !!formId, placeholderData: (previous) => previous },
  );

export const useGetFunnel = (formId: string | null, range: AnalyticsRange = {}) =>
  trpc.analytics.getFunnel.useQuery(
    { formId: formId ?? "", ...range },
    { enabled: !!formId, placeholderData: (previous) => previous },
  );

export const useGetQuestionDropOff = (formId: string | null, range: AnalyticsRange = {}) =>
  trpc.analytics.getQuestionDropOff.useQuery(
    { formId: formId ?? "", ...range },
    { enabled: !!formId, placeholderData: (previous) => previous },
  );

export const useGetAnswerDistribution = (formId: string | null, questionId: string | null) =>
  trpc.analytics.getAnswerDistribution.useQuery(
    { formId: formId ?? "", questionId: questionId ?? "" },
    { enabled: !!formId && !!questionId },
  );

export const useGetTimeToComplete = (formId: string | null, range: AnalyticsRange = {}) =>
  trpc.analytics.getTimeToComplete.useQuery(
    { formId: formId ?? "", ...range },
    { enabled: !!formId, placeholderData: (previous) => previous },
  );

export const useGetOverview = (range: AnalyticsRange = {}) =>
  trpc.analytics.getOverview.useQuery(range, { placeholderData: (previous) => previous });
