import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import AccessService from "../access";
import { AppError } from "../utils/errors";
import {
  createServiceHarness,
  createUser,
  servicesAvailable,
  type ServiceHarness,
} from "./harness";

/**
 * Service behaviour against a real PostgreSQL. Skipped when DATABASE_URL_TEST is unset.
 *
 * These cover the rules that only a real database can prove: ownership isolation,
 * publish gating, the resume flow, and the per-device response cap.
 */
describe.skipIf(!servicesAvailable)("services against a real database", () => {
  let harness: ServiceHarness;
  let access: AccessService;
  let owner: { id: string; email: string };
  let stranger: { id: string; email: string };

  beforeAll(async () => {
    harness = await createServiceHarness("integration");
    access = new AccessService(harness.db);
    owner = await createUser(harness);
    stranger = await createUser(harness);
  });

  afterAll(async () => {
    await harness?.close();
  });

  beforeEach(async () => {
    await harness.reset();
    owner = await createUser(harness);
    stranger = await createUser(harness);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  interface SeedQuestion {
    kind: Parameters<typeof harness.questions.createQuestion>[1]["kind"];
    label: string;
    isRequired?: boolean;
  }

  /** A form with its questions already in place, then published. */
  async function publishedForm(
    options: { password?: string; maxResponses?: number } = {},
    questions: SeedQuestion[] = [{ kind: "SHORT_TEXT", label: "Name" }],
  ) {
    const { id: formId, slug } = await harness.forms.createForm(owner.id, {
      title: "Customer feedback",
    });

    const questionIds: Record<string, string> = {};
    for (const question of questions) {
      const created = await harness.questions.createQuestion(owner.id, { formId, ...question });
      questionIds[question.label] = created.id;
    }

    if (options.password) {
      await harness.forms.setPassword(owner.id, { formId, password: options.password });
    }
    if (options.maxResponses !== undefined) {
      await harness.forms.updateSettings(owner.id, { formId, maxResponses: options.maxResponses });
    }

    await harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" });

    return { formId, slug, questionIds };
  }

  const device = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  // ── Ownership ────────────────────────────────────────────────────────────────

  describe("ownership", () => {
    it("hides another user's form, pages and questions", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Private" });
      const { id: pageId } = await harness.pages.createPage(owner.id, { formId, title: "One" });
      const { id: questionId } = await harness.questions.createQuestion(owner.id, {
        formId,
        pageId,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      await expect(harness.forms.getFormById(stranger.id, formId)).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(harness.forms.getFullDefinition(stranger.id, { formId })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(harness.pages.listPages(stranger.id, { formId })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(harness.questions.listQuestions(stranger.id, { formId })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(
        harness.questions.getQuestion(stranger.id, { questionId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.questions.updateQuestion(stranger.id, { questionId, label: "Hacked" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.questions.deleteQuestion(stranger.id, { questionId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.pages.deletePage(stranger.id, { pageId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(harness.forms.deleteForm(stranger.id, { formId })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(
        harness.forms.setStatus(stranger.id, { formId, status: "PUBLISHED" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.forms.setPassword(stranger.id, { formId, password: "mine now" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });

    it("reports a missing form as not found rather than forbidden", async () => {
      await expect(
        harness.forms.getFormById(owner.id, "00000000-0000-4000-8000-999999999999"),
      ).rejects.toMatchObject({ kind: "NOT_FOUND" });
    });

    it("returns the same error type for a wrong password and a missing form", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Secret" });
      await harness.forms.setPassword(owner.id, { formId, password: "let-me-in" });

      const wrongPassword = await access.unlock({ slug: "does-not-exist", password: "x" });
      const realForm = await harness.forms.getFormById(owner.id, formId);

      expect(wrongPassword.unlocked).toBe(false);
      expect(wrongPassword.message).toBeTruthy();
      expect(realForm.slug).not.toBe("does-not-exist");
    });
  });

  // ── Form lifecycle ───────────────────────────────────────────────────────────

  describe("publishing", () => {
    it("refuses to publish a form with no questions", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Empty" });

      await expect(
        harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("publishes a stepper form with no pages", async () => {
      // The default layout. A stepper form needs no pages, so this is the shape a brand
      // new form has and it must be publishable straight away.
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Stepper" });
      await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      const published = await harness.forms.setStatus(owner.id, {
        formId,
        status: "PUBLISHED",
      });
      expect(published.status).toBe("PUBLISHED");
    });

    it("refuses to publish a paged form with no pages", async () => {
      // A paged form whose questions belong to no page renders as an empty form, so the
      // gate has to catch it here rather than the respondent.
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Paged" });
      await harness.forms.updateSettings(owner.id, { formId, layoutMode: "PAGED" });
      await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      await expect(
        harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("publishes a paged form once it has a page", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Paged" });
      await harness.forms.updateSettings(owner.id, { formId, layoutMode: "PAGED" });
      const page = await harness.pages.createPage(owner.id, { formId, title: "One" });
      await harness.questions.createQuestion(owner.id, {
        formId,
        pageId: page.id,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      const published = await harness.forms.setStatus(owner.id, {
        formId,
        status: "PUBLISHED",
      });
      expect(published.status).toBe("PUBLISHED");
    });

    it("bumps the version on publish and again on re-publish", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Versioned" });
      await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      const first = await harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" });
      expect(first.status).toBe("PUBLISHED");
      expect(first.version).toBe(2);
      expect(first.publishedAt).toBeInstanceOf(Date);

      const second = await harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" });
      expect(second.version).toBe(2);
    });

    it("refuses to publish a form whose closing date has passed", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Expired" });
      await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Name",
      });
      await harness.forms.updateSettings(owner.id, {
        formId,
        closesAt: new Date(Date.now() - 1000).toISOString(),
      });

      await expect(
        harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("rejects a choice question that has no usable options", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Broken" });
      // Create with valid defaults, then corrupt the settings behind the service's back.
      await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SINGLE_CHOICE",
        label: "Pick one",
      });

      await harness.db.execute(
        `UPDATE questions SET settings = '{"options":[]}' WHERE form_id = '${formId}'`,
      );

      await expect(
        harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("refuses to start a session on a form that has already closed", async () => {
      const { formId, slug } = await publishedForm();
      await harness.raw(
        `UPDATE forms SET closes_at = now() - interval '1 hour' WHERE id = '${formId}'`,
      );

      // Caught at the door, so a respondent is never shown a form they cannot finish.
      await expect(access.startSession({ slug, deviceId: device(1) })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
    });

    it("reports EXPIRED at submit when the form closes mid-answer", async () => {
      const { formId, slug, questionIds } = await publishedForm();

      // The respondent is already in, then the creator closes the form.
      const session = await access.startSession({ slug, deviceId: device(1) });
      await harness.raw(
        `UPDATE forms SET closes_at = now() - interval '1 hour' WHERE id = '${formId}'`,
      );

      const result = await access.submit({
        sessionId: session.sessionId,
        deviceId: device(1),
        answers: [{ questionId: questionIds.Name!, value: "Gopal" }],
      });

      expect(result.status).toBe("EXPIRED");
    });
  });

  // ── Password protection ──────────────────────────────────────────────────────

  describe("password protection", () => {
    it("withholds the form until the password is supplied", async () => {
      const { slug } = await publishedForm({ password: "open-sesame" });

      const locked = await access.getPublicFormBySlug({ slug });
      expect(locked.available).toBe(true);
      expect(locked.locked).toBe(true);
      expect(locked.form).toBeNull();

      const wrong = await access.unlock({ slug, password: "nope" });
      expect(wrong.unlocked).toBe(false);
      expect(wrong.unlockToken).toBeUndefined();

      const right = await access.unlock({ slug, password: "open-sesame" });
      expect(right.unlocked).toBe(true);
      expect(right.unlockToken).toBeTruthy();

      const unlocked = await access.getPublicFormBySlug({ slug, unlockToken: right.unlockToken });
      expect(unlocked.locked).toBe(false);
      expect(unlocked.form?.questions).toHaveLength(1);
    });

    it("never puts the password or the creator in the public payload", async () => {
      const { slug } = await publishedForm({ password: "open-sesame" });
      const { unlockToken } = await access.unlock({ slug, password: "open-sesame" });

      const { form } = await access.getPublicFormBySlug({ slug, unlockToken });
      const serialised = JSON.stringify(form);

      expect(form).not.toBeNull();
      expect(serialised).not.toContain("open-sesame");
      expect(serialised).not.toContain("password");
      expect(serialised).not.toContain(owner.email);
      expect(serialised).not.toContain(owner.id);
    });

    it("refuses to start a session without the unlock token", async () => {
      const { slug } = await publishedForm({ password: "open-sesame" });

      await expect(access.startSession({ slug, deviceId: device(2) })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
    });
  });

  // ── Drafts and resume ────────────────────────────────────────────────────────

  describe("drafts", () => {
    it("resumes an in-progress session and returns the saved answers", async () => {
      const { slug, questionIds } = await publishedForm({}, [
        { kind: "SHORT_TEXT", label: "Name" },
        { kind: "EMAIL", label: "Email" },
      ]);
      const emailQuestion = questionIds.Email!;

      const first = await access.startSession({ slug, deviceId: device(3) });
      expect(first.created).toBe(true);

      await access.saveDraft({
        sessionId: first.sessionId,
        deviceId: device(3),
        answers: [
          { questionId: emailQuestion, value: "gopal@example.com" },
        ],
      });

      const resumed = await access.startSession({ slug, deviceId: device(3) });
      expect(resumed.created).toBe(false);
      expect(resumed.sessionId).toBe(first.sessionId);
      expect(resumed.answers).toEqual({ [emailQuestion]: "gopal@example.com" });
    });

    it("refuses to touch a session belonging to another device", async () => {
      const { slug, questionIds } = await publishedForm();
      const questionId = questionIds.Name!;

      const session = await access.startSession({ slug, deviceId: device(4) });

      await expect(
        access.saveDraft({
          sessionId: session.sessionId,
          deviceId: device(5),
          answers: [{ questionId, value: "not mine" }],
        }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });

    it("clears an answer when the client sends an empty value", async () => {
      const { slug, questionIds } = await publishedForm();
      const questionId = questionIds.Name!;

      const session = await access.startSession({ slug, deviceId: device(6) });

      await access.saveDraft({
        sessionId: session.sessionId,
        deviceId: device(6),
        answers: [{ questionId, value: "Gopal" }],
      });
      await access.saveDraft({
        sessionId: session.sessionId,
        deviceId: device(6),
        answers: [{ questionId, value: "" }],
      });

      const resumed = await access.startSession({ slug, deviceId: device(6) });
      expect(resumed.answers[questionId]).toBeUndefined();
    });

    it("ignores a question id that belongs to another form", async () => {
      const { slug } = await publishedForm();

      const other = await harness.forms.createForm(owner.id, { title: "Other" });
      const { id: foreignQuestion } = await harness.questions.createQuestion(owner.id, {
        formId: other.id,
        kind: "SHORT_TEXT",
        label: "Secret",
      });

      const session = await access.startSession({ slug, deviceId: device(7) });
      await access.saveDraft({
        sessionId: session.sessionId,
        deviceId: device(7),
        answers: [{ questionId: foreignQuestion, value: "leaked" }],
      });

      const rows = await harness.raw<{ n: number }>(
        `SELECT count(*)::int AS n FROM form_answers WHERE question_id = '${foreignQuestion}'`,
      );
      expect(rows[0]!.n).toBe(0);
    });
  });

  // ── Submitting ───────────────────────────────────────────────────────────────

  describe("submitting", () => {
    it("reports every missing required answer at once", async () => {
      const { slug, questionIds } = await publishedForm({}, [
        { kind: "SHORT_TEXT", label: "Name", isRequired: true },
        { kind: "EMAIL", label: "Email", isRequired: true },
      ]);
      const a = questionIds.Name!;
      const b = questionIds.Email!;

      const session = await access.startSession({ slug, deviceId: device(8) });
      const result = await access.submit({
        sessionId: session.sessionId,
        deviceId: device(8),
        answers: [],
      });

      expect(result.status).toBe("INVALID");
      if (result.status === "INVALID") {
        expect(Object.keys(result.fieldErrors).sort()).toEqual([a, b].sort());
      }
    });

    it("rejects a malformed value for one field without losing the valid ones", async () => {
      const { slug, questionIds } = await publishedForm({}, [
        { kind: "SHORT_TEXT", label: "Name" },
        { kind: "EMAIL", label: "Email" },
      ]);
      const name = questionIds.Name!;
      const email = questionIds.Email!;

      const session = await access.startSession({ slug, deviceId: device(9) });
      const result = await access.submit({
        sessionId: session.sessionId,
        deviceId: device(9),
        answers: [
          { questionId: name, value: "Gopal" },
          { questionId: email, value: "not-an-email" },
        ],
      });

      expect(result.status).toBe("INVALID");
      if (result.status === "INVALID") {
        expect(result.fieldErrors[email]).toBeTruthy();
        expect(result.fieldErrors[name]).toBeUndefined();
      }
    });

    it("accepts a valid submission and records it once", async () => {
      const { slug, questionIds } = await publishedForm();
      const questionId = questionIds.Name!;

      const session = await access.startSession({ slug, deviceId: device(10) });
      const result = await access.submit({
        sessionId: session.sessionId,
        deviceId: device(10),
        answers: [{ questionId, value: "Gopal" }],
      });

      expect(result.status).toBe("SUBMITTED");

      const rows = await harness.raw<{ value_text: string; question_label: string; is_draft: boolean }>(
        `SELECT value_text, question_label, is_draft FROM form_answers WHERE session_id = '${session.sessionId}'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ value_text: "Gopal", is_draft: false });

      const submits = await harness.raw<{ n: number }>(
        `SELECT count(*)::int AS n FROM form_events WHERE session_id = '${session.sessionId}' AND type = 'SUBMIT'`,
      );
      expect(submits[0]!.n).toBe(1);
    });

    it("tells a second submit from the same device that it is already done", async () => {
      const { slug, questionIds } = await publishedForm();
      const questionId = questionIds.Name!;

      const session = await access.startSession({ slug, deviceId: device(11) });
      await access.submit({
        sessionId: session.sessionId,
        deviceId: device(11),
        answers: [{ questionId, value: "Gopal" }],
      });

      const again = await access.submit({
        sessionId: session.sessionId,
        deviceId: device(11),
        answers: [{ questionId, value: "Changed" }],
      });

      expect(again.status).toBe("ALREADY_SUBMITTED");
    });

    it("stops accepting once the response limit is reached", async () => {
      const { slug, questionIds } = await publishedForm({ maxResponses: 1 });
      const questionId = questionIds.Name!;

      const first = await access.startSession({ slug, deviceId: device(12) });
      expect(
        (
          await access.submit({
            sessionId: first.sessionId,
            deviceId: device(12),
            answers: [{ questionId, value: "One" }],
          })
        ).status,
      ).toBe("SUBMITTED");

      const second = await access.startSession({ slug, deviceId: device(13) });
      const result = await access.submit({
        sessionId: second.sessionId,
        deviceId: device(13),
        answers: [{ questionId, value: "Two" }],
      });

      expect(result.status).toBe("LIMIT_REACHED");

      // The cap is also visible before anyone starts.
      const view = await access.getPublicFormBySlug({ slug });
      expect(view.available).toBe(false);
      expect(view.reason).toBe("LIMIT_REACHED");
    });

    it("keeps the label a question had when the response was submitted", async () => {
      const { slug, questionIds } = await publishedForm({}, [
        { kind: "SHORT_TEXT", label: "What is your name?" },
      ]);
      const questionId = questionIds["What is your name?"]!;

      const session = await access.startSession({ slug, deviceId: device(14) });
      await access.submit({
        sessionId: session.sessionId,
        deviceId: device(14),
        answers: [{ questionId, value: "Gopal" }],
      });

      await harness.questions.updateQuestion(owner.id, { questionId, label: "Your name" });

      const rows = await harness.raw<{ question_label: string; question_label_key: string }>(
        `SELECT question_label, question_label_key FROM form_answers WHERE question_id = '${questionId}'`,
      );
      expect(rows[0]).toMatchObject({
        question_label: "What is your name?",
        question_label_key: "what-is-your-name",
      });
    });
  });

  // ── Ordering ─────────────────────────────────────────────────────────────────

  describe("ordering", () => {
    it("appends a question to the end and keeps positions sequential", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Ordered" });

      const first = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "One",
      });
      const second = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Two",
      });

      expect(first.position).toBe("1.00");
      expect(second.position).toBe("2.00");

      const listed = await harness.questions.listQuestions(owner.id, { formId });
      expect(listed.map((question) => question.label)).toEqual(["One", "Two"]);
    });

    it("applies a reorder to the exact order given", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Reordered" });
      const a = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "A" });
      const b = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "B" });
      const c = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "C" });

      await harness.questions.reorderQuestions(owner.id, {
        formId,
        orderedQuestionIds: [c.id, a.id, b.id],
      });

      const listed = await harness.questions.listQuestions(owner.id, { formId });
      expect(listed.map((question) => question.label)).toEqual(["C", "A", "B"]);
      expect(listed.map((question) => String(question.position))).toEqual(["1.00", "2.00", "3.00"]);
    });

    it("rejects a partial reorder, so a page can never be silently truncated", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Partial" });
      const a = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "A" });
      await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "B" });

      await expect(
        harness.questions.reorderQuestions(owner.id, { formId, orderedQuestionIds: [a.id] }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("inserts a page after an existing one and renumbers the rest", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Paged" });
      const first = await harness.pages.createPage(owner.id, { formId, title: "First" });
      const second = await harness.pages.createPage(owner.id, { formId, title: "Second" });
      const middle = await harness.pages.createPage(owner.id, {
        formId,
        title: "Middle",
        afterPageId: first.id,
      });

      expect(second.position).toBe("2.00");
      expect(Number(middle.position)).toBeGreaterThan(Number(first.position));
      expect(Number(middle.position)).toBeLessThan(Number(second.position));

      const pages = await harness.pages.listPages(owner.id, { formId });
      expect(pages.map((page) => page.title)).toEqual(["First", "Middle", "Second"]);
    });

    it("frees the labelKey once a question is soft-deleted", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Keys" });
      const first = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Email",
      });

      await expect(
        harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "Email" }),
      ).rejects.toBeInstanceOf(AppError);

      await harness.questions.deleteQuestion(owner.id, { questionId: first.id });

      const second = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Email",
      });
      expect(second.labelKey).toBe("email");
    });

    it("keeps a soft-deleted question out of the definition and the list", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Soft" });
      const keep = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "Keep" });
      const drop = await harness.questions.createQuestion(owner.id, { formId, kind: "SHORT_TEXT", label: "Drop" });

      await harness.questions.deleteQuestion(owner.id, { questionId: drop.id });

      const definition = await harness.forms.getFullDefinition(owner.id, { formId });
      expect(definition.questions.map((question) => question.id)).toEqual([keep.id]);
    });
  });

  // ── Duplication ──────────────────────────────────────────────────────────────

  describe("duplication", () => {
    it("copies a question and gives the copy its own labelKey", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Copy" });
      const source = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SHORT_TEXT",
        label: "Name",
      });

      const copy = await harness.questions.duplicateQuestion(owner.id, { questionId: source.id });

      expect(copy.id).not.toBe(source.id);
      expect(copy.labelKey).toBe("name-copy");
      expect(Number(copy.position)).toBeGreaterThan(Number(source.position));
    });
  });
});
