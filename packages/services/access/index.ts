import { and, asc, count, db as defaultDb, eq, isNull, type Database } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formAnswersTable } from "@repo/database/models/form-answer";
import { formEventsTable, formEventTypeEnum } from "@repo/database/models/form-event";
import { formPagesTable } from "@repo/database/models/form-page";
import { formSessionsTable } from "@repo/database/models/form-session";
import { questionsTable } from "@repo/database/models/question";

import type { QuestionKind } from "../question/model";
import {
  denormalizeAnswer,
  isEmptyAnswer,
  validateAnswer,
  type NormalizedAnswer,
} from "../utils/answer-validation";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";
import { verifyPassword } from "../utils/password";
import { issueUnlockToken, verifyUnlockToken } from "../utils/signed-token";
import {
  getPublicFormInput,
  type GetPublicFormInputType,
  getSessionInput as getSessionInputSchema,
  saveDraftInput as saveDraftInputSchema,
  startSessionInput as startSessionInputSchema,
  submitFormInput as submitFormInputSchema,
  unlockFormInput as unlockFormInputSchema,
} from "./model";
import type {
  GetPublicFormOutput,
  GetSessionInputType,
  GetSessionOutput,
  PublicForm,
  SaveDraftInputType,
  SaveDraftOutput,
  StartSessionInputType,
  StartSessionOutput,
  SubmitFormInputType,
  SubmitFormOutput,
  UnlockFormInputType,
  UnlockFormOutput,
} from "./model";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type FormSessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
type RawAnswerValue = string | number | boolean | string[] | Record<string, string> | null;

type Availability = "NOT_FOUND" | "NOT_PUBLISHED" | "EXPIRED" | "LIMIT_REACHED";

/**
 * Everything a respondent is allowed to see, and nothing else.
 *
 * The public shape deliberately omits `createdBy`, `passwordHash` and the creator's
 * identity: a respondent with the link learns the form and its questions, not who made
 * it or whether it is protected beyond the locked flag.
 */
class AccessService {
  constructor(private readonly db: Database = defaultDb) {}

  // ── Reading ──────────────────────────────────────────────────────────────────

  public async getPublicFormBySlug(payload: GetPublicFormInputType): Promise<GetPublicFormOutput> {
    const { slug, unlockToken } = await getPublicFormInput.parseAsync(payload);

    const row = await this.findFormBySlug(slug);
    if (!row) {
      return { available: false, reason: "NOT_FOUND", locked: false, form: null };
    }

    const availability = await this.checkAvailability(row.id, row.status, row.closesAt, row.maxResponses);
    if (availability) {
      return { available: false, reason: availability, locked: false, form: null };
    }

    const locked =
      row.passwordHash !== null && !verifyUnlockToken(unlockToken, row.id);

    // Until the password is supplied, the form itself is withheld.
    if (locked) {
      return { available: true, reason: null, locked: true, form: null };
    }

    return { available: true, reason: null, locked: false, form: await this.buildPublicForm(row.id) };
  }

  // ── Unlocking ────────────────────────────────────────────────────────────────

  public async unlock(payload: UnlockFormInputType): Promise<UnlockFormOutput> {
    const { slug, password } = await unlockFormInputSchema.parse(payload);

    const row = await this.findFormBySlug(slug);

    // Same response whether the form is missing or the password is wrong, so the
    // endpoint cannot be used to discover which slugs exist.
    if (!row) return { unlocked: false, message: "That password is not right" };

    if (row.passwordHash === null) {
      return { unlocked: true, unlockToken: issueUnlockToken(row.id) };
    }

    if (!(await verifyPassword(password, row.passwordHash))) {
      return { unlocked: false, message: "That password is not right" };
    }

    return { unlocked: true, unlockToken: issueUnlockToken(row.id) };
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  public async startSession(payload: StartSessionInputType): Promise<StartSessionOutput> {
    const { slug, deviceId, unlockToken, userAgent } =
      await startSessionInputSchema.parse(payload);

    const row = await this.findFormBySlug(slug);
    if (!row) throw new NotFoundError("This form is not available");

    const availability = await this.checkAvailability(row.id, row.status, row.closesAt, row.maxResponses);
    if (availability && availability !== "LIMIT_REACHED") {
      throw new ForbiddenError(availabilityMessage(availability));
    }

    if (row.passwordHash !== null && !verifyUnlockToken(unlockToken, row.id)) {
      throw new ForbiddenError("This form is password protected");
    }

    const alreadyCompleted =
      (await this.countSessions(row.id, deviceId, "COMPLETED")) > 0;

    // Resume the newest draft, if there is one.
    const drafts = await this.db
      .select()
      .from(formSessionsTable)
      .where(
        and(
          eq(formSessionsTable.formId, row.id),
          eq(formSessionsTable.deviceId, deviceId),
          eq(formSessionsTable.status, "IN_PROGRESS"),
        ),
      )
      .orderBy(asc(formSessionsTable.startedAt))
      .limit(1);

    const existing = drafts[0];

    if (existing) {
      await this.touch(existing.id);
      await this.recordEvent({
        formId: row.id,
        sessionId: existing.id,
        type: "VIEW",
        formVersion: existing.formVersion,
      });

      return {
        sessionId: existing.id,
        created: false,
        formVersion: existing.formVersion,
        alreadyCompleted,
        answers: Object.fromEntries(await this.readStoredAnswers(existing.id)),
        currentPageId: existing.currentPageId,
        currentQuestionId: existing.currentQuestionId,
      };
    }

    const inserted = await this.db
      .insert(formSessionsTable)
      .values({
        formId: row.id,
        deviceId,
        formVersion: row.version,
        status: "IN_PROGRESS",
        userAgent: userAgent ?? null,
      })
      .returning({ id: formSessionsTable.id });

    if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
      throw new Error("Insert of the session returned no rows");
    }

    const sessionId = inserted[0].id;

    await this.recordEvent({ formId: row.id, sessionId, type: "VIEW", formVersion: row.version });
    await this.recordEvent({ formId: row.id, sessionId, type: "START", formVersion: row.version });

    return {
      sessionId,
      created: true,
      formVersion: row.version,
      alreadyCompleted,
      answers: {},
      currentPageId: null,
      currentQuestionId: null,
    };
  }

  public async getSession(payload: GetSessionInputType): Promise<GetSessionOutput> {
    const { sessionId, deviceId } = await getSessionInputSchema.parse(payload);

    const session = await this.loadOwnedSession(sessionId, deviceId);

    return {
      sessionId: session.id,
      status: session.status,
      answers: Object.fromEntries(await this.readStoredAnswers(sessionId)),
      currentPageId: session.currentPageId,
      currentQuestionId: session.currentQuestionId,
    };
  }

  // ── Drafts ──────────────────────────────────────────────────────────────────

  /**
   * Save a partial set of answers. Each answer is validated here rather than at
   * submit, so a problem surfaces while the respondent is still looking at the field.
   * An empty value clears that answer instead of storing a blank.
   */
  public async saveDraft(payload: SaveDraftInputType): Promise<SaveDraftOutput> {
    const { sessionId, deviceId, answers, currentQuestionId, currentPageId } =
      await saveDraftInputSchema.parse(payload);

    const session = await this.loadOwnedSession(sessionId, deviceId);
    const questions = await this.loadQuestions(session.formId);
    const byId = new Map(questions.map((question) => [question.id, question]));

    /*
     * A completed session is finished, and this is where a real response used to be lost.
     *
     * The respondent's last step and their submit are two requests, and nothing ordered
     * them. When the draft landed second it rewrote the same rows with `isDraft: true`, so
     * a response that had been accepted — shown on the thank-you page, counted in the
     * creator's table a moment earlier — quietly stopped being a response. Ignoring the
     * write is the whole fix: there is nothing left for the respondent to correct.
     */
    if (session.status === "COMPLETED") {
      return { sessionId: session.id, savedAt: new Date().toISOString() };
    }

    const resolved: { questionId: string; kind: QuestionKind; answer: NormalizedAnswer | null }[] = [];

    for (const entry of answers) {
      const question = byId.get(entry.questionId);
      // Ignore ids from another form rather than erroring: the client's view may simply
      // be stale after a question was deleted.
      if (!question) continue;

      if (isEmptyAnswer(entry.value)) {
        resolved.push({ questionId: question.id, kind: question.kind, answer: null });
        continue;
      }

      const result = validateAnswer(question.kind, question.settings, entry.value);
      if (!result.success) {
        throw new BadRequestError(result.message, {
          details: { fieldErrors: { [question.id]: result.message } },
        });
      }

      resolved.push({ questionId: question.id, kind: question.kind, answer: result.answer });
    }

    await this.db.transaction(async (tx) => {
      for (const entry of resolved) {
        await this.writeAnswer(tx, {
          sessionId,
          formId: session.formId,
          questionId: entry.questionId,
          kind: entry.kind,
          answer: entry.answer,
          isDraft: true,
        });
      }

      await tx
        .update(formSessionsTable)
        .set({
          lastSeenAt: new Date(),
          ...(currentQuestionId !== undefined ? { currentQuestionId } : {}),
          ...(currentPageId !== undefined ? { currentPageId } : {}),
        })
        .where(eq(formSessionsTable.id, sessionId));
    });

    /*
     * View events are recorded here rather than through a client-called endpoint.
     *
     * `getQuestionDropOff` reads `QUESTION_VIEW` rows and nothing else had been writing
     * them, so per-question drop-off could never have had data. A draft save already
     * carries the respondent's position and the session already stores the old one, so
     * this is the one place a genuine move is observable — and gating on an actual change
     * means a respondent hammering "back" cannot inflate the funnel.
     *
     * The first `VIEW` is deliberately not here: it is emitted by `startSession`, before
     * anything else, which is what time-to-complete is measured from.
     */
    const movedToPage = currentPageId !== undefined && currentPageId !== session.currentPageId;
    const movedToQuestion =
      currentQuestionId !== undefined && currentQuestionId !== session.currentQuestionId;

    if (movedToPage && currentPageId) {
      await this.recordEvent({
        formId: session.formId,
        sessionId,
        type: "PAGE_VIEW",
        pageId: currentPageId,
        questionId: currentQuestionId ?? null,
        formVersion: session.formVersion,
      });
    }

    if (movedToQuestion && currentQuestionId) {
      await this.recordEvent({
        formId: session.formId,
        sessionId,
        type: "QUESTION_VIEW",
        questionId: currentQuestionId,
        pageId: currentPageId ?? session.currentPageId ?? null,
        formVersion: session.formVersion,
      });
    }

    return { sessionId, savedAt: new Date().toISOString() };
  }

  // ── Submitting ───────────────────────────────────────────────────────────────

  /**
   * Validate and freeze a response.
   *
   * Returns a discriminated status rather than throwing, because "the form closed while
   * you were filling it" and "this field needs attention" are both ordinary outcomes
   * the renderer has to draw, not errors.
   */
  public async submit(payload: SubmitFormInputType): Promise<SubmitFormOutput> {
    const { sessionId, deviceId, answers, allowResubmit } =
      await submitFormInputSchema.parse(payload);

    const session = await this.loadOwnedSession(sessionId, deviceId);

    if (session.status === "COMPLETED" && !allowResubmit) {
      return { status: "ALREADY_SUBMITTED" };
    }

    const form = await this.findFormById(session.formId);
    if (!form) throw new NotFoundError("This form is not available");

    const availability = await this.checkAvailability(
      form.id,
      form.status,
      form.closesAt,
      form.maxResponses,
    );
    if (availability === "NOT_FOUND") throw new NotFoundError("This form is not available");
    if (availability) {
      return { status: availability };
    }

    const questions = await this.loadQuestions(form.id);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const stored = await this.readStoredAnswers(sessionId);

    // Start from the saved draft, then apply whatever the client just sent.
    const final = new Map<string, RawAnswerValue | unknown>();
    for (const [questionId, answer] of stored) final.set(questionId, answer);
    for (const entry of answers ?? []) {
      if (!byId.has(entry.questionId)) continue;
      final.set(entry.questionId, entry.value);
    }

    const fieldErrors: Record<string, string> = {};
    const resolved: {
      questionId: string;
      kind: QuestionKind;
      answer: NormalizedAnswer | null;
    }[] = [];

    for (const question of questions) {
      const raw = final.get(question.id) ?? null;

      if (isEmptyAnswer(raw)) {
        if (question.isRequired) {
          fieldErrors[question.id] = "This question needs an answer";
        }
        resolved.push({ questionId: question.id, kind: question.kind, answer: null });
        continue;
      }

      const result = validateAnswer(question.kind, question.settings, raw);
      if (!result.success) {
        fieldErrors[question.id] = result.message;
        resolved.push({ questionId: question.id, kind: question.kind, answer: null });
        continue;
      }

      resolved.push({ questionId: question.id, kind: question.kind, answer: result.answer });
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { status: "INVALID", fieldErrors };
    }

    await this.db.transaction(async (tx) => {
      for (const entry of resolved) {
        await this.writeAnswer(tx, {
          sessionId,
          formId: form.id,
          questionId: entry.questionId,
          kind: entry.kind,
          answer: entry.answer,
          isDraft: false,
        });
      }

      await tx
        .update(formSessionsTable)
        .set({ status: "COMPLETED", completedAt: new Date(), lastSeenAt: new Date() })
        .where(eq(formSessionsTable.id, sessionId));

      await tx.insert(formEventsTable).values({
        formId: form.id,
        sessionId,
        type: "SUBMIT",
        formVersion: session.formVersion,
      });
    });

    return { status: "SUBMITTED" };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async findFormBySlug(slug: string) {
    const rows = await this.db
      .select({
        id: formsTable.id,
        status: formsTable.status,
        version: formsTable.version,
        passwordHash: formsTable.passwordHash,
        closesAt: formsTable.closesAt,
        maxResponses: formsTable.maxResponses,
      })
      .from(formsTable)
      .where(eq(formsTable.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  }

  private async findFormById(formId: string) {
    const rows = await this.db
      .select({
        id: formsTable.id,
        status: formsTable.status,
        version: formsTable.version,
        passwordHash: formsTable.passwordHash,
        closesAt: formsTable.closesAt,
        maxResponses: formsTable.maxResponses,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    return rows[0] ?? null;
  }

  private async checkAvailability(
    formId: string,
    status: string,
    closesAt: Date | null,
    maxResponses: number | null,
  ): Promise<Availability | null> {
    if (status !== "PUBLISHED") return "NOT_PUBLISHED";
    if (closesAt && closesAt.getTime() < Date.now()) return "EXPIRED";
    if (maxResponses !== null && (await this.countCompleted(formId)) >= maxResponses) {
      return "LIMIT_REACHED";
    }
    return null;
  }

  private async countCompleted(formId: string): Promise<number> {
    const rows = await this.db
      .select({ total: count() })
      .from(formSessionsTable)
      .where(
        and(eq(formSessionsTable.formId, formId), eq(formSessionsTable.status, "COMPLETED")),
      );
    return rows[0]?.total ?? 0;
  }

  private async countSessions(
    formId: string,
    deviceId: string,
    status: FormSessionStatus,
  ): Promise<number> {
    const rows = await this.db
      .select({ total: count() })
      .from(formSessionsTable)
      .where(
        and(
          eq(formSessionsTable.formId, formId),
          eq(formSessionsTable.deviceId, deviceId),
          eq(formSessionsTable.status, status),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /** The form as a respondent may see it. Never includes the creator or the password. */
  private async buildPublicForm(formId: string): Promise<PublicForm> {
    const [form, pages, questions] = await Promise.all([
      this.db
        .select({
          slug: formsTable.slug,
          title: formsTable.title,
          description: formsTable.description,
          layoutMode: formsTable.layoutMode,
          themeKey: formsTable.themeKey,
          showProgress: formsTable.showProgress,
          allowBack: formsTable.allowBack,
          version: formsTable.version,
          thankYouTitle: formsTable.thankYouTitle,
          thankYouMessage: formsTable.thankYouMessage,
          thankYouRedirectUrl: formsTable.thankYouRedirectUrl,
        })
        .from(formsTable)
        .where(eq(formsTable.id, formId))
        .limit(1)
        .then((rows) => rows[0]!),
      this.db
        .select({ id: formPagesTable.id, title: formPagesTable.title, description: formPagesTable.description })
        .from(formPagesTable)
        .where(eq(formPagesTable.formId, formId))
        .orderBy(asc(formPagesTable.position)),
      this.loadQuestions(formId),
    ]);

    return {
      slug: form.slug,
      title: form.title,
      description: form.description,
      layoutMode: form.layoutMode,
      themeKey: form.themeKey,
      showProgress: form.showProgress,
      allowBack: form.allowBack,
      version: form.version,
      thankYouTitle: form.thankYouTitle,
      thankYouMessage: form.thankYouMessage,
      thankYouRedirectUrl: form.thankYouRedirectUrl,
      pages: pages.map((page) => ({
        id: page.id,
        title: page.title,
        description: page.description,
      })),
      questions: questions.map((question) => ({
        id: question.id,
        // Carried so the renderer can group a `PAGED` form. Without it the public shape
        // is a flat, ordered list and the respondent sees every question on one page.
        pageId: question.pageId,
        kind: question.kind,
        label: question.label,
        labelKey: question.labelKey,
        description: question.description,
        placeholder: question.placeholder,
        isRequired: question.isRequired,
        settings: question.settings,
      })),
    };
  }

  private async loadQuestions(formId: string) {
    return this.db
      .select({
        id: questionsTable.id,
        pageId: questionsTable.pageId,
        kind: questionsTable.kind,
        label: questionsTable.label,
        labelKey: questionsTable.labelKey,
        description: questionsTable.description,
        placeholder: questionsTable.placeholder,
        isRequired: questionsTable.isRequired,
        settings: questionsTable.settings,
      })
      .from(questionsTable)
      .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
      .orderBy(asc(questionsTable.position));
  }

  /** A session the caller actually owns — the device id is the only proof we hold. */
  private async loadOwnedSession(sessionId: string, deviceId: string) {
    const rows = await this.db
      .select()
      .from(formSessionsTable)
      .where(eq(formSessionsTable.id, sessionId))
      .limit(1);

    const session = rows[0];
    if (!session) throw new NotFoundError("Session not found");
    if (session.deviceId !== deviceId) {
      throw new ForbiddenError("This session belongs to another device");
    }

    return session;
  }

  /**
   * Client-shaped draft answers for a session, keyed by question id. The kind is read
   * from , which was copied in when the answer was written
   * and survives the question being deleted.
   */
  private async readStoredAnswers(sessionId: string): Promise<Map<string, RawAnswerValue>> {
    const rows = await this.db
      .select({
        questionId: formAnswersTable.questionId,
        questionKind: formAnswersTable.questionKind,
        valueText: formAnswersTable.valueText,
        valueNumber: formAnswersTable.valueNumber,
        valueDate: formAnswersTable.valueDate,
        valueJson: formAnswersTable.valueJson,
      })
      .from(formAnswersTable)
      .where(
        and(eq(formAnswersTable.sessionId, sessionId), eq(formAnswersTable.isDraft, true)),
      );

    const answers = new Map<string, RawAnswerValue>();
    for (const row of rows) {
      if (row.questionKind === null) continue;
      answers.set(
        row.questionId,
        denormalizeAnswer({
          kind: row.questionKind as QuestionKind,
          valueText: row.valueText,
          valueNumber: row.valueNumber,
          valueDate: row.valueDate,
          valueJson: row.valueJson,
        }) as RawAnswerValue,
      );
    }

    return answers;
  }

  /**
   * Upsert one answer, or delete it when the value is empty. The question's label and
   * kind are copied in, so exports keep working after the question is renamed.
   */
  private async writeAnswer(
    tx: Tx,
    entry: {
      sessionId: string;
      formId: string;
      questionId: string;
      kind: QuestionKind;
      answer: NormalizedAnswer | null;
      isDraft: boolean;
    },
  ): Promise<void> {
    if (entry.answer === null) {
      await tx
        .delete(formAnswersTable)
        .where(
          and(
            eq(formAnswersTable.sessionId, entry.sessionId),
            eq(formAnswersTable.questionId, entry.questionId),
          ),
        );
      return;
    }

    const question = await tx
      .select({ label: questionsTable.label, labelKey: questionsTable.labelKey })
      .from(questionsTable)
      .where(eq(questionsTable.id, entry.questionId))
      .limit(1)
      .then((rows) => rows[0]);

    await tx
      .insert(formAnswersTable)
      .values({
        sessionId: entry.sessionId,
        formId: entry.formId,
        questionId: entry.questionId,
        ...entry.answer,
        questionLabel: question?.label ?? null,
        questionLabelKey: question?.labelKey ?? null,
        questionKind: entry.kind,
        isDraft: entry.isDraft,
      })
      .onConflictDoUpdate({
        target: [formAnswersTable.sessionId, formAnswersTable.questionId],
        set: {
          ...entry.answer,
          questionLabel: question?.label ?? null,
          questionLabelKey: question?.labelKey ?? null,
          questionKind: entry.kind,
          isDraft: entry.isDraft,
        },
      });
  }

  private async touch(sessionId: string): Promise<void> {
    await this.db
      .update(formSessionsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(formSessionsTable.id, sessionId));
  }

  private async recordEvent(entry: {
    formId: string;
    sessionId?: string | null;
    type: (typeof formEventTypeEnum.enumValues)[number];
    questionId?: string | null;
    pageId?: string | null;
    formVersion?: number | null;
  }): Promise<void> {
    await this.db.insert(formEventsTable).values({
      formId: entry.formId,
      sessionId: entry.sessionId ?? null,
      type: entry.type,
      questionId: entry.questionId ?? null,
      pageId: entry.pageId ?? null,
      formVersion: entry.formVersion ?? null,
    });
  }
}

function availabilityMessage(availability: Availability): string {
  switch (availability) {
    case "NOT_PUBLISHED":
      return "This form is not open yet";
    case "EXPIRED":
      return "This form has closed";
    case "LIMIT_REACHED":
      return "This form has reached its response limit";
    case "NOT_FOUND":
      return "This form is not available";
  }
}


export { availabilityMessage };
export default AccessService;
