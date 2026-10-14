import { z } from "zod";

/**
 * Input models for polls.
 *
 * A poll is deliberately not a question kind: it lives in its own tables with its own
 * lifecycle (draft → open → closed), its own one-vote-per-device rule, and its own tally.
 * Merging it into the form machinery would have meant bending sessions, drafts and
 * analytics around something that is none of those.
 */

export const pollStatusSchema = z.enum(["DRAFT", "OPEN", "CLOSED"]);
export type PollStatus = z.infer<typeof pollStatusSchema>;

export const pollOptionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Option id may contain lowercase letters, digits, - and _"),
  label: z.string().min(1).max(200),
});

export type PollOption = z.infer<typeof pollOptionSchema>;

/** At least two options, or there is nothing to vote between. */
export const pollOptionsSchema = z
  .array(pollOptionSchema)
  .min(2, "A poll needs at least two options")
  .max(10, "A poll holds at most ten options")
  .refine(
    (options) => new Set(options.map((option) => option.id)).size === options.length,
    "Option ids must be unique",
  );

export const createPollInput = z.object({
  title: z.string().trim().min(1).max(120).describe("Title of the poll"),
  description: z.string().trim().max(300).optional().describe("Optional description of the poll"),
  options: pollOptionsSchema.describe("The options voters choose between"),
});

export type CreatePollInputType = z.input<typeof createPollInput>;

export const pollIdInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
});

/**
 * What may change, and when.
 *
 * Options freeze the moment a poll opens: editing them under live votes would orphan the
 * votes already cast, and a tally counting an option nobody can see answers a question that
 * was not asked. Title and description stay editable while closed, since neither affects a
 * single vote.
 */
export const updatePollInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
  title: z.string().trim().min(1).max(120).optional().describe("Title of the poll"),
  description: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .describe("Description of the poll, or null to clear it"),
  options: pollOptionsSchema.optional().describe("Options; only while the poll is a draft"),
});

export type UpdatePollInputType = z.input<typeof updatePollInput>;

export const setPollStatusInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
  status: pollStatusSchema.describe("DRAFT, OPEN or CLOSED"),
});

export type SetPollStatusInputType = z.input<typeof setPollStatusInput>;

export const listPollsByUserIdInput = z.object({
  userId: z.string().min(1).describe("User ID"),
});

export type ListPollsByUserIdInputType = z.input<typeof listPollsByUserIdInput>;

/** A vote. The device, not a login, is the voter — same posture as form sessions. */
export const castVoteInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
  deviceId: z.string().uuid().describe("Random id from the device cookie, never an identity"),
  optionId: z.string().min(1).max(40).describe("ID of the chosen option"),
});

export type CastVoteInputType = z.input<typeof castVoteInput>;

export const getPollResultsInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
});

export type GetPollResultsInputType = z.input<typeof getPollResultsInput>;

export const getPollInsightsInput = z.object({
  pollId: z.string().min(1).describe("ID of the poll"),
  /** How many days back the time series covers. Capped — a lifetime series is a denial of service on the chart. */
  days: z.number().int().min(1).max(90).default(30).describe("Days of history for the series"),
});

export type GetPollInsightsInputType = z.input<typeof getPollInsightsInput>;

export const getPublicPollInput = z.object({
  slug: z.string().min(1).max(64).describe("Public share slug of the poll"),
  deviceId: z.string().uuid().optional().describe("Present when checking whether this device voted"),
});

export type GetPublicPollInputType = z.input<typeof getPublicPollInput>;
