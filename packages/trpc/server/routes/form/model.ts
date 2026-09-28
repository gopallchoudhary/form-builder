import { z } from "zod";

// Input schemas are owned by the service layer — this module only re-exports them
// so route files keep a stable import surface.
//
// Note: `listForms` deliberately takes no client input. The service schema
// `listFormsByUserIdInput` includes the userId, which the route derives from the
// session rather than accepting it from the caller.
export { createFormInput as createFormInputModel } from "@repo/services/form/model";
export {
  createQuestionInput as createQuestionInputModel,
  updateQuestionInput as updateQuestionInputModel,
  deleteQuestionInput as deleteQuestionInputModel,
  getQuestionInput as getQuestionInputModel,
  listQuestionsInput as listQuestionsInputModel,
  questionKindSchema as questionKindModel,
} from "@repo/services/question/model";

// ── Form procedures ────────────────────────────────────────────────────────────

export const createFormOutputModel = z.object({
  id: z.string().describe("Id of the created form"),
  slug: z.string().describe("Share slug for the public URL"),
});

/** The signed-in user's own forms — nothing to accept from the caller. */
export const listFormsInputModel = z.undefined();

export const listFormsOutputModel = z.array(
  z.object({
    id: z.string().describe("Id of the form"),
    slug: z.string().describe("Share slug for the public URL"),
    title: z.string().describe("Title of the form"),
    description: z.string().nullable().optional().describe("Description of the form"),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).describe("Publication state"),
    createdAt: z.date().nullable().describe("When the form was created"),
    updatedAt: z.date().nullable().describe("When the form was last updated"),
  }),
);

// ── Shared question output shape ───────────────────────────────────────────────

export const questionOutputModel = z.object({
  id: z.string().describe("Id of the question"),
  formId: z.string().describe("Id of the owning form"),
  pageId: z.string().nullable().describe("Page this question sits on, if any"),
  position: z.string().nullable().describe("Fractional index for ordering"),
  kind: z.enum([
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
  ]).describe("Question input type"),
  label: z.string().describe("Human-readable label"),
  labelKey: z.string().describe("Stable slug key — write-once"),
  description: z.string().nullable().optional().describe("Helper text"),
  placeholder: z.string().nullable().optional().describe("Placeholder text"),
  isRequired: z.boolean().describe("Whether an answer is required"),
  settings: z.unknown().describe("Per-kind configuration, validated per kind"),
  createdAt: z.date().nullable().describe("When the question was created"),
  updatedAt: z.date().nullable().describe("When the question was last updated"),
});

// ── createQuestion ─────────────────────────────────────────────────────────────

export const createQuestionOutputModel = z.object({
  id: z.string().describe("Id of the created question"),
  labelKey: z.string().describe("Generated stable slug key"),
});

// ── updateQuestion ─────────────────────────────────────────────────────────────

export const updateQuestionOutputModel = z.object({
  id: z.string().describe("Id of the updated question"),
});

// ── deleteQuestion ─────────────────────────────────────────────────────────────

export const deleteQuestionOutputModel = z.object({
  id: z.string().describe("Id of the deleted question"),
});

// ── getQuestion ────────────────────────────────────────────────────────────────

export const getQuestionOutputModel = questionOutputModel;

// ── listQuestions ──────────────────────────────────────────────────────────────

export const listQuestionsOutputModel = z.array(questionOutputModel);
