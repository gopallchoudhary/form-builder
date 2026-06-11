import { z } from 'zod'

// ── Form procedures ────────────────────────────────────────────────────────────

export const createFormInputModel = z.object({
    title: z.string().min(1).max(55).describe('Title of the form'),
    description: z.string().max(300).optional().describe('Optional description of the form'),
})

export const createFormOutputModel = z.object({
    id: z.string().describe('Id of the created form'),
})

export const listFormsInputModel = z.undefined()

export const listFormsOutputModel = z.array(
    z.object({
        id: z.string().describe('Id of the form'),
        title: z.string().describe('Title of the form'),
        description: z.string().nullable().optional().describe('Description of the form'),
        createdAt: z.date().nullable().describe('When the form was created'),
        updatedAt: z.date().nullable().describe('When the form was last updated'),
    })
)

// ── Shared field type enum ─────────────────────────────────────────────────────

export const fieldTypeModel = z.enum(['TEXT', 'NUMBER', 'EMAIL', 'YES_NO', 'PASSWORD'])

// ── Shared field output shape ──────────────────────────────────────────────────

export const fieldOutputModel = z.object({
    id: z.string().describe('Id of the field'),
    label: z.string().describe('Human-readable label'),
    labelKey: z.string().describe('Stable slug key — write-once'),
    placeholder: z.string().nullable().optional().describe('Placeholder text'),
    description: z.string().nullable().optional().describe('Helper text'),
    isRequired: z.boolean().describe('Whether the field is required'),
    type: fieldTypeModel.describe('Field input type'),
    index: z.string().nullable().describe('Fractional index for ordering'),
    formId: z.string().nullable().describe('Parent form id'),
    createdAt: z.date().nullable().describe('When the field was created'),
    updatedAt: z.date().nullable().describe('When the field was last updated'),
})

// ── createField ────────────────────────────────────────────────────────────────

export const createFieldInputModel = z.object({
    formId: z.string().min(1).describe('ID of the parent form'),
    label: z.string().min(1).max(100).describe('Human-readable label'),
    placeholder: z.string().optional().describe('Placeholder text'),
    description: z.string().optional().describe('Helper text'),
    isRequired: z.boolean().default(false).describe('Whether the field is required'),
    type: fieldTypeModel.describe('Field input type'),
    index: z.string().describe('Fractional index for ordering'),
})

export const createFieldOutputModel = z.object({
    id: z.string().describe('Id of the created field'),
    labelKey: z.string().describe('Generated stable slug key'),
})

// ── updateField ────────────────────────────────────────────────────────────────

export const updateFieldInputModel = z.object({
    fieldId: z.string().min(1).describe('ID of the field to update'),
    label: z.string().min(1).max(100).optional().describe('Updated label'),
    placeholder: z.string().optional().describe('Updated placeholder'),
    description: z.string().optional().describe('Updated description'),
    isRequired: z.boolean().optional().describe('Updated required flag'),
    type: fieldTypeModel.optional().describe('Updated field type'),
    index: z.string().optional().describe('Updated fractional index'),
})

export const updateFieldOutputModel = z.object({
    id: z.string().describe('Id of the updated field'),
})

// ── deleteField ────────────────────────────────────────────────────────────────

export const deleteFieldInputModel = z.object({
    fieldId: z.string().min(1).describe('ID of the field to delete'),
})

export const deleteFieldOutputModel = z.object({
    id: z.string().describe('Id of the deleted field'),
})

// ── getField ───────────────────────────────────────────────────────────────────

export const getFieldInputModel = z.object({
    fieldId: z.string().min(1).describe('ID of the field to fetch'),
})

export const getFieldOutputModel = fieldOutputModel

// ── listFields ─────────────────────────────────────────────────────────────────

export const listFieldsInputModel = z.object({
    formId: z.string().min(1).describe('ID of the form to fetch fields for'),
})

export const listFieldsOutputModel = z.array(fieldOutputModel)
