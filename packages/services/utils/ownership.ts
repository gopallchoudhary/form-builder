import { db, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";

import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Ownership is enforced here, inside the service layer, rather than in tRPC
 * middleware. Every mutating/reading method below takes a `userId` as a
 * *required* argument, so forgetting to pass it is a compile error — a runtime
 * middleware can be bypassed by simply not using it.
 */

/** Throws unless `userId` created `formId`. Returns the row so callers can reuse it. */
export async function assertFormOwnership(formId: string, userId: string) {
  const rows = await db
    .select({ id: formsTable.id, createdBy: formsTable.createdBy })
    .from(formsTable)
    .where(eq(formsTable.id, formId))
    .limit(1);

  const form = rows[0];
  if (!form) throw new NotFoundError("Form does not exist");
  if (form.createdBy !== userId) {
    throw new ForbiddenError("You do not have access to this form");
  }

  return form;
}

/** Throws unless `userId` created the form that owns `fieldId`. */
export async function assertFieldOwnership(fieldId: string, userId: string) {
  const rows = await db
    .select({ id: formFieldsTable.id, createdBy: formsTable.createdBy })
    .from(formFieldsTable)
    .innerJoin(formsTable, eq(formFieldsTable.formId, formsTable.id))
    .where(eq(formFieldsTable.id, fieldId))
    .limit(1);

  const field = rows[0];
  if (!field) throw new NotFoundError("Field does not exist");
  if (field.createdBy !== userId) {
    throw new ForbiddenError("You do not have access to this field");
  }

  return field;
}
