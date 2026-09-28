import { z } from "zod";

// Input schemas are owned by the service layer — this module only re-exports them
// so route files keep a stable import surface.
//
// Note: `listForms` deliberately takes no client input. The service schema
// `listFormsByUserIdInput` includes the userId, which the route derives from the
// session rather than accepting it from the caller.
export { createFormInput as createFormInputModel } from "@repo/services/form/model";
export {
  createFieldInput as createFieldInputModel,
  updateFieldInput as updateFieldInputModel,
  deleteFieldInput as deleteFieldInputModel,
  getFieldInput as getFieldInputModel,
  listFieldsInput as listFieldsInputModel,
} from "@repo/services/form-field/model";

// ── Form procedures ────────────────────────────────────────────────────────────

export const createFormOutputModel = z.object({
  id: z.string().describe("Id of the created form"),
});

/** The signed-in user's own forms — nothing to accept from the caller. */
export const listFormsInputModel = z.undefined();

export const listFormsOutputModel = z.array(
  z.object({
    id: z.string().describe("Id of the form"),
    title: z.string().describe("Title of the form"),
    description: z.string().nullable().optional().describe("Description of the form"),
    createdAt: z.date().nullable().describe("When the form was created"),
    updatedAt: z.date().nullable().describe("When the form was last updated"),
  }),
);

// ── Shared field type enum ─────────────────────────────────────────────────────

export const fieldTypeModel = z.enum(["TEXT", "NUMBER", "EMAIL", "YES_NO", "PASSWORD"]);

// ── Shared field output shape ──────────────────────────────────────────────────

export const fieldOutputModel = z.object({
  id: z.string().describe("Id of the field"),
  label: z.string().describe("Human-readable label"),
  labelKey: z.string().describe("Stable slug key — write-once"),
  placeholder: z.string().nullable().optional().describe("Placeholder text"),
  description: z.string().nullable().optional().describe("Helper text"),
  isRequired: z.boolean().describe("Whether the field is required"),
  type: fieldTypeModel.describe("Field input type"),
  index: z.string().nullable().describe("Fractional index for ordering"),
  formId: z.string().nullable().describe("Parent form id"),
  createdAt: z.date().nullable().describe("When the field was created"),
  updatedAt: z.date().nullable().describe("When the field was last updated"),
});

// ── createField ────────────────────────────────────────────────────────────────

export const createFieldOutputModel = z.object({
  id: z.string().describe("Id of the created field"),
  labelKey: z.string().describe("Generated stable slug key"),
});

// ── updateField ────────────────────────────────────────────────────────────────

export const updateFieldOutputModel = z.object({
  id: z.string().describe("Id of the updated field"),
});

// ── deleteField ────────────────────────────────────────────────────────────────

export const deleteFieldOutputModel = z.object({
  id: z.string().describe("Id of the deleted field"),
});

// ── getField ───────────────────────────────────────────────────────────────────

export const getFieldOutputModel = fieldOutputModel;

// ── listFields ─────────────────────────────────────────────────────────────────

export const listFieldsOutputModel = z.array(fieldOutputModel);
