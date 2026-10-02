import { z } from "zod";

import { questionKindSchema } from "../question/model";

import { formThemeKeySchema } from "../utils/theme";

export const createFormInput = z.object({
  title: z.string().trim().min(1).max(120).describe("Title of the form"),
  description: z.string().trim().max(300).optional().describe("Optional description of the form"),
});

export type CreateFormInputType = z.input<typeof createFormInput>;

export const listFormsByUserIdInput = z.object({
  userId: z.string().min(1).describe("User ID"),
});

export type ListFormsByUserIdInputType = z.input<typeof listFormsByUserIdInput>;

export const getFormInput = z.object({
  formId: z.string().min(1).describe("ID of the form to fetch"),
});

export type GetFormInputType = z.input<typeof getFormInput>;

/**
 * Form-level settings. Every field is optional so a single call can change one thing.
 *
 * There is deliberately no `.refine()` on this schema: `trpc-to-openapi` calls `.omit()`
 * on the top-level input to build the request body, and Zod forbids that on a refined
 * schema. The "did you actually change anything" check lives in the service instead,
 * where it can throw a `ConflictError` with a message aimed at the creator.
 *
 * `closesAt` and `thankYou*` are presentation and policy rather than structure, which is
 * why they can change while the form is live without bumping `version`.
 */
export const updateFormSettingsInput = z.object({
  formId: z.string().min(1).describe("ID of the form to update"),
  title: z.string().trim().min(1).max(120).optional().describe("Updated title"),
  description: z.string().trim().max(300).nullable().optional().describe("Updated description"),
  layoutMode: z.enum(["STEP", "PAGED"]).optional().describe("Updated layout"),
  themeKey: formThemeKeySchema.optional().describe("Updated theme preset"),
  showProgress: z.boolean().optional().describe("Show a progress indicator"),
  allowBack: z.boolean().optional().describe("Let respondents go back"),
  oneResponsePerDevice: z.boolean().optional().describe("Only one submission per device"),
  maxResponses: z.number().int().positive().max(1_000_000).nullable().optional(),
  closesAt: z.iso.datetime().nullable().optional().describe("When the form stops accepting"),
  thankYouTitle: z.string().trim().max(120).nullable().optional(),
  thankYouMessage: z.string().trim().max(2000).nullable().optional(),
  thankYouRedirectUrl: z.url().nullable().optional().describe("Where to send respondents after"),
});

export type UpdateFormSettingsInputType = z.input<typeof updateFormSettingsInput>;

/**
 * Set or clear the shared form password. Passing null makes the form open to anyone
 * with the link. The value is hashed before it is stored.
 *
 * `null` is the only way to remove a password. An empty string is rejected rather than
 * treated as "clear", because the two are easy to confuse at a call site and silently
 * unprotecting a form is not a thing to do by accident.
 *
 * Eight characters, matching the account password and the hint the builder's dialog shows.
 * Four was short enough to be worth guessing, which matters more here than for a login: this
 * value is shared with respondents in an email or a chat, not chosen per person.
 */
export const setFormPasswordInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  password: z
    .string()
    .min(8)
    .max(128)
    .nullable()
    .describe("New password, or null to remove the password"),
});

export type SetFormPasswordInputType = z.input<typeof setFormPasswordInput>;

export const updateFormSlugInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  /** The part after `/f/`. Changing it breaks any QR code already shared. */
  slug: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, digits and hyphens")
    .describe("New share slug"),
});

export type UpdateFormSlugInputType = z.input<typeof updateFormSlugInput>;

export const deleteFormInput = z.object({
  formId: z.string().min(1).describe("ID of the form to delete"),
});

export type DeleteFormInputType = z.input<typeof deleteFormInput>;

export const setFormStatusInput = z.object({
  formId: z.string().min(1).describe("ID of the form"),
  status: z.enum(["PUBLISHED", "CLOSED", "DRAFT"]).describe("Status to move the form to"),
});

export type SetFormStatusInputType = z.input<typeof setFormStatusInput>;

// ── Shared definition shapes ───────────────────────────────────────────────────

export const formPageDefinitionSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  position: z.string(),
});

export type FormPageDefinition = z.infer<typeof formPageDefinitionSchema>;

export const questionDefinitionSchema = z.object({
  id: z.string(),
  pageId: z.string().nullable(),
  position: z.string(),
  // The one of the thirteen, not an arbitrary string: the renderer switches on it and
  // the builder's kind picker can only produce a member of the enum.
  kind: questionKindSchema,
  label: z.string(),
  labelKey: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  isRequired: z.boolean(),
  settings: z.unknown(),
});

export type QuestionDefinition = z.infer<typeof questionDefinitionSchema>;

/**
 * The whole form as the builder needs it. This is the contract shared by the service,
 * the tRPC output and the builder store, so it is declared once here.
 */
export interface FormDefinition {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  layoutMode: "STEP" | "PAGED";
  themeKey: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  showProgress: boolean;
  allowBack: boolean;
  oneResponsePerDevice: boolean;
  maxResponses: number | null;
  closesAt: Date | null;
  thankYouTitle: string | null;
  thankYouMessage: string | null;
  thankYouRedirectUrl: string | null;
  version: number;
  publishedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  pages: FormPageDefinition[];
  questions: QuestionDefinition[];
}
