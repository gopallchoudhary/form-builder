import { analyticsService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  answerDistributionInputModel,
  formAnalyticsInputModel,
  getAnswerDistributionOutputSchema,
  getFormAnalyticsOutputSchema,
  getFunnelInputModel,
  getFunnelOutputSchema,
  getOverviewInputModel,
  getOverviewOutputSchema,
  getQuestionDropOffInputModel,
  getQuestionDropOffOutputSchema,
  getTimeToCompleteInputModel,
  getTimeToCompleteOutputSchema,
} from "./model";

import { authenticatedProcedure, router } from "../../trpc";

const TAGS = ["Analytics"];
const getPath = generatePath("/form/analytics");

export const analyticsRouter = router({
  /** Everything the per-form analytics page needs, in one call. */
  getFormAnalytics: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormAnalytics"),
        tags: TAGS,
        protect: true,
        summary: "Headline numbers, trend and funnel for one of your forms",
      },
    })
    .input(formAnalyticsInputModel)
    .output(getFormAnalyticsOutputSchema)
    .query(({ input, ctx }) => analyticsService.getFormAnalytics(ctx.user.id, input)),

  getFunnel: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFunnel"),
        tags: TAGS,
        protect: true,
        summary: "Views to starts to completions for one of your forms",
      },
    })
    .input(getFunnelInputModel)
    .output(getFunnelOutputSchema)
    .query(({ input, ctx }) => analyticsService.getFunnel(ctx.user.id, input)),

  getQuestionDropOff: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getQuestionDropOff"),
        tags: TAGS,
        protect: true,
        summary: "How far respondents got through one of your forms",
      },
    })
    .input(getQuestionDropOffInputModel)
    .output(getQuestionDropOffOutputSchema)
    .query(({ input, ctx }) => analyticsService.getQuestionDropOff(ctx.user.id, input)),

  getAnswerDistribution: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getAnswerDistribution"),
        tags: TAGS,
        protect: true,
        summary: "How people answered one question of one of your forms",
      },
    })
    .input(answerDistributionInputModel)
    .output(getAnswerDistributionOutputSchema)
    .query(({ input, ctx }) => analyticsService.getAnswerDistribution(ctx.user.id, input)),

  getTimeToComplete: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getTimeToComplete"),
        tags: TAGS,
        protect: true,
        summary: "How long responses take for one of your forms",
      },
    })
    .input(getTimeToCompleteInputModel)
    .output(getTimeToCompleteOutputSchema)
    .query(({ input, ctx }) => analyticsService.getTimeToComplete(ctx.user.id, input)),

  /** Across every form the signed-in user owns. */
  getOverview: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getOverview"),
        tags: TAGS,
        protect: true,
        summary: "Totals and trend across all of your forms",
      },
    })
    .input(getOverviewInputModel)
    .output(getOverviewOutputSchema)
    .query(({ input, ctx }) => analyticsService.getOverview(ctx.user.id, input)),
});
