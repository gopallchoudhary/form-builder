import { z } from "zod";

const RATE = z.number();

const TREND_POINT = z.object({
  at: z.string().describe("Bucket start, as an ISO timestamp"),
  views: z.number().int(),
  starts: z.number().int(),
  submissions: z.number().int(),
});

const FUNNEL = z.object({
  views: z.number().int(),
  starts: z.number().int(),
  completions: z.number().int(),
  viewToStartRate: RATE,
  startToCompleteRate: RATE,
  overallRate: RATE,
});

export {
  answerDistributionInput as answerDistributionInputModel,
  formAnalyticsInput as formAnalyticsInputModel,
  getFunnelInput as getFunnelInputModel,
  getQuestionDropOffInput as getQuestionDropOffInputModel,
  getTimeToCompleteInput as getTimeToCompleteInputModel,
  overviewInput as getOverviewInputModel,
} from "@repo/services/analytics/model";

export const getFormAnalyticsOutputSchema = z.object({
  totals: z.object({
    views: z.number().int(),
    starts: z.number().int(),
    completions: z.number().int(),
    completionRate: RATE,
  }),
  granularity: z.enum(["day", "week", "month"]),
  series: z.array(TREND_POINT),
  funnel: FUNNEL,
  questionCount: z.number().int(),
});

export const getFunnelOutputSchema = FUNNEL;

export const getQuestionDropOffOutputSchema = z.array(
  z.object({
    questionId: z.string(),
    label: z.string(),
    kind: z.string(),
    position: z.number(),
    reached: z.number().int(),
    answered: z.number().int(),
    answerRate: RATE,
  }),
);

export const getAnswerDistributionOutputSchema = z.object({
  questionId: z.string(),
  total: z.number().int(),
  buckets: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      count: z.number().int(),
    }),
  ),
});

export const getTimeToCompleteOutputSchema = z.object({
  count: z.number().int(),
  averageSeconds: z.number().int().nullable(),
  medianSeconds: z.number().int().nullable(),
  histogram: z.array(
    z.object({
      label: z.string(),
      min: z.number(),
      /** Null for the open-ended top bucket, not an infinity. */
      max: z.number().nullable(),
      count: z.number().int(),
    }),
  ),
});

export const getOverviewOutputSchema = z.object({
  totals: z.object({
    forms: z.number().int(),
    published: z.number().int(),
    views: z.number().int(),
    completions: z.number().int(),
    completionRate: RATE,
  }),
  granularity: z.enum(["day", "week", "month"]),
  series: z.array(TREND_POINT),
  forms: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
      createdAt: z.date().nullable(),
      views: z.number().int(),
      completions: z.number().int(),
    }),
  ),
});
