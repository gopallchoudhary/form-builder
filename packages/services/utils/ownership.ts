import { db, eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { questionsTable } from "@repo/database/models/question";

import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Ownership is enforced here, inside the service layer, rather than in tRPC
 * middleware. Every method that touches a form takes a `userId` as a *required*
 * argument, so forgetting to pass it is a compile error — a runtime middleware can
 * be bypassed by simply not using it.
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

/**
 * Throws unless `userId` created the form that owns `questionId`.
 *
 * Questions that are soft-deleted are deliberately not excluded here: a caller
 * must be able to distinguish "does not exist" from "not yours", and ownership of a
 * deleted question still matters to whoever owned it.
 */
export async function assertFieldOwnership(questionId: string, userId: string) {
  const rows = await db
    .select({ id: questionsTable.id, createdBy: formsTable.createdBy })
    .from(questionsTable)
    .innerJoin(formsTable, eq(questionsTable.formId, formsTable.id))
    .where(eq(questionsTable.id, questionId))
    .limit(1);

  const question = rows[0];
  if (!question) throw new NotFoundError("Question does not exist");
  if (question.createdBy !== userId) {
    throw new ForbiddenError("You do not have access to this question");
  }

  return question;
}
