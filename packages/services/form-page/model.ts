import { z } from "zod";

export const createPageInput = z.object({
  formId: z.string().min(1).describe("ID of the form to add a page to"),
  title: z.string().trim().min(1).max(120).optional().describe("Page title, e.g. Address"),
  description: z.string().trim().max(500).optional().describe("Intro shown above the page"),
  /**
   * Where to insert the page. Omit to append to the end. May be the id of an existing
   * page, in which case the new page is placed directly after it.
   */
  afterPageId: z.string().min(1).optional().describe("Place the new page after this one"),
});

export type CreatePageInputType = z.input<typeof createPageInput>;

export const updatePageInput = z.object({
  pageId: z.string().min(1).describe("ID of the page to update"),
  title: z.string().trim().max(120).nullable().optional().describe("Updated page title"),
  description: z.string().trim().max(500).nullable().optional().describe("Updated intro"),
});

export type UpdatePageInputType = z.input<typeof updatePageInput>;

export const deletePageInput = z.object({
  pageId: z.string().min(1).describe("ID of the page to delete"),
});

export type DeletePageInputType = z.input<typeof deletePageInput>;

/** The complete page order for a form. Must contain every live page exactly once. */
export const reorderPagesInput = z.object({
  formId: z.string().min(1).describe("ID of the form being reordered"),
  orderedPageIds: z
    .array(z.string().min(1))
    .min(1)
    .max(200)
    .describe("Every page id of the form, in the wanted order"),
});

export type ReorderPagesInputType = z.input<typeof reorderPagesInput>;

export const listPagesInput = z.object({
  formId: z.string().min(1).describe("ID of the form to list pages for"),
});

export type ListPagesInputType = z.input<typeof listPagesInput>;
