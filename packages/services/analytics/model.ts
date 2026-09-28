import { z } from "zod";

/** Optional date window. Omit both ends for "the last 30 days". */
const rangeFields = {
  from: z.iso.datetime().optional().describe("Inclusive lower bound"),
  to: z.iso.datetime().optional().describe("Inclusive upper bound"),
};

export const formAnalyticsInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  ...rangeFields,
});

export type FormAnalyticsInputType = z.input<typeof formAnalyticsInput>;

export const getFunnelInput = formAnalyticsInput;

export type GetFunnelInputType = z.input<typeof getFunnelInput>;

export const getQuestionDropOffInput = formAnalyticsInput;

export type GetQuestionDropOffInputType = z.input<typeof getQuestionDropOffInput>;

export const getTimeToCompleteInput = formAnalyticsInput;

export type GetTimeToCompleteInputType = z.input<typeof getTimeToCompleteInput>;

export const overviewInput = z.object(rangeFields);

export type OverviewInputType = z.input<typeof overviewInput>;

export const answerDistributionInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  questionId: z.string().min(1).describe("Question to break down"),
});

export type AnswerDistributionInputType = z.input<typeof answerDistributionInput>;

/** Kept as a named export so the API layer can reuse the range parsing. */
export const analyticsRangeInput = formAnalyticsInput;
