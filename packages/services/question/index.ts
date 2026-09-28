import { and, db, eq, isNull } from "@repo/database";
import { questionsTable } from "@repo/database/models/question";

import { ConflictError, NotFoundError } from "../utils/errors";
import { assertFieldOwnership, assertFormOwnership } from "../utils/ownership";
import { toLabelKey } from "./label-key";
import {
  createQuestionInput,
  type CreateQuestionInputType,
  deleteQuestionInput,
  type DeleteQuestionInputType,
  getQuestionInput,
  type GetQuestionInputType,
  listQuestionsInput,
  type ListQuestionsInputType,
  updateQuestionInput,
  type UpdateQuestionInputType,
} from "./model";

const QUESTION_COLUMNS = {
  id: questionsTable.id,
  formId: questionsTable.formId,
  pageId: questionsTable.pageId,
  position: questionsTable.position,
  kind: questionsTable.kind,
  label: questionsTable.label,
  labelKey: questionsTable.labelKey,
  description: questionsTable.description,
  placeholder: questionsTable.placeholder,
  isRequired: questionsTable.isRequired,
  settings: questionsTable.settings,
  createdAt: questionsTable.createdAt,
  updatedAt: questionsTable.updatedAt,
} as const;

/** Only questions that have not been soft-deleted. */
const isLive = isNull(questionsTable.deletedAt);

class QuestionService {
  //. create a question
  public async createQuestion(userId: string, payload: CreateQuestionInputType) {
    const { formId, pageId, position, kind, label, placeholder, description, isRequired } =
      await createQuestionInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    // labelKey is write-once and never updated
    const labelKey = toLabelKey(label);
    if (!labelKey) throw new ConflictError("Label must contain at least one letter or digit");

    const inserted = await db
      .insert(questionsTable)
      .values({ formId, pageId: pageId ?? null, position, kind, label, labelKey, placeholder, description, isRequired })
      .returning({ id: questionsTable.id });

    if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
      throw new Error("Insert of the question returned no rows");
    }

    return { id: inserted[0].id, labelKey };
  }

  //. update a question
  public async updateQuestion(userId: string, payload: UpdateQuestionInputType) {
    const { questionId, label, placeholder, description, isRequired, kind, position, pageId } =
      await updateQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId);

    // Build only the fields that were actually provided
    const updateData: Partial<{
      label: string;
      placeholder: string;
      description: string;
      isRequired: boolean;
      kind: CreateQuestionInputType["kind"];
      position: string;
      pageId: string | null;
    }> = {};

    if (label !== undefined) updateData.label = label;
    if (placeholder !== undefined) updateData.placeholder = placeholder;
    if (description !== undefined) updateData.description = description;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (kind !== undefined) updateData.kind = kind;
    if (position !== undefined) updateData.position = position;
    if (pageId !== undefined) updateData.pageId = pageId;

    if (Object.keys(updateData).length === 0) {
      throw new ConflictError("No fields to update");
    }

    // NOTE: labelKey is intentionally never updated — it is write-once, so existing
    // responses keep resolving to the same key after a reword.
    const updated = await db
      .update(questionsTable)
      .set(updateData)
      .where(and(eq(questionsTable.id, questionId), isLive))
      .returning({ id: questionsTable.id });

    if (!updated || updated.length === 0) {
      throw new NotFoundError("Question does not exist");
    }

    return { id: questionId };
  }

  //. soft-delete a question
  //
  // Hard-deleting would cascade into `form_answers` (the FK is ON DELETE restrict),
  // destroying the record of what respondents were actually asked. Soft delete keeps
  // exports and analytics intact and frees the position and labelKey for reuse.
  public async deleteQuestion(userId: string, payload: DeleteQuestionInputType) {
    const { questionId } = await deleteQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId);

    const deleted = await db
      .update(questionsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(questionsTable.id, questionId), isLive))
      .returning({ id: questionsTable.id });

    if (!deleted || deleted.length === 0) {
      throw new NotFoundError("Question does not exist");
    }

    return { id: questionId };
  }

  //. get a question
  public async getQuestion(userId: string, payload: GetQuestionInputType) {
    const { questionId } = await getQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId);

    const rows = await db
      .select(QUESTION_COLUMNS)
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), isLive));

    if (!rows || rows.length === 0) throw new NotFoundError("Question does not exist");

    return rows[0]!;
  }

  //. list the questions of a form, in order
  public async listQuestions(userId: string, payload: ListQuestionsInputType) {
    const { formId } = await listQuestionsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    return db
      .select(QUESTION_COLUMNS)
      .from(questionsTable)
      .where(and(eq(questionsTable.formId, formId), isLive))
      .orderBy(questionsTable.position);
  }
}

export default QuestionService;
