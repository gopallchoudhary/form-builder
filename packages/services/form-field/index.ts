import { db, eq } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";

import { ConflictError, NotFoundError } from "../utils/errors";
import { assertFieldOwnership, assertFormOwnership } from "../utils/ownership";
import { toLabelKey } from "./label-key";
import {
  createFieldInput,
  type CreateFieldInputType,
  deleteFieldInput,
  type DeleteFieldInputType,
  getFieldInput,
  type GetFieldInputType,
  listFieldsInput,
  type ListFieldsInputType,
  updateFieldInput,
  type UpdateFieldInputType,
} from "./model";

const FIELD_COLUMNS = {
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
} as const;

class FormFieldService {
  //. create field
  public async createField(userId: string, payload: CreateFieldInputType) {
    const { formId, label, placeholder, description, isRequired, type, index } =
      await createFieldInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    // labelKey is write-once and never updated
    const labelKey = toLabelKey(label);
    if (!labelKey) throw new ConflictError("Label must contain at least one letter or digit");

    const inserted = await db
      .insert(formFieldsTable)
      .values({ formId, label, labelKey, placeholder, description, isRequired, type, index })
      .returning({ id: formFieldsTable.id });

    if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
      throw new Error("Insert of the field returned no rows");
    }

    return { id: inserted[0].id, labelKey };
  }

  //. update field
  public async updateField(userId: string, payload: UpdateFieldInputType) {
    const { fieldId, label, placeholder, description, isRequired, type, index } =
      await updateFieldInput.parseAsync(payload);

    await assertFieldOwnership(fieldId, userId);

    // Build only the fields that were actually provided
    const updateData: Partial<{
      label: string;
      placeholder: string;
      description: string;
      isRequired: boolean;
      type: "TEXT" | "NUMBER" | "EMAIL" | "YES_NO" | "PASSWORD";
      index: string;
    }> = {};

    if (label !== undefined) updateData.label = label;
    if (placeholder !== undefined) updateData.placeholder = placeholder;
    if (description !== undefined) updateData.description = description;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (type !== undefined) updateData.type = type;
    if (index !== undefined) updateData.index = index;

    if (Object.keys(updateData).length === 0) {
      throw new ConflictError("No fields to update");
    }

    // NOTE: labelKey is intentionally never updated — it is write-once
    const updated = await db
      .update(formFieldsTable)
      .set(updateData)
      .where(eq(formFieldsTable.id, fieldId))
      .returning({ id: formFieldsTable.id });

    if (!updated || updated.length === 0) {
      throw new Error("Update of the field returned no rows");
    }

    return { id: fieldId };
  }

  //. delete field
  public async deleteField(userId: string, payload: DeleteFieldInputType) {
    const { fieldId } = await deleteFieldInput.parseAsync(payload);

    await assertFieldOwnership(fieldId, userId);

    await db.delete(formFieldsTable).where(eq(formFieldsTable.id, fieldId));

    return { id: fieldId };
  }

  //. get field
  public async getField(userId: string, payload: GetFieldInputType) {
    const { fieldId } = await getFieldInput.parseAsync(payload);

    await assertFieldOwnership(fieldId, userId);

    const field = await db
      .select(FIELD_COLUMNS)
      .from(formFieldsTable)
      .where(eq(formFieldsTable.id, fieldId));

    if (!field || field.length === 0) throw new NotFoundError("Field does not exist");

    return field[0]!;
  }

  //. list fields of a form
  public async listFields(userId: string, payload: ListFieldsInputType) {
    const { formId } = await listFieldsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    return db
      .select(FIELD_COLUMNS)
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);
  }
}

export default FormFieldService;
