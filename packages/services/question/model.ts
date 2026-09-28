import { z } from "zod";

/** Mirrors `question_kind_enum` in the database. */
export const questionKindSchema = z.enum([
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "PASSWORD",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DROPDOWN",
  "RATING",
  "DATE",
  "ADDRESS",
]);

export type QuestionKind = z.infer<typeof questionKindSchema>;

/** A fractional index, e.g. "1.00" or "1.50". */
const position = z
  .string()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, "Position must be a number with at most 2 decimal places");

// ── createQuestion ─────────────────────────────────────────────────────────────

export const createQuestionInput = z.object({
  formId: z.string().min(1).describe("ID of the form this question belongs to"),
  pageId: z
    .string()
    .min(1)
    .optional()
    .describe("Page this question sits on. Omitted in STEP layout."),
  position: position.describe("Fractional index for ordering within the page"),
  kind: questionKindSchema.describe("Question input type"),
  label: z.string().min(1).max(200).describe("Human-readable label for the question"),
  placeholder: z.string().max(200).optional().describe("Placeholder text for the input"),
  description: z.string().max(500).optional().describe("Helper text shown below the question"),
  isRequired: z.boolean().default(false).describe("Whether an answer is required"),
});

export type CreateQuestionInputType = z.infer<typeof createQuestionInput>;

// ── updateQuestion ─────────────────────────────────────────────────────────────

export const updateQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to update"),
  label: z.string().min(1).max(200).optional().describe("Updated label"),
  placeholder: z.string().max(200).optional().describe("Updated placeholder"),
  description: z.string().max(500).optional().describe("Updated helper text"),
  isRequired: z.boolean().optional().describe("Updated required flag"),
  kind: questionKindSchema.optional().describe("Updated question type"),
  position: position.optional().describe("Updated fractional index"),
  pageId: z.string().min(1).nullable().optional().describe("Updated page assignment"),
});

export type UpdateQuestionInputType = z.infer<typeof updateQuestionInput>;

// ── deleteQuestion ─────────────────────────────────────────────────────────────

export const deleteQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to delete"),
});

export type DeleteQuestionInputType = z.infer<typeof deleteQuestionInput>;

// ── getQuestion ────────────────────────────────────────────────────────────────

export const getQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to fetch"),
});

export type GetQuestionInputType = z.infer<typeof getQuestionInput>;

// ── listQuestions ──────────────────────────────────────────────────────────────

export const listQuestionsInput = z.object({
  formId: z.string().min(1).describe("ID of the form to fetch questions for"),
});

export type ListQuestionsInputType = z.infer<typeof listQuestionsInput>;
