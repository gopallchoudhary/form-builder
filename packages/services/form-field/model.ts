import { z } from 'zod'

// ── Shared enum ────────────────────────────────────────────────────────────────
export const fieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'EMAIL', 'YES_NO', 'PASSWORD'])
export type FieldType = z.infer<typeof fieldTypeSchema>

// ── createField ────────────────────────────────────────────────────────────────
export const createFieldInput = z.object({
    formId: z.string().min(1).describe('ID of the form this field belongs to'),
    label: z.string().min(1).max(100).describe('Human-readable label for the field'),
    placeholder: z.string().optional().describe('Placeholder text for the input'),
    description: z.string().optional().describe('Helper text shown below the field'),
    isRequired: z.boolean().default(false).describe('Whether the field is required'),
    type: fieldTypeSchema.describe('Field input type'),
    index: z.string().describe('Fractional index for ordering within the form'),
})

export type CreateFieldInputType = z.infer<typeof createFieldInput>

// ── updateField ────────────────────────────────────────────────────────────────
export const updateFieldInput = z.object({
    fieldId: z.string().min(1).describe('ID of the field to update'),
    label: z.string().min(1).max(100).optional().describe('Updated label'),
    placeholder: z.string().optional().describe('Updated placeholder'),
    description: z.string().optional().describe('Updated description'),
    isRequired: z.boolean().optional().describe('Updated required flag'),
    type: fieldTypeSchema.optional().describe('Updated field type'),
    index: z.string().optional().describe('Updated fractional index'),
})

export type UpdateFieldInputType = z.infer<typeof updateFieldInput>

// ── deleteField ────────────────────────────────────────────────────────────────
export const deleteFieldInput = z.object({
    fieldId: z.string().min(1).describe('ID of the field to delete'),
})

export type DeleteFieldInputType = z.infer<typeof deleteFieldInput>

// ── getField ───────────────────────────────────────────────────────────────────
export const getFieldInput = z.object({
    fieldId: z.string().min(1).describe('ID of the field to fetch'),
})

export type GetFieldInputType = z.infer<typeof getFieldInput>
