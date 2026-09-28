import { and, asc, count, db as defaultDb, desc, eq, isNull, sql, type Database } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formPagesTable } from "@repo/database/models/form-page";
import { formSessionsTable } from "@repo/database/models/form-session";
import { questionsTable } from "@repo/database/models/question";

import { isUniqueViolation } from "../utils/db-errors";
import { ConflictError, NotFoundError } from "../utils/errors";
import { assertFormOwnership } from "../utils/ownership";
import { hashPassword } from "../utils/password";
import { generateSlug, slugify } from "../utils/slug";
import type { QuestionKind } from "../question/model";
import { parseSettingsFor } from "../question/settings";
import {
  createFormInput,
  type CreateFormInputType,
  deleteFormInput,
  type DeleteFormInputType,
  type FormDefinition,
  getFormInput,
  type GetFormInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
  setFormPasswordInput,
  type SetFormPasswordInputType,
  setFormStatusInput,
  type SetFormStatusInputType,
  updateFormSettingsInput,
  type UpdateFormSettingsInputType,
  updateFormSlugInput,
  type UpdateFormSlugInputType,
} from "./model";

/** How many times to retry a colliding slug before giving up. */
const SLUG_ATTEMPTS = 5;

const FORM_COLUMNS = {
  id: formsTable.id,
  slug: formsTable.slug,
  title: formsTable.title,
  description: formsTable.description,
  layoutMode: formsTable.layoutMode,
  themeKey: formsTable.themeKey,
  status: formsTable.status,
  showProgress: formsTable.showProgress,
  allowBack: formsTable.allowBack,
  oneResponsePerDevice: formsTable.oneResponsePerDevice,
  maxResponses: formsTable.maxResponses,
  closesAt: formsTable.closesAt,
  thankYouTitle: formsTable.thankYouTitle,
  thankYouMessage: formsTable.thankYouMessage,
  thankYouRedirectUrl: formsTable.thankYouRedirectUrl,
  version: formsTable.version,
  publishedAt: formsTable.publishedAt,
  createdAt: formsTable.createdAt,
  updatedAt: formsTable.updatedAt,
} as const;

const QUESTION_COLUMNS = {
  id: questionsTable.id,
  pageId: questionsTable.pageId,
  position: questionsTable.position,
  kind: questionsTable.kind,
  label: questionsTable.label,
  labelKey: questionsTable.labelKey,
  description: questionsTable.description,
  placeholder: questionsTable.placeholder,
  isRequired: questionsTable.isRequired,
  settings: questionsTable.settings,
} as const;

const PAGE_COLUMNS = {
  id: formPagesTable.id,
  title: formPagesTable.title,
  description: formPagesTable.description,
  position: formPagesTable.position,
} as const;

class FormService {
  constructor(private readonly db: Database = defaultDb) {}

  //. create form
  public async createForm(userId: string, payload: CreateFormInputType) {
    const { title, description } = await createFormInput.parseAsync(payload);

    // `forms.slug` is globally unique because it is the public share URL, so retry on
    // the (very unlikely) collision rather than surfacing a raw constraint error.
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = generateSlug(title);
      try {
        const inserted = await this.db
          .insert(formsTable)
          .values({ title, description, createdBy: userId, slug })
          .returning({ id: formsTable.id });

        if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
          throw new Error("Insert of the form returned no rows");
        }

        return { id: inserted[0].id, slug };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === SLUG_ATTEMPTS - 1) throw error;
      }
    }

    throw new ConflictError("Could not allocate a unique link for this form");
  }

  //. list forms by user id
  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    return this.db
      .select({
        id: formsTable.id,
        slug: formsTable.slug,
        title: formsTable.title,
        description: formsTable.description,
        status: formsTable.status,
        createdAt: formsTable.createdAt,
        updatedAt: formsTable.updatedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId))
      .orderBy(desc(formsTable.createdAt));
  }

  //. get a form's settings row, checking ownership
  public async getFormById(userId: string, formId: string) {
    await assertFormOwnership(formId, userId, this.db);

    // `passwordProtected` is derived rather than selected: the hash itself never leaves
    // the database, but the builder still has to be able to say whether one is set.
    const rows = await this.db
      .select({
        ...FORM_COLUMNS,
        passwordProtected: sql<boolean>`${formsTable.passwordHash} is not null`,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    const form = rows[0];
    if (!form) throw new NotFoundError("Form does not exist");

    return form;
  }

  /**
   * The whole editable form: settings, pages and live questions. The builder store
   * hydrates from exactly this, and the respondent renderer consumes the same shape.
   */
  public async getFullDefinition(
    userId: string,
    payload: GetFormInputType,
  ): Promise<FormDefinition> {
    const { formId } = await getFormInput.parseAsync(payload);

    // Ownership first, so an unauthorised caller learns nothing about the shape.
    await assertFormOwnership(formId, userId, this.db);

    const [form, pages, questions] = await Promise.all([
      this.db
        .select(FORM_COLUMNS)
        .from(formsTable)
        .where(eq(formsTable.id, formId))
        .limit(1)
        .then((rows) => rows[0]!),
      this.db
        .select(PAGE_COLUMNS)
        .from(formPagesTable)
        .where(eq(formPagesTable.formId, formId))
        .orderBy(asc(formPagesTable.position)),
      this.db
        .select(QUESTION_COLUMNS)
        .from(questionsTable)
        .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
        .orderBy(asc(questionsTable.position)),
    ]);

    return {
      ...form,
      pages: pages.map((page) => ({
        id: page.id,
        title: page.title,
        description: page.description,
        position: String(page.position),
      })),
      questions: questions.map((question) => ({
        id: question.id,
        pageId: question.pageId,
        position: String(question.position),
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

  //. update form settings
  public async updateSettings(userId: string, payload: UpdateFormSettingsInputType) {
    const {
      formId,
      title,
      description,
      layoutMode,
      themeKey,
      showProgress,
      allowBack,
      oneResponsePerDevice,
      maxResponses,
      closesAt,
      thankYouTitle,
      thankYouMessage,
      thankYouRedirectUrl,
    } = await updateFormSettingsInput.parseAsync(payload);

    await this.getFormById(userId, formId);

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (layoutMode !== undefined) updateData.layoutMode = layoutMode;
    if (themeKey !== undefined) updateData.themeKey = themeKey;
    if (showProgress !== undefined) updateData.showProgress = showProgress;
    if (allowBack !== undefined) updateData.allowBack = allowBack;
    if (oneResponsePerDevice !== undefined) updateData.oneResponsePerDevice = oneResponsePerDevice;
    if (maxResponses !== undefined) updateData.maxResponses = maxResponses;
    if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null;
    if (thankYouTitle !== undefined) updateData.thankYouTitle = thankYouTitle;
    if (thankYouMessage !== undefined) updateData.thankYouMessage = thankYouMessage;
    if (thankYouRedirectUrl !== undefined) updateData.thankYouRedirectUrl = thankYouRedirectUrl;

    if (Object.keys(updateData).length === 0) {
      throw new ConflictError("No fields to update");
    }

    await this.db.update(formsTable).set(updateData).where(eq(formsTable.id, formId));

    return this.getFormById(userId, formId);
  }

  //. set or clear the shared form password
  public async setPassword(userId: string, payload: SetFormPasswordInputType) {
    const { formId, password } = await setFormPasswordInput.parseAsync(payload);

    await this.getFormById(userId, formId);

    const passwordHash = password === null ? null : await hashPassword(password);

    await this.db
      .update(formsTable)
      .set({ passwordHash })
      .where(eq(formsTable.id, formId));

    return { formId, passwordProtected: passwordHash !== null };
  }

  //. change the share slug
  public async updateSlug(userId: string, payload: UpdateFormSlugInputType) {
    const { formId, slug } = await updateFormSlugInput.parseAsync(payload);

    await this.getFormById(userId, formId);

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      // On a collision, offer the next free variant rather than failing outright —
      // but say so in the returned slug so the creator sees what they actually got.
      const candidate = attempt === 0 ? slug : `${slugify(slug).slice(0, 60)}-${attempt + 1}`;

      const taken = await this.db
        .select({ id: formsTable.id })
        .from(formsTable)
        .where(eq(formsTable.slug, candidate))
        .limit(1);

      if (taken.length > 0) continue;

      const updated = await this.db
        .update(formsTable)
        .set({ slug: candidate })
        .where(eq(formsTable.id, formId))
        .returning({ slug: formsTable.slug });

      return { slug: updated[0]!.slug };
    }

    throw new ConflictError("That link is already taken");
  }

  //. delete a form and everything under it
  public async deleteForm(userId: string, payload: DeleteFormInputType) {
    const { formId } = await deleteFormInput.parseAsync(payload);

    await this.getFormById(userId, formId);

    // Pages, questions, sessions, answers and events all cascade.
    await this.db.delete(formsTable).where(eq(formsTable.id, formId));

    return { id: formId };
  }

  /**
   * Move a form to `PUBLISHED`, `DRAFT` or `CLOSED`.
   *
   * Publishing is the gate between the builder and the audience, so it is also where
   * the form is checked for being fillable: it needs at least one live question, and
   * every question's settings must still be valid for its kind. A question left
   * half-configured is caught here rather than by a respondent.
   */
  public async setStatus(userId: string, payload: SetFormStatusInputType) {
    const { formId, status } = await setFormStatusInput.parseAsync(payload);

    const form = await this.getFormById(userId, formId);

    if (status === "PUBLISHED") {
      if (form.closesAt && form.closesAt.getTime() < Date.now()) {
        throw new ConflictError("This form's closing date has already passed");
      }

      const questions = await this.db
        .select({
          label: questionsTable.label,
          kind: questionsTable.kind,
          settings: questionsTable.settings,
        })
        .from(questionsTable)
        .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)));

      if (questions.length === 0) {
        throw new ConflictError("Add at least one question before publishing");
      }

      // A paged form with no pages publishes as a form that renders nothing: the
      // questions exist but none of them belong to a page, so the respondent's view is
      // empty. `layoutMode` defaults to `PAGED`, so this is the state a brand new form is
      // in, and the check has to live at the gate rather than in the renderer.
      if (form.layoutMode === "PAGED") {
        const pages = await this.db
          .select({ id: formPagesTable.id })
          .from(formPagesTable)
          .where(eq(formPagesTable.formId, formId))
          .limit(1);

        if (pages.length === 0) {
          throw new ConflictError("Add at least one page before publishing");
        }
      }

      for (const question of questions) {
        try {
          parseSettingsFor(question.kind as QuestionKind, question.settings);
        } catch {
          throw new ConflictError(
            `The question "${question.label}" is not finished — check its settings`,
          );
        }
      }

      // Structure changed, so bump the version. In-flight sessions keep a record of the
      // version they started against, so a re-publish cannot silently rewrite history.
      const alreadyPublished = form.status === "PUBLISHED";

      await this.db
        .update(formsTable)
        .set({
          status: "PUBLISHED",
          version: alreadyPublished ? form.version : form.version + 1,
          publishedAt: alreadyPublished ? form.publishedAt : new Date(),
        })
        .where(eq(formsTable.id, formId));

      return this.getFormById(userId, formId);
    }

    // DRAFT and CLOSED both just move the status. CLOSED stops accepting responses
    // while keeping every response; DRAFT additionally hides it from the share link.
    await this.db.update(formsTable).set({ status }).where(eq(formsTable.id, formId));

    return this.getFormById(userId, formId);
  }

  /** How many responses a form has accepted. */
  public async countCompleted(formId: string): Promise<number> {
    const rows = await this.db
      .select({ total: count() })
      .from(formSessionsTable)
      .where(
        and(eq(formSessionsTable.formId, formId), eq(formSessionsTable.status, "COMPLETED")),
      );

    return rows[0]?.total ?? 0;
  }

  /** Why a form is not accepting responses, or null when it is. */
  public async getClosedReason(formId: string): Promise<"NOT_PUBLISHED" | "EXPIRED" | "LIMIT" | null> {
    const rows = await this.db
      .select({
        status: formsTable.status,
        closesAt: formsTable.closesAt,
        maxResponses: formsTable.maxResponses,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId))
      .limit(1);

    const form = rows[0];
    if (!form) throw new NotFoundError("Form does not exist");
    if (form.status !== "PUBLISHED") return "NOT_PUBLISHED";
    if (form.closesAt && form.closesAt.getTime() < Date.now()) return "EXPIRED";
    if (form.maxResponses !== null && (await this.countCompleted(formId)) >= form.maxResponses) {
      return "LIMIT";
    }

    return null;
  }

  public async isAcceptingResponses(formId: string): Promise<boolean> {
    return (await this.getClosedReason(formId)) === null;
  }
}

export default FormService;
