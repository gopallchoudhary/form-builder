import { z } from "zod";

export {
  createPageInput as createPageInputModel,
  deletePageInput as deletePageInputModel,
  listPagesInput as listPagesInputModel,
  reorderPagesInput as reorderPagesInputModel,
  updatePageInput as updatePageInputModel,
} from "@repo/services/form-page/model";

export const pageOutputSchema = z.object({
  id: z.string(),
  formId: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  position: z.string(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const listPagesOutputSchema = z.array(pageOutputSchema);

export const createPageOutputSchema = z.object({
  id: z.string().describe("Id of the created page"),
  position: z.string().describe("Where the page sits in the order"),
});

export const idOutputSchema = z.object({ id: z.string() });

export const reorderPagesOutputSchema = z.object({
  orderedPageIds: z.array(z.string()),
});
