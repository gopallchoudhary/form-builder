import { z } from "zod";

export {
  createQuestionInput as createQuestionInputModel,
  deleteQuestionInput as deleteQuestionInputModel,
  duplicateQuestionInput as duplicateQuestionInputModel,
  getQuestionInput as getQuestionInputModel,
  listQuestionsInput as listQuestionsInputModel,
  reorderQuestionsInput as reorderQuestionsInputModel,
  updateQuestionInput as updateQuestionInputModel,
  questionKindSchema as questionKindModel,
} from "@repo/services/question/model";

export const questionOutputSchema = z.object({
  id: z.string(),
  formId: z.string(),
  pageId: z.string().nullable(),
  position: z.string().nullable(),
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
  ]),
  label: z.string(),
  labelKey: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  isRequired: z.boolean(),
  /** Per-kind configuration. Shape depends on `kind`; validated by the service. */
  settings: z.unknown(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const listQuestionsOutputSchema = z.array(questionOutputSchema);

export const createQuestionOutputSchema = z.object({
  id: z.string().describe("Id of the created question"),
  labelKey: z.string().describe("Write-once slug derived from the label"),
  position: z.string().describe("Where the question sits in the order"),
});

export const duplicateQuestionOutputSchema = createQuestionOutputSchema;

export const idOutputSchema = z.object({ id: z.string() });

export const reorderQuestionsOutputSchema = z.object({
  orderedQuestionIds: z.array(z.string()),
});
