import { and, asc, db as defaultDb, eq, isNull, type Database } from "@repo/database";
import { questionsTable } from "@repo/database/models/question";

import { findDriverError, isUniqueViolation } from "../utils/db-errors";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors";
import { assertFieldOwnership, assertFormOwnership, assertPageOwnership } from "../utils/ownership";
import {
  positionBetween,
  positionForIndex,
  PositionExhaustedError,
  renumberInOrder,
  sequentialPositions,
} from "../utils/ordering";
import { toLabelKey } from "./label-key";
import {
  createQuestionInput,
  type CreateQuestionInputType,
  deleteQuestionInput,
  type DeleteQuestionInputType,
  duplicateQuestionInput,
  type DuplicateQuestionInputType,
  getQuestionInput,
  type GetQuestionInputType,
  listQuestionsInput,
  type ListQuestionsInputType,
  reorderQuestionsInput,
  type ReorderQuestionsInputType,
  updateQuestionInput,
  type UpdateQuestionInputType,
} from "./model";
import { defaultSettingsFor, parseSettingsFor, SettingsError } from "./settings";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

/**
 * Turns a unique-index violation into something the builder can show.
 *
 * Without this a duplicate label surfaces as a raw Postgres error, which the API turns
 * into an opaque 500 — leaving the creator no idea they had already used that label.
 */
function mapQuestionConstraintError(error: unknown): unknown {
  if (!isUniqueViolation(error)) return error;

  if (findDriverError(error)?.constraint?.includes("label_key")) {
    return new ConflictError("This form already has a question with that label");
  }
  if (findDriverError(error)?.constraint?.includes("position")) {
    return new ConflictError("Another question already sits at that position");
  }

  return new ConflictError("That question clashes with one already in this form");
}

class QuestionService {
  constructor(private readonly db: Database = defaultDb) {}

  //. create a question
  public async createQuestion(userId: string, payload: CreateQuestionInputType) {
    const {
      formId,
      pageId,
      position,
      kind,
      label,
      placeholder,
      description,
      isRequired,
      settings,
    } = await createQuestionInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);
    if (pageId) await assertPageOwnership(pageId, userId, this.db);

    const parsedSettings = this.resolveSettings(kind, settings);
    const labelKey = this.resolveLabelKey(label);

    return this.db.transaction(async (tx) => {
      const resolved = position ?? (await this.appendPosition(tx, formId, pageId ?? null));

      try {
        const inserted = await tx
          .insert(questionsTable)
          .values({
            formId,
            pageId: pageId ?? null,
            position: resolved,
            kind,
            label,
            labelKey,
            placeholder: placeholder ?? null,
            description: description ?? null,
            isRequired,
            settings: parsedSettings,
          })
          .returning({ id: questionsTable.id });

        if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
          throw new Error("Insert of the question returned no rows");
        }

        return { id: inserted[0].id, labelKey, position: resolved };
      } catch (error) {
        throw mapQuestionConstraintError(error);
      }
    });
  }

  //. update a question
  public async updateQuestion(userId: string, payload: UpdateQuestionInputType) {
    const {
      questionId,
      label,
      placeholder,
      description,
      isRequired,
      kind,
      position,
      pageId,
      settings,
    } = await updateQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId, this.db);

    const existing = await this.getRow(questionId);
    if (!existing) throw new NotFoundError("Question does not exist");

    if (pageId) await assertPageOwnership(pageId, userId, this.db);

    // Changing the kind changes what the settings mean, so they are re-validated
    // against the *new* kind rather than carried over blindly.
    const nextKind = kind ?? existing.kind;
    const nextSettings =
      settings === undefined && kind === undefined
        ? undefined
        : this.resolveSettings(nextKind, settings ?? existing.settings);

    const updateData: Partial<{
      label: string;
      placeholder: string | null;
      description: string | null;
      isRequired: boolean;
      kind: CreateQuestionInputType["kind"];
      position: string;
      pageId: string | null;
      settings: unknown;
    }> = {};

    if (label !== undefined) updateData.label = label;
    if (placeholder !== undefined) updateData.placeholder = placeholder;
    if (description !== undefined) updateData.description = description;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (kind !== undefined) updateData.kind = kind;
    if (position !== undefined) updateData.position = position;
    if (pageId !== undefined) updateData.pageId = pageId;
    if (nextSettings !== undefined) updateData.settings = nextSettings;

    if (Object.keys(updateData).length === 0) {
      throw new ConflictError("No fields to update");
    }

    // NOTE: labelKey is intentionally never updated — it is write-once, so existing
    // responses keep resolving to the same key after a reword.
    const updated = await this.db
      .update(questionsTable)
      .set(updateData)
      .where(and(eq(questionsTable.id, questionId), isLive))
      .returning({ id: questionsTable.id });

    if (!updated || updated.length === 0) throw new NotFoundError("Question does not exist");

    return { id: questionId };
  }

  //. soft-delete a question
  //
  // Hard-deleting would be blocked by the `restrict` foreign key from `form_answers`,
  // which is the point: it protects the record of what respondents were asked.
  public async deleteQuestion(userId: string, payload: DeleteQuestionInputType) {
    const { questionId } = await deleteQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId, this.db);

    const deleted = await this.db
      .update(questionsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(questionsTable.id, questionId), isLive))
      .returning({ id: questionsTable.id });

    if (!deleted || deleted.length === 0) throw new NotFoundError("Question does not exist");

    return { id: questionId };
  }

  //. get a question
  public async getQuestion(userId: string, payload: GetQuestionInputType) {
    const { questionId } = await getQuestionInput.parseAsync(payload);

    const rows = await this.db
      .select(QUESTION_COLUMNS)
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), isLive))
      .limit(1);

    const question = rows[0];
    if (!question) throw new NotFoundError("Question does not exist");

    await assertFieldOwnership(questionId, userId, this.db);

    return question;
  }

  //. list a form's questions, in order
  public async listQuestions(userId: string, payload: ListQuestionsInputType) {
    const { formId, pageId } = await listQuestionsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);
    if (pageId) await assertPageOwnership(pageId, userId, this.db);

    const scope = pageId
      ? and(eq(questionsTable.formId, formId), eq(questionsTable.pageId, pageId), isLive)
      : and(eq(questionsTable.formId, formId), isLive);

    return this.db
      .select(QUESTION_COLUMNS)
      .from(questionsTable)
      .where(scope)
      .orderBy(asc(questionsTable.position));
  }

  //. set the complete question order for a page, or for a STEP-layout form
  public async reorderQuestions(userId: string, payload: ReorderQuestionsInputType) {
    const { formId, pageId, orderedQuestionIds } = await reorderQuestionsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);
    if (pageId) await assertPageOwnership(pageId, userId, this.db);

    const scope = pageId
      ? and(eq(questionsTable.formId, formId), eq(questionsTable.pageId, pageId), isLive)
      : and(eq(questionsTable.formId, formId), isNull(questionsTable.pageId), isLive);

    const existing = await this.db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(scope);

    const existingIds = new Set(existing.map((question) => question.id));
    if (
      orderedQuestionIds.length !== existing.length ||
      new Set(orderedQuestionIds).size !== orderedQuestionIds.length ||
      orderedQuestionIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestError(
        "orderedQuestionIds must list every question in scope exactly once",
      );
    }

    return this.db.transaction(async (tx) => {
      await renumberInOrder(orderedQuestionIds, async (questionId, position) => {
        await tx
          .update(questionsTable)
          .set({ position })
          .where(eq(questionsTable.id, questionId));
      });

      return { orderedQuestionIds };
    });
  }

  //. copy a question, placing the copy at the end of the same page
  public async duplicateQuestion(userId: string, payload: DuplicateQuestionInputType) {
    const { questionId, label } = await duplicateQuestionInput.parseAsync(payload);

    await assertFieldOwnership(questionId, userId, this.db);

    const full = await this.db
      .select(QUESTION_COLUMNS)
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), isLive))
      .limit(1)
      .then((rows) => rows[0]!);

    // labelKey is unique per form among live questions, so the copy needs a new label
    // to get one. Default to the original label with a "copy" suffix.
    const nextLabel = label ?? this.withCopySuffix(full.label);
    const labelKey = this.resolveLabelKey(nextLabel);

    return this.db.transaction(async (tx) => {
      const position = await this.appendPosition(tx, full.formId, full.pageId);

      try {
        const inserted = await tx
          .insert(questionsTable)
          .values({
            formId: full.formId,
            pageId: full.pageId,
            position,
            kind: full.kind,
            label: nextLabel,
            labelKey,
            placeholder: full.placeholder,
            description: full.description,
            isRequired: full.isRequired,
            settings: full.settings,
          })
          .returning({ id: questionsTable.id });

        if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
          throw new Error("Insert of the question copy returned no rows");
        }

        return { id: inserted[0].id, labelKey, position };
      } catch (error) {
        throw mapQuestionConstraintError(error);
      }
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** A live question row, or null. Used to read the current kind/settings. */
  private async getRow(questionId: string) {
    const rows = await this.db
      .select({ id: questionsTable.id, kind: questionsTable.kind, settings: questionsTable.settings })
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), isLive))
      .limit(1);

    return rows[0] ?? null;
  }

  private resolveSettings(kind: CreateQuestionInputType["kind"], settings: unknown): unknown {
    try {
      return parseSettingsFor(kind, settings ?? defaultSettingsFor(kind));
    } catch (error) {
      if (error instanceof SettingsError) {
        throw new BadRequestError(error.message, { details: { issues: error.issues } });
      }
      throw error;
    }
  }

  private resolveLabelKey(label: string): string {
    const labelKey = toLabelKey(label);
    if (!labelKey) throw new BadRequestError("Label must contain at least one letter or digit");
    return labelKey;
  }

  private withCopySuffix(label: string): string {
    const suffix = " (copy)";
    return `${label.slice(0, 200 - suffix.length)}${suffix}`;
  }

  /** The position one past the last question in scope, renumbering if the gap is full. */
  private async appendPosition(tx: Tx, formId: string, pageId: string | null): Promise<string> {
    const scope = pageId
      ? and(eq(questionsTable.formId, formId), eq(questionsTable.pageId, pageId), isLive)
      : and(eq(questionsTable.formId, formId), isNull(questionsTable.pageId), isLive);

    const existing = await tx
      .select({ id: questionsTable.id, position: questionsTable.position })
      .from(questionsTable)
      .where(scope)
      .orderBy(asc(questionsTable.position));

    if (existing.length === 0) return positionForIndex(0);

    try {
      return positionBetween(existing[existing.length - 1]!.position, null);
    } catch (error) {
      if (!(error instanceof PositionExhaustedError)) throw error;
      return this.renumberAndTakeLast(tx, existing);
    }
  }

  private async renumberAndTakeLast(
    tx: Tx,
    questions: { id: string; position: string }[],
  ): Promise<string> {
    const positions = sequentialPositions(questions.length + 1);

    await renumberInOrder(
      questions.map((question) => question.id),
      async (questionId, position) => {
        await tx
          .update(questionsTable)
          .set({ position })
          .where(eq(questionsTable.id, questionId));
      },
    );

    return positions[positions.length - 1]!;
  }
}

export default QuestionService;
