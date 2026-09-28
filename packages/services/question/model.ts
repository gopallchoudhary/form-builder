import { z } from "zod";

import { questionSettingsByKind } from "./settings";

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

/** Per-kind settings, validated against `kind` by `settingsForKind` below. */
const looseSettings = z.unknown();

// ── createQuestion ─────────────────────────────────────────────────────────────

export const createQuestionInput = z.object({
  formId: z.string().min(1).describe("ID of the form this question belongs to"),
  pageId: z
    .string()
    .min(1)
    .optional()
    .describe("Page this question sits on. Omitted in STEP layout."),
  /** Omit to append after the last question on the page. */
  position: position.optional().describe("Fractional index for ordering within the page"),
  kind: questionKindSchema.describe("Question input type"),
  label: z.string().trim().min(1).max(200).describe("Human-readable label for the question"),
  placeholder: z.string().max(200).optional().describe("Placeholder text for the input"),
  description: z.string().max(500).optional().describe("Helper text shown below the question"),
  isRequired: z.boolean().default(false).describe("Whether an answer is required"),
  settings: looseSettings.optional().describe("Per-kind configuration"),
});

export type CreateQuestionInputType = z.input<typeof createQuestionInput>;

// ── updateQuestion ─────────────────────────────────────────────────────────────

export const updateQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to update"),
  label: z.string().trim().min(1).max(200).optional().describe("Updated label"),
  placeholder: z.string().max(200).nullable().optional().describe("Updated placeholder"),
  description: z.string().max(500).nullable().optional().describe("Updated helper text"),
  isRequired: z.boolean().optional().describe("Updated required flag"),
  kind: questionKindSchema.optional().describe("Updated question type"),
  position: position.optional().describe("Updated fractional index"),
  pageId: z.string().min(1).nullable().optional().describe("Updated page assignment"),
  /** Required whenever `kind` changes, so the two can never disagree. */
  settings: looseSettings.optional().describe("Updated per-kind configuration"),
});

export type UpdateQuestionInputType = z.input<typeof updateQuestionInput>;

// ── deleteQuestion ─────────────────────────────────────────────────────────────

export const deleteQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to delete"),
});

export type DeleteQuestionInputType = z.input<typeof deleteQuestionInput>;

// ── getQuestion ────────────────────────────────────────────────────────────────

export const getQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to fetch"),
});

export type GetQuestionInputType = z.input<typeof getQuestionInput>;

// ── listQuestions ──────────────────────────────────────────────────────────────

export const listQuestionsInput = z.object({
  formId: z.string().min(1).describe("ID of the form to fetch questions for"),
  /** When set, restrict to one page. */
  pageId: z.string().min(1).optional().describe("Only questions on this page"),
});

export type ListQuestionsInputType = z.input<typeof listQuestionsInput>;

// ── reorderQuestions ───────────────────────────────────────────────────────────

/** The complete question order for a page (or for the form in STEP layout). */
export const reorderQuestionsInput = z.object({
  formId: z.string().min(1).describe("ID of the form being reordered"),
  pageId: z.string().min(1).optional().describe("Reorder within this page only"),
  orderedQuestionIds: z
    .array(z.string().min(1))
    .min(1)
    .max(500)
    .describe("Every question id in scope, in the wanted order"),
});

export type ReorderQuestionsInputType = z.input<typeof reorderQuestionsInput>;

// ── duplicateQuestion ──────────────────────────────────────────────────────────

export const duplicateQuestionInput = z.object({
  questionId: z.string().min(1).describe("ID of the question to duplicate"),
  /** Overrides the copy's label, which must differ to get a fresh labelKey. */
  label: z.string().trim().min(1).max(200).optional().describe("Label for the copy"),
});

export type DuplicateQuestionInputType = z.input<typeof duplicateQuestionInput>;

/** Validates `settings` for `kind`, exposing the per-kind schemas for the API layer. */
export function settingsForKind(kind: QuestionKind) {
  return questionSettingsByKind[kind];
}
