import { z } from "zod";

export {
  castVoteInput as castVoteInputModel,
  createPollInput as createPollInputModel,
  getPollInsightsInput as getPollInsightsInputModel,
  getPollResultsInput as getPollResultsInputModel,
  getPublicPollInput as getPublicPollInputModel,
  listPollsByUserIdInput as listPollsByUserIdInputModel,
  pollIdInput as pollIdInputModel,
  setPollStatusInput as setPollStatusInputModel,
  updatePollInput as updatePollInputModel,
} from "@repo/services/poll/model";

const POLL_STATUS = z.enum(["DRAFT", "OPEN", "CLOSED"]);

const POLL_OPTION = z.object({
  id: z.string(),
  label: z.string(),
});

export const pollSummaryOutputSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: POLL_STATUS,
  options: z.array(POLL_OPTION),
  totalVotes: z.number().int(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const pollDetailOutputSchema = pollSummaryOutputSchema.omit({ totalVotes: true });

export const createPollOutputSchema = z.object({
  id: z.string(),
  slug: z.string(),
});

export const setPollStatusOutputSchema = z.object({
  pollId: z.string(),
  status: POLL_STATUS,
});

export const deletePollOutputSchema = z.object({
  id: z.string(),
});

export const castVoteOutputSchema = z.object({
  pollId: z.string(),
  optionId: z.string(),
  changed: z.boolean(),
  created: z.boolean(),
});

const TALLY_BUCKET = z.object({
  optionId: z.string(),
  label: z.string(),
  count: z.number().int(),
});

export const pollResultsOutputSchema = z.object({
  buckets: z.array(TALLY_BUCKET),
  total: z.number().int(),
});

export const pollInsightsOutputSchema = z.object({
  series: z.array(
    z.object({
      day: z.string(),
      count: z.number().int(),
    }),
  ),
  peakHours: z.array(
    z.object({
      hour: z.number().int(),
      count: z.number().int(),
    }),
  ),
});

/**
 * What a voter may see.
 *
 * The tally is present if and only if this device voted. Returning counts unconditionally
 * would make "results after voting" client-side hiding — anyone with the link could read
 * the tally without voting, simply by asking.
 */
export const publicPollOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: POLL_STATUS,
  options: z.array(POLL_OPTION),
  voted: z.boolean(),
  optionId: z.string().nullable(),
  tally: pollResultsOutputSchema.nullable(),
});
