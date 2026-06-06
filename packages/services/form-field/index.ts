import { db, eq } from '@repo/database'
import { formFieldsTable } from '@repo/database/models/form-field'
import {
    createFieldInput, CreateFieldInputType,
    updateFieldInput, UpdateFieldInputType,
    deleteFieldInput, DeleteFieldInputType,
    getFieldInput, GetFieldInputType,
} from './model'

// ── Helper ─────────────────────────────────────────────────────────────────────
// Converts a label into a stable slug used as the labelKey.
// Only called once at field creation time — never on updates.
function toLabelKey(label: string): string {
    return label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric chars
        .replace(/\s+/g, '-')            // spaces → hyphens
        .replace(/-+/g, '-')             // collapse multiple hyphens
        .slice(0, 50)                    // respect DB column length
}

class FormFieldService {

    //. get field by id (private — used internally by update/delete for existence checks)
    private async getFieldById(fieldId: string) {
        const result = await db
            .select()
            .from(formFieldsTable)
            .where(eq(formFieldsTable.id, fieldId))

        if (!result || result.length === 0) {
            throw new Error(`Field with id ${fieldId} does not exist`)
        }

        return result[0]!
    }

    //. create field
    public async createField(payload: CreateFieldInputType) {
        const {
            formId,
            label,
            placeholder,
            description,
            isRequired,
            type,
            index,
        } = await createFieldInput.parseAsync(payload)

        // Derive labelKey from label — write-once, never updated
        const labelKey = toLabelKey(label)

        const insertResult = await db
            .insert(formFieldsTable)
            .values({
                formId,
                label,
                labelKey,
                placeholder,
                description,
                isRequired,
                type,
                index,
            })
            .returning({ id: formFieldsTable.id })

        if (!insertResult || insertResult.length === 0 || !insertResult[0]?.id) {
            throw new Error('Something went wrong while creating the field')
        }

        return {
            id: insertResult[0].id,
            labelKey,
        }
    }

    //. update field
    public async updateField(payload: UpdateFieldInputType) {
        const {
            fieldId,
            label,
            placeholder,
            description,
            isRequired,
            type,
            index,
        } = await updateFieldInput.parseAsync(payload)

        // Confirm field exists before updating
        await this.getFieldById(fieldId)

        // Build only the fields that were actually provided
        const updateData: Partial<{
            label: string
            placeholder: string
            description: string
            isRequired: boolean
            type: 'TEXT' | 'NUMBER' | 'EMAIL' | 'YES_NO' | 'PASSWORD'
            index: string
        }> = {}

        if (label !== undefined)       updateData.label = label
        if (placeholder !== undefined) updateData.placeholder = placeholder
        if (description !== undefined) updateData.description = description
        if (isRequired !== undefined)  updateData.isRequired = isRequired
        if (type !== undefined)        updateData.type = type
        if (index !== undefined)       updateData.index = index

        // NOTE: labelKey is intentionally never updated — it is write-once

        const updateResult = await db
            .update(formFieldsTable)
            .set(updateData)
            .where(eq(formFieldsTable.id, fieldId))
            .returning({ id: formFieldsTable.id })

        if (!updateResult || updateResult.length === 0) {
            throw new Error('Something went wrong while updating the field')
        }

        return { id: fieldId }
    }

    //. delete field
    public async deleteField(payload: DeleteFieldInputType) {
        const { fieldId } = await deleteFieldInput.parseAsync(payload)

        // Confirm field exists before deleting
        await this.getFieldById(fieldId)

        await db
            .delete(formFieldsTable)
            .where(eq(formFieldsTable.id, fieldId))

        return { id: fieldId }
    }

    //. get field
    public async getField(payload: GetFieldInputType) {
        const { fieldId } = await getFieldInput.parseAsync(payload)

        const field = await db
            .select({
                id: formFieldsTable.id,
                label: formFieldsTable.label,
                labelKey: formFieldsTable.labelKey,
                placeholder: formFieldsTable.placeholder,
                description: formFieldsTable.description,
                isRequired: formFieldsTable.isRequired,
                type: formFieldsTable.type,
                index: formFieldsTable.index,
                formId: formFieldsTable.formId,
                createdAt: formFieldsTable.createdAt,
                updatedAt: formFieldsTable.updatedAt,
            })
            .from(formFieldsTable)
            .where(eq(formFieldsTable.id, fieldId))

        if (!field || field.length === 0) {
            throw new Error(`Field with id ${fieldId} does not exist`)
        }

        return field[0]!
    }
}

export default FormFieldService
