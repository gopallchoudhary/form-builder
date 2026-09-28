import { z } from "zod";

/** One answer as shown in the responses table, with the question it answers. */
export const responseAnswerSchema = z.object({
  questionId: z.string(),
  questionLabel: z.string().nullable(),
  questionLabelKey: z.string().nullable(),
  questionKind: z.string().nullable(),
  valueText: z.string().nullable(),
  valueNumber: z.string().nullable(),
  valueDate: z.string().nullable(),
  valueJson: z.unknown(),
});

export type ResponseAnswer = z.infer<typeof responseAnswerSchema>;

export const listResponsesInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  /** Only completed responses by default; pass "IN_PROGRESS" for live drafts. */
  status: z.enum(["COMPLETED", "IN_PROGRESS", "ALL"]).default("COMPLETED"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Match against any answer's text"),
  from: z.iso.datetime().optional().describe("Submitted on or after"),
  to: z.iso.datetime().optional().describe("Submitted on or before"),
});

export type ListResponsesInputType = z.input<typeof listResponsesInput>;

export const listResponsesOutputSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  responses: z.array(
    z.object({
      sessionId: z.string(),
      status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]),
      startedAt: z.date(),
      completedAt: z.date().nullable(),
      durationSeconds: z.number().nullable(),
      answers: z.array(responseAnswerSchema),
    }),
  ),
});

export type ListResponsesOutput = z.infer<typeof listResponsesOutputSchema>;

export const deleteResponseInput = z.object({
  formId: z.string().min(1),
  sessionId: z.string().uuid(),
});

export type DeleteResponseInputType = z.input<typeof deleteResponseInput>;
