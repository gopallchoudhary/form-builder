import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "./db";

/**
 * These assert the *constraints*, not just the columns. A schema that accepted
 * duplicate positions, or a second completed response from the same device, would
 * corrupt the ordering and the response counts the analytics pages are built on.
 */
describe("schema", () => {
  let testDb: TestDatabase;
  const query = <T>(sql: string, params?: unknown[]) => testDb.query<T>(sql, params);

  const userId = "11111111-1111-4111-8111-111111111111";
  let slugCounter = 0;

  async function seedUser(): Promise<void> {
    await query(
      `INSERT INTO users (id, full_name, email, password_hash) VALUES ($1, 'Gopal', 'gopal@example.com', 'x')`,
      [userId],
    );
  }

  async function createForm(extra: string[] = [], params: unknown[] = []): Promise<string> {
    slugCounter += 1;
    const rows = await query<{ id: string }>(
      `INSERT INTO forms (created_by, slug, title) VALUES ($1, $2, 'Customer feedback') RETURNING id`,
      [userId, `form-${slugCounter}`, ...params],
    );
    void extra;
    return rows[0]!.id;
  }

  async function createQuestion(formId: string, position: string, key: string): Promise<string> {
    const rows = await query<{ id: string }>(
      `INSERT INTO questions (form_id, position, kind, label, label_key)
       VALUES ($1, $2, 'SHORT_TEXT', $3, $3) RETURNING id`,
      [formId, position, key],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await seedUser();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe("forms", () => {
    it("rejects a duplicate slug, because the share URL is /f/[slug]", async () => {
      await query(`INSERT INTO forms (created_by, slug, title) VALUES ($1, 'shared-slug', 'First')`, [
        userId,
      ]);

      await expect(
        query(`INSERT INTO forms (created_by, slug, title) VALUES ($1, 'shared-slug', 'Second')`, [
          userId,
        ]),
      ).rejects.toThrow();
    });

    it("defaults a new form to a STEP draft on the sage theme", async () => {
      const formId = await createForm();
      const rows = await query<Record<string, unknown>>(`SELECT * FROM forms WHERE id = $1`, [formId]);

      expect(rows[0]).toMatchObject({
        // STEP, not PAGED: a stepper form needs no pages, so a new form is coherent
        // immediately. PAGED left every new form with questions on no page.
        layout_mode: "STEP",
        status: "DRAFT",
        theme_key: "sage",
        version: 1,
        one_response_per_device: true,
        show_progress: true,
        allow_back: true,
      });
    });

    it("rejects an unknown layout mode or status at the database level", async () => {
      await expect(
        query(
          `INSERT INTO forms (created_by, slug, title, layout_mode) VALUES ($1, 'bad-layout', 'X', 'CAROUSEL')`,
          [userId],
        ),
      ).rejects.toThrow();

      await expect(
        query(
          `INSERT INTO forms (created_by, slug, title, status) VALUES ($1, 'bad-status', 'X', 'LIVE')`,
          [userId],
        ),
      ).rejects.toThrow();
    });

    it("leaves password_hash null by default, meaning the link is open", async () => {
      const formId = await createForm();
      const rows = await query<{ password_hash: string | null }>(
        `SELECT password_hash FROM forms WHERE id = $1`,
        [formId],
      );

      expect(rows[0]!.password_hash).toBeNull();
    });
  });

  describe("question ordering", () => {
    it("enforces unique positions within a page", async () => {
      const formId = await createForm();
      const pages = await query<{ id: string }>(
        `INSERT INTO form_pages (form_id, title, position) VALUES ($1, 'Address', 1.00) RETURNING id`,
        [formId],
      );
      const pageId = pages[0]!.id;

      await query(
        `INSERT INTO questions (form_id, page_id, position, kind, label, label_key)
         VALUES ($1, $2, 1.00, 'SHORT_TEXT', 'Street', 'street')`,
        [formId, pageId],
      );

      await expect(
        query(
          `INSERT INTO questions (form_id, page_id, position, kind, label, label_key)
           VALUES ($1, $2, 1.00, 'SHORT_TEXT', 'City', 'city')`,
          [formId, pageId],
        ),
      ).rejects.toThrow();
    });

    it("enforces unique positions for STEP-layout questions, where page_id is null", async () => {
      const formId = await createForm();

      // This is exactly the case a single (form_id, page_id, position) index would
      // silently fail to constrain, because Postgres treats NULLs as distinct.
      await createQuestion(formId, "1.00", "first");

      await expect(createQuestion(formId, "1.00", "second")).rejects.toThrow();
    });

    it("allows the same position in different pages", async () => {
      const formId = await createForm();
      const pages = await query<{ id: string }>(
        `INSERT INTO form_pages (form_id, title, position) VALUES ($1, 'Page', 1.00) RETURNING id`,
        [formId],
      );
      const pageId = pages[0]!.id;

      await query(
        `INSERT INTO questions (form_id, page_id, position, kind, label, label_key)
         VALUES ($1, $2, 1.00, 'SHORT_TEXT', 'Street', 'street')`,
        [formId, pageId],
      );

      await expect(
        query(
          `INSERT INTO questions (form_id, position, kind, label, label_key)
           VALUES ($1, 1.00, 'SHORT_TEXT', 'Name', 'name')`,
          [formId],
        ),
      ).resolves.toBeDefined();
    });

    it("enforces label_key uniqueness per form, but only among live questions", async () => {
      const formId = await createForm();

      await createQuestion(formId, "1.00", "email");

      await expect(createQuestion(formId, "2.00", "email")).rejects.toThrow();

      // Soft-deleting frees the key, so the same label can be reused later.
      await testDb.exec(`UPDATE questions SET deleted_at = now() WHERE form_id = '${formId}'`);
      await expect(createQuestion(formId, "3.00", "email")).resolves.toBeDefined();
    });

    it("stores an empty settings object by default", async () => {
      const formId = await createForm();
      const questionId = await createQuestion(formId, "1.00", "settings-default");
      const rows = await query<{ settings: unknown }>(
        `SELECT settings FROM questions WHERE id = $1`,
        [questionId],
      );

      expect(rows[0]!.settings).toEqual({});
    });
  });

  describe("responses", () => {
    it("allows only one completed session per device, but many in-progress drafts", async () => {
      const formId = await createForm();
      const device = "22222222-2222-4222-8222-222222222222";

      await query(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'IN_PROGRESS')`,
        [formId, device],
      );
      await query(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'IN_PROGRESS')`,
        [formId, device],
      );
      await query(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'COMPLETED')`,
        [formId, device],
      );

      await expect(
        query(
          `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'COMPLETED')`,
          [formId, device],
        ),
      ).rejects.toThrow();
    });

    it("keeps one answer per question per session, so a draft save is an upsert", async () => {
      const formId = await createForm();
      const device = "33333333-3333-4333-8333-333333333333";
      const questionId = await createQuestion(formId, "1.00", "name");
      const sessions = await query<{ id: string }>(
        `INSERT INTO form_sessions (form_id, device_id) VALUES ($1, $2) RETURNING id`,
        [formId, device],
      );
      const sessionId = sessions[0]!.id;

      await query(
        `INSERT INTO form_answers (session_id, form_id, question_id, value_text, question_label, question_label_key, question_kind)
         VALUES ($1, $2, $3, 'first', 'Name', 'name', 'SHORT_TEXT')`,
        [sessionId, formId, questionId],
      );

      await expect(
        query(
          `INSERT INTO form_answers (session_id, form_id, question_id, value_text) VALUES ($1, $2, $3, 'second')`,
          [sessionId, formId, questionId],
        ),
      ).rejects.toThrow();
    });

    it("refuses to delete a question that already has answers, preserving history", async () => {
      const formId = await createForm();
      const device = "44444444-4444-4444-8444-444444444444";
      const questionId = await createQuestion(formId, "1.00", "name");

      const sessions = await query<{ id: string }>(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'COMPLETED') RETURNING id`,
        [formId, device],
      );
      const sessionId = sessions[0]!.id;

      await query(
        `INSERT INTO form_answers (session_id, form_id, question_id, value_text, is_draft)
         VALUES ($1, $2, $3, 'Gopal', false)`,
        [sessionId, formId, questionId],
      );

      await expect(testDb.exec(`DELETE FROM questions WHERE id = '${questionId}'`)).rejects.toThrow();

      // Soft delete is the supported path.
      await expect(
        testDb.exec(`UPDATE questions SET deleted_at = now() WHERE id = '${questionId}'`),
      ).resolves.toBeDefined();
    });

    it("keeps the denormalised question label on the answer", async () => {
      const formId = await createForm();
      const device = "66666666-6666-4666-8666-666666666666";
      const questionId = await createQuestion(formId, "1.00", "name");

      const sessions = await query<{ id: string }>(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'COMPLETED') RETURNING id`,
        [formId, device],
      );

      await query(
        `INSERT INTO form_answers (session_id, form_id, question_id, value_text, question_label, question_label_key, question_kind)
         VALUES ($1, $2, $3, 'Gopal', 'Full name as asked at the time', 'name', 'SHORT_TEXT')`,
        [sessions[0]!.id, formId, questionId],
      );

      // Renaming the question must not rewrite what the answer says was asked.
      await testDb.exec(`UPDATE questions SET label = 'Renamed' WHERE id = '${questionId}'`);

      const rows = await query<{ question_label: string }>(
        `SELECT question_label FROM form_answers WHERE question_id = $1`,
        [questionId],
      );
      expect(rows[0]!.question_label).toBe("Full name as asked at the time");
    });
  });

  describe("cascades", () => {
    it("removes a form's questions, sessions, answers and events together", async () => {
      const formId = await createForm();
      const device = "55555555-5555-4555-8555-555555555555";
      const questionId = await createQuestion(formId, "1.00", "name");

      const sessions = await query<{ id: string }>(
        `INSERT INTO form_sessions (form_id, device_id, status) VALUES ($1, $2, 'COMPLETED') RETURNING id`,
        [formId, device],
      );
      const sessionId = sessions[0]!.id;

      await query(
        `INSERT INTO form_answers (session_id, form_id, question_id, value_text) VALUES ($1, $2, $3, 'Gopal')`,
        [sessionId, formId, questionId],
      );
      await query(`INSERT INTO form_events (form_id, session_id, type) VALUES ($1, $2, 'VIEW')`, [
        formId,
        sessionId,
      ]);

      await testDb.exec(`DELETE FROM forms WHERE id = '${formId}'`);

      for (const table of ["form_answers", "form_sessions", "form_events", "questions"]) {
        const rows = await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE form_id = $1`,
          [formId],
        );
        expect(rows[0]!.n, `${table} should be empty`).toBe(0);
      }
    });

    it("deletes a user's forms with them", async () => {
      const formId = await createForm();

      await testDb.exec(`DELETE FROM users WHERE id = '${userId}'`);

      const rows = await query<{ n: number }>(`SELECT count(*)::int AS n FROM forms WHERE id = $1`, [
        formId,
      ]);
      expect(rows[0]!.n).toBe(0);
    });
  });
});
