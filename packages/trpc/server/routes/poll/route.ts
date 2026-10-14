import { pollService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  castVoteInputModel,
  castVoteOutputSchema,
  createPollInputModel,
  createPollOutputSchema,
  deletePollOutputSchema,
  getPollInsightsInputModel,
  getPollResultsInputModel,
  getPublicPollInputModel,
  pollDetailOutputSchema,
  pollIdInputModel,
  pollInsightsOutputSchema,
  pollListInputModel,
  pollResultsOutputSchema,
  pollSummaryOutputSchema,
  publicPollOutputSchema,
  setPollStatusInputModel,
  setPollStatusOutputSchema,
  updatePollInputModel,
} from "./model";

import { emitPollResults } from "../../realtime";
import {
  authenticatedProcedure,
  publicProcedure,
  router,
  sensitivePublicProcedure,
} from "../../trpc";

const TAGS = ["Polls"];
const getPath = generatePath("/poll");

/**
 * The creator's poll surface: everything the Polls section needs, in one router.
 *
 * Every procedure takes the user from the session — ownership lives in the service, where a
 * forgotten `userId` is a compile error rather than a bypassed middleware.
 */
export const pollRouter = router({
  /** The creator's poll list, most recently active first, with vote totals. */
  listPolls: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listPolls"),
        tags: TAGS,
        protect: true,
        summary: "Your polls with vote totals",
      },
    })
    /*
     * No input: the user comes from the session, not the request. Taking a `userId`
     * parameter here would let any signed-in caller list anyone else's polls by naming
     * them, which per-poll ownership checks elsewhere cannot prevent.
     */
    .input(pollListInputModel)
    .output(pollSummaryOutputSchema.array())
    .query(({ ctx }) => pollService.listPollsByUserId({ userId: ctx.user.id })),

  createPoll: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createPoll"),
        tags: TAGS,
        protect: true,
        summary: "Create a draft poll",
      },
    })
    .input(createPollInputModel)
    .output(createPollOutputSchema)
    .mutation(({ ctx, input }) => pollService.createPoll(ctx.user.id, input)),

  /** One poll with its options, for the detail page header. */
  getPoll: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getPoll"),
        tags: TAGS,
        protect: true,
        summary: "One of your polls",
      },
    })
    .input(pollIdInputModel)
    .output(pollDetailOutputSchema)
    .query(({ ctx, input }) => pollService.getPollById(ctx.user.id, input.pollId)),

  updatePoll: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updatePoll"),
        tags: TAGS,
        protect: true,
        summary: "Edit a poll's title, description or draft options",
      },
    })
    .input(updatePollInputModel)
    .output(pollDetailOutputSchema)
    .mutation(({ ctx, input }) => pollService.updatePoll(ctx.user.id, input)),

  setPollStatus: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/setPollStatus"),
        tags: TAGS,
        protect: true,
        summary: "Open or close one of your polls",
      },
    })
    .input(setPollStatusInputModel)
    .output(setPollStatusOutputSchema)
    .mutation(({ ctx, input }) => pollService.setPollStatus(ctx.user.id, input)),

  deletePoll: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deletePoll"),
        tags: TAGS,
        protect: true,
        summary: "Delete a poll and its votes",
      },
    })
    .input(pollIdInputModel)
    .output(deletePollOutputSchema)
    .mutation(({ ctx, input }) => pollService.deletePoll(ctx.user.id, input)),

  /**
   * What a voter may see.
   *
   * A draft reads as missing — the public must not learn it exists. The tally travels only
   * with a device that voted; without that, "results after voting" would be client-side
   * hiding, readable by anyone with the link.
   */
  getPollBySlug: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getPollBySlug"),
        tags: TAGS,
        protect: false,
        summary: "Open a poll by its share slug",
      },
    })
    .input(getPublicPollInputModel)
    .output(publicPollOutputSchema)
    .query(({ input }) => pollService.getPublicPoll(input)),

  /** The live tally for the detail page's Results section. */
  getPollResults: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getPollResults"),
        tags: TAGS,
        protect: true,
        summary: "Vote counts per option for one of your polls",
      },
    })
    .input(getPollResultsInputModel)
    .output(pollResultsOutputSchema)
    .query(({ ctx, input }) => pollService.getResultsForCreator(ctx.user.id, input)),

  /** Votes over time and peak hours for the detail page's Insights section. */
  getPollInsights: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getPollInsights"),
        tags: TAGS,
        protect: true,
        summary: "Vote history and peak hours for one of your polls",
      },
    })
    .input(getPollInsightsInputModel)
    .output(pollInsightsOutputSchema)
    .query(({ ctx, input }) => pollService.getInsightsForCreator(ctx.user.id, input)),

  /**
   * Tight limit: a vote is a cheap write from an unauthenticated device, which is exactly
   * what ballot-stuffing looks like. Same tier as form submissions.
   *
   * The broadcast goes out after the vote commits, never before: emitting first and writing
   * second would show watchers a tally the database does not have if the write then failed.
   */
  castVote: sensitivePublicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/castVote"),
        tags: TAGS,
        protect: false,
        summary: "Vote on an open poll, or move your vote",
      },
    })
    .input(castVoteInputModel)
    .output(castVoteOutputSchema)
    .mutation(async ({ input }) => {
      const vote = await pollService.castVote(input);

      const tally = await pollService.getResults(input.pollId);
      emitPollResults(input.pollId, {
        counts: Object.fromEntries(tally.buckets.map((bucket) => [bucket.optionId, bucket.count])),
        total: tally.total,
        updatedAt: new Date().toISOString(),
      });

      return vote;
    }),
});
