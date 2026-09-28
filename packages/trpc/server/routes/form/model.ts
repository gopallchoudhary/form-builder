import { z } from "zod";

import { formPageDefinitionSchema, questionDefinitionSchema } from "@repo/services/form/model";

// Input schemas are owned by the service layer — this module only re-exports them
// so route files keep a stable import surface. Only the output schemas live here.
//
// Note: `listForms` deliberately takes no client input. The service schema
// `listFormsByUserIdInput` includes the userId, which the route derives from the
// session rather than accepting it from the caller.
export {
  createFormInput as createFormInputModel,
  deleteFormInput as deleteFormInputModel,
  getFormInput as getFormInputModel,
  setFormPasswordInput as setFormPasswordInputModel,
  setFormStatusInput as setFormStatusInputModel,
  updateFormSettingsInput as updateFormSettingsInputModel,
  updateFormSlugInput as updateFormSlugInputModel,
} from "@repo/services/form/model";

// ── Outputs ────────────────────────────────────────────────────────────────────

export const formSettingsOutputSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  layoutMode: z.enum(["STEP", "PAGED"]),
  themeKey: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
  showProgress: z.boolean(),
  allowBack: z.boolean(),
  oneResponsePerDevice: z.boolean(),
  maxResponses: z.number().int().nullable(),
  closesAt: z.date().nullable(),
  thankYouTitle: z.string().nullable(),
  thankYouMessage: z.string().nullable(),
  thankYouRedirectUrl: z.string().nullable(),
  /** Whether an audience has to enter a password. The hash itself is never returned. */
  passwordProtected: z.boolean(),
  version: z.number().int(),
  publishedAt: z.date().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

/**
 * The whole editable form, which the builder store hydrates from.
 *
 * `passwordProtected` is deliberately absent: it belongs to the settings panel, and
 * carrying it on the definition would put a field in the store that no builder action ever
 * reads — and that the autosave diff would have to know to ignore.
 */
export const formOutputSchema = formSettingsOutputSchema
  .omit({ passwordProtected: true })
  .extend({
    pages: z.array(formPageDefinitionSchema),
    questions: z.array(questionDefinitionSchema),
  });

export const createFormOutputSchema = z.object({
  id: z.string().describe("Id of the created form"),
  slug: z.string().describe("Share slug for the public URL"),
});

export const listFormsInputModel = z.undefined();

export const listFormsOutputSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
  }),
);

export const idOutputSchema = z.object({ id: z.string() });

export const slugOutputSchema = z.object({ slug: z.string() });

export const setPasswordOutputSchema = z.object({
  formId: z.string(),
  passwordProtected: z.boolean(),
});
