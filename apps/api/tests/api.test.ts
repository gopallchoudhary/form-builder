import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import {
  databaseUrlForScope,
  hasTestDatabase,
  setupTestDatabase,
  TEST_DATABASE_URL,
  type ServerTestDatabase,
} from "@repo/database/tests/db-server";

/**
 * The HTTP surface, end to end: routing, auth, ownership, validation and rate limits.
 *
 * `DATABASE_URL` is pointed at a throwaway database *before* the app is imported, because
 * the services bind their connection at module load. Everything else — the router, the
 * context factory, the error handler — is the same code the dev server runs.
 */

const SCOPE = "api";
const PASSWORD = "correct horse battery";

type App = { handle: (req: never, res: never) => void } | Express;

let app: App;
let server: ServerTestDatabase;
let resetRateLimits: () => void;

const available = hasTestDatabase;

describe.skipIf(!available)("the HTTP API", () => {
  let counter = 0;
  const uniqueEmail = () => `api-${++counter}-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Own database for this file, so a parallel file cannot drop the schema.
    server = await setupTestDatabase(SCOPE);
    process.env.DATABASE_URL = databaseUrlForScope(TEST_DATABASE_URL!, SCOPE);

    /*
     * Both imports are dynamic, and the order is the whole point.
     *
     * `@repo/trpc/server` builds the router when it loads, which reaches the services and
     * opens the connection pool — and the pool reads `DATABASE_URL` once, at that moment.
     * Imported at the top of the file it bound to whatever `.env` said, so every test in
     * this suite wrote its users and forms into the *developer's* database and left them
     * there. Repointing the variable afterwards changed nothing.
     */
    const imported = await import("../src/server");
    app = imported.app as unknown as App;

    ({ resetRateLimits } = await import("@repo/trpc/server"));
  });

  afterAll(async () => {
    await server?.close();
  });

  beforeEach(async () => {
    await server.reset();
    // The rate limiter is process-wide, so a test that trips a limit must not leak
    // into the next one.
    resetRateLimits();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function signUp(email = uniqueEmail()) {
    const response = await request(app as never)
      .post("/api/authentication/createUserWithEmailAndPassword")
      .send({ fullName: "Test User", email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.id).toBeTruthy();

    const cookie = response.headers["set-cookie"]?.[0];
    expect(cookie).toBeDefined();
    expect(cookie).toContain("authentication-token");
    // Phase 0: the auth cookie must be httpOnly and not sent over plain http in prod.
    expect(cookie).toContain("HttpOnly");

    return { id: response.body.id as string, email, cookie: cookie!.split(";")[0]! };
  }

  const auth = (cookie: string) => ({ Cookie: cookie });

  async function publishedForm(cookie: string) {
    const created = await request(app as never)
      .post("/api/form/createForm")
      .set(auth(cookie))
      .send({ title: "Customer feedback" });

    const formId = created.body.id as string;

    await request(app as never)
      .post("/api/form/question/createQuestion")
      .set(auth(cookie))
      .send({ formId, kind: "SHORT_TEXT", label: "Name" });

    const published = await request(app as never)
      .post("/api/form/setFormStatus")
      .set(auth(cookie))
      .send({ formId, status: "PUBLISHED" });

    expect(published.status).toBe(200);

    return { formId, slug: created.body.slug as string };
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("creates an account and sets a session cookie", async () => {
      const user = await signUp();
      expect(user.email).toContain("@example.com");
    });

    it("rejects a short password with field-level detail", async () => {
      const response = await request(app as never)
        .post("/api/authentication/createUserWithEmailAndPassword")
        .send({ fullName: "Test", email: "not-an-email", password: "short" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("BAD_REQUEST");
      expect(response.body.issues.length).toBeGreaterThan(0);
    });

    it("rejects a duplicate email as a conflict, not a 500", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const response = await request(app as never)
        .post("/api/authentication/createUserWithEmailAndPassword")
        .send({ fullName: "Test", email, password: PASSWORD });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("CONFLICT");
    });

    it("refuses a protected procedure without a cookie", async () => {
      const response = await request(app as never).get(
        "/api/authentication/getLoggedInUserInfo",
      );

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });

    it("refuses a garbage cookie", async () => {
      const response = await request(app as never)
        .get("/api/authentication/getLoggedInUserInfo")
        .set(auth("authentication-token=not-a-jwt"));

      expect(response.status).toBe(401);
    });

    it("returns the signed-in user with a valid cookie", async () => {
      const user = await signUp();

      const response = await request(app as never)
        .get("/api/authentication/getLoggedInUserInfo")
        .set(auth(user.cookie));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
    });

    it("signs in with the right password and not with the wrong one", async () => {
      const user = await signUp();

      const wrong = await request(app as never)
        .post("/api/authentication/signinUserWithEmailAndPassword")
        .send({ email: user.email, password: "not the password" });
      expect(wrong.status).toBe(401);

      const right = await request(app as never)
        .post("/api/authentication/signinUserWithEmailAndPassword")
        .send({ email: user.email, password: PASSWORD });
      expect(right.status).toBe(200);
      expect(right.body.id).toBe(user.id);
    });

    it("gives the same answer for a wrong password and an unknown email", async () => {
      const user = await signUp();

      const wrongPassword = await request(app as never)
        .post("/api/authentication/signinUserWithEmailAndPassword")
        .send({ email: user.email, password: "nope" });
      const unknownEmail = await request(app as never)
        .post("/api/authentication/signinUserWithEmailAndPassword")
        .send({ email: "nobody@example.com", password: "nope" });

      expect(wrongPassword.status).toBe(unknownEmail.status);
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it("clears the cookie on sign out", async () => {
      const user = await signUp();

      const response = await request(app as never)
        .post("/api/authentication/signOutUser")
        .set(auth(user.cookie))
        .send({});

      expect(response.status).toBe(200);
      const cookie = response.headers["set-cookie"]?.[0] ?? "";
      expect(cookie).toContain("authentication-token=");
      expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });

    /*
     * The same sign-out over tRPC, which is the transport the web app actually uses.
     *
     * It was the only path that was broken, and nothing here noticed for a long time:
     * every other request in this file goes to `/api/...`, so a procedure that answered
     * REST perfectly while being uncallable over tRPC looked healthy. `httpLink` sends no
     * body for a mutation with no input, so that is what this sends — the empty body is
     * the whole regression.
     */
    it("clears the cookie on sign out over tRPC, with no request body", async () => {
      const user = await signUp();

      const response = await request(app as never)
        .post("/trpc/auth.signOutUser")
        .set(auth(user.cookie))
        .set("content-type", "application/json")
        .send("");

      expect(response.status).toBe(200);
      const cookie = response.headers["set-cookie"]?.[0] ?? "";
      expect(cookie).toContain("authentication-token=");
      expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });
  });

  // ── Forms ────────────────────────────────────────────────────────────────────

  describe("forms", () => {
    it("creates a form with a share slug", async () => {
      const user = await signUp();

      const response = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Customer feedback" });

      expect(response.status).toBe(200);
      expect(response.body.id).toBeTruthy();
      expect(response.body.slug).toMatch(/^customer-feedback-[a-z0-9]{6}$/);
    });

    it("gives two forms with the same title different links", async () => {
      const user = await signUp();

      const first = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Survey" });
      const second = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Survey" });

      expect(first.body.slug).not.toBe(second.body.slug);
    });

    it("returns the form definition with its pages and questions", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const response = await request(app as never)
        .get(`/api/form/getForm?formId=${form.formId}`)
        .set(auth(user.cookie));

      expect(response.status).toBe(200);
      expect(response.body.title).toBe("Customer feedback");
      expect(response.body.status).toBe("PUBLISHED");
      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].labelKey).toBe("name");
    });

    it("returns 403 for another user's form and 404 for one that does not exist", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const form = await publishedForm(owner.cookie);

      const forbidden = await request(app as never)
        .get(`/api/form/getForm?formId=${form.formId}`)
        .set(auth(stranger.cookie));
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.code).toBe("FORBIDDEN");

      const missing = await request(app as never)
        .get("/api/form/getForm?formId=00000000-0000-4000-8000-999999999999")
        .set(auth(stranger.cookie));
      expect(missing.status).toBe(404);
    });

    it("refuses to publish a form with no questions", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Empty" });

      const response = await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("question");
    });

    it("bumps the version on publish", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const response = await request(app as never)
        .get(`/api/form/getFormSettings?formId=${form.formId}`)
        .set(auth(user.cookie));

      expect(response.body.version).toBe(2);
      expect(response.body.publishedAt).toBeTruthy();
    });

    it("will not let a stranger publish or delete a form", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const form = await publishedForm(owner.cookie);

      const publish = await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(stranger.cookie))
        .send({ formId: form.formId, status: "DRAFT" });
      expect(publish.status).toBe(403);

      const remove = await request(app as never)
        .delete(`/api/form/deleteForm?formId=${form.formId}`)
        .set(auth(stranger.cookie));
      expect(remove.status).toBe(403);
    });

    it("sets and removes a form password", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Secret" });

      const set = await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: "open-sesame" });
      expect(set.status).toBe(200);
      expect(set.body.passwordProtected).toBe(true);

      const clear = await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: null });
      expect(clear.body.passwordProtected).toBe(false);
    });

    it("rejects an invalid theme key", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Themed" });

      const response = await request(app as never)
        .patch("/api/form/updateFormSettings")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, themeKey: "neon" });

      expect(response.status).toBe(400);
    });
  });

  // ── Questions ────────────────────────────────────────────────────────────────

  describe("questions", () => {
    it("rejects a question with settings that do not match its kind", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Choice" });

      const response = await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({
          formId: created.body.id,
          kind: "SINGLE_CHOICE",
          label: "Pick one",
          settings: { options: [{ id: "only-one" }] },
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("SINGLE_CHOICE");
    });

    it("turns a duplicate label into a conflict with a readable message", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Dupes" });

      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Email" });

      const response = await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Email" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("label");
    });

    it("rejects an unknown question kind", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Kinds" });

      const response = await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "HOLOGRAM", label: "What" });

      expect(response.status).toBe(400);
    });
  });

  // ── The public surface ───────────────────────────────────────────────────────

  describe("public form", () => {
    it("serves a published form without leaking the creator", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const response = await request(app as never).get(
        `/api/public/form/getFormBySlug?slug=${form.slug}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(true);
      expect(response.body.locked).toBe(false);
      expect(response.body.form.title).toBe("Customer feedback");

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(user.email);
      expect(serialised).not.toContain(user.id);
      expect(serialised).not.toContain("passwordHash");
    });

    it("reports an unknown slug rather than guessing", async () => {
      const response = await request(app as never).get(
        "/api/public/form/getFormBySlug?slug=nothing-here",
      );

      expect(response.status).toBe(200);
      expect(response.body.available).toBe(false);
      expect(response.body.reason).toBe("NOT_FOUND");
      expect(response.body.form).toBeNull();
    });

    it("will not serve a draft", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Hidden" });
      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Name" });

      const response = await request(app as never).get(
        `/api/public/form/getFormBySlug?slug=${created.body.slug}`,
      );

      expect(response.body.available).toBe(false);
      expect(response.body.reason).toBe("NOT_PUBLISHED");
    });

    it("gates a password-protected form until it is unlocked", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Secret" });
      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Name" });
      await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: "open-sesame" });
      await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      const locked = await request(app as never).get(
        `/api/public/form/getFormBySlug?slug=${created.body.slug}`,
      );
      expect(locked.body.locked).toBe(true);
      expect(locked.body.form).toBeNull();

      const wrong = await request(app as never)
        .post("/api/public/form/unlockForm")
        .send({ slug: created.body.slug, password: "nope" });
      expect(wrong.status).toBe(200);
      expect(wrong.body.unlocked).toBe(false);
      expect(wrong.body.unlockToken).toBeUndefined();

      const right = await request(app as never)
        .post("/api/public/form/unlockForm")
        .send({ slug: created.body.slug, password: "open-sesame" });
      expect(right.body.unlocked).toBe(true);
      expect(right.body.unlockToken).toBeTruthy();

      const unlocked = await request(app as never).get(
        `/api/public/form/getFormBySlug?slug=${created.body.slug}&unlockToken=${encodeURIComponent(
          right.body.unlockToken as string,
        )}`,
      );
      expect(unlocked.body.locked).toBe(false);
      expect(unlocked.body.form.questions).toHaveLength(1);
    });

    it("starts a session on the cookie alone, with no token in the body", async () => {
      /*
       * The shape of a reload.
       *
       * The respondent unlocked once, so the browser holds the cookie. On the next server
       * render the API reads it, sees an unlocked form, and the form is served — but the
       * client component then boots with nothing in client state and asks to start a session
       * with no token. If `startSession` does not read the cookie as well, the two disagree:
       * the form renders and then refuses to be filled in, which is what a respondent sees.
       *
       * Deliberately no `unlockToken` in the body, because that is the whole point.
       */
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Cookie only" });
      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Name" });
      await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: "open-sesame" });
      await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      const unlocked = await request(app as never)
        .post("/api/public/form/unlockForm")
        .send({ slug: created.body.slug, password: "open-sesame" });
      expect(unlocked.body.unlocked).toBe(true);

      const unlockCookie = (unlocked.headers["set-cookie"] as unknown as string[]).find((entry) =>
        entry.startsWith("form-unlock-"),
      );
      expect(unlockCookie, "unlocking should set the cookie the reload depends on").toBeTruthy();
      const cookieHeader = unlockCookie!.split(";")[0]!;

      const started = await request(app as never)
        .post("/api/public/form/startSession")
        .set({ Cookie: cookieHeader })
        .send({ slug: created.body.slug, deviceId: "00000000-0000-4000-8000-00000000bb01" });

      expect(started.status).toBe(200);
      expect(started.body.sessionId).toBeTruthy();
    });

    it("still refuses a session without the cookie or a token", async () => {
      // The other half of the contract: reading a cookie must not become a way around the
      // password. An unlocked cookie is the only thing that may stand in for the token.
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Still locked" });
      await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: "open-sesame" });
      await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      const started = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: created.body.slug, deviceId: "00000000-0000-4000-8000-00000000bb02" });

      expect(started.status).toBe(403);
    });

    it("runs a whole response through the public API", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const questions = await request(app as never)
        .get(`/api/form/getForm?formId=${form.formId}`)
        .set(auth(user.cookie));
      const questionId = questions.body.questions[0].id as string;

      const deviceId = "00000000-0000-4000-8000-0000000000aa";
      const start = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: form.slug, deviceId });
      expect(start.status).toBe(200);
      expect(start.body.created).toBe(true);

      const draft = await request(app as never)
        .post("/api/public/form/saveDraft")
        .send({
          sessionId: start.body.sessionId,
          deviceId,
          answers: [{ questionId, value: "Halfway" }],
        });
      expect(draft.status).toBe(200);

      // A resume returns what was saved.
      const resumed = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: form.slug, deviceId });
      expect(resumed.body.created).toBe(false);
      expect(resumed.body.answers[questionId]).toBe("Halfway");

      const submitted = await request(app as never)
        .post("/api/public/form/submitForm")
        .send({
          sessionId: start.body.sessionId,
          deviceId,
          answers: [{ questionId, value: "Gopal" }],
        });
      expect(submitted.body.status).toBe("SUBMITTED");

      // The creator sees the response.
      const responses = await request(app as never)
        .get(`/api/form/response/listResponses?formId=${form.formId}`)
        .set(auth(user.cookie));
      expect(responses.body.total).toBe(1);
      expect(responses.body.responses[0].answers[0].valueText).toBe("Gopal");

      // A second submit from the same device is refused.
      const again = await request(app as never)
        .post("/api/public/form/submitForm")
        .send({ sessionId: start.body.sessionId, deviceId, answers: [] });
      expect(again.body.status).toBe("ALREADY_SUBMITTED");
    });

    it("reports every missing required answer at once", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Required" });
      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Name", isRequired: true });
      await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      const deviceId = "00000000-0000-4000-8000-0000000000bb";
      const start = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: created.body.slug, deviceId });

      const submitted = await request(app as never)
        .post("/api/public/form/submitForm")
        .send({ sessionId: start.body.sessionId, deviceId, answers: [] });

      // The failure is data, not an error: the renderer draws it.
      expect(submitted.status).toBe(200);
      expect(submitted.body.status).toBe("INVALID");
      expect(Object.keys(submitted.body.fieldErrors)).toHaveLength(1);
    });

    it("refuses to touch a session belonging to another device", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const start = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: form.slug, deviceId: "00000000-0000-4000-8000-0000000000cc" });

      const response = await request(app as never)
        .post("/api/public/form/saveDraft")
        .send({
          sessionId: start.body.sessionId,
          deviceId: "00000000-0000-4000-8000-0000000000dd",
          answers: [],
        });

      expect(response.status).toBe(403);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("locks out password guessing with 429", async () => {
      const user = await signUp();
      const created = await request(app as never)
        .post("/api/form/createForm")
        .set(auth(user.cookie))
        .send({ title: "Brute force" });
      await request(app as never)
        .post("/api/form/question/createQuestion")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, kind: "SHORT_TEXT", label: "Name" });
      await request(app as never)
        .post("/api/form/setFormPassword")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, password: "open-sesame" });
      await request(app as never)
        .post("/api/form/setFormStatus")
        .set(auth(user.cookie))
        .send({ formId: created.body.id, status: "PUBLISHED" });

      const attempts: number[] = [];
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await request(app as never)
          .post("/api/public/form/unlockForm")
          .send({ slug: created.body.slug, password: `guess-${attempt}` });
        attempts.push(response.status);
      }

      // The budget is 10, so the last two must be refused.
      expect(attempts.filter((status) => status === 200)).toHaveLength(10);
      expect(attempts.at(-1)).toBe(429);

      const refused = await request(app as never)
        .post("/api/public/form/unlockForm")
        .send({ slug: created.body.slug, password: "open-sesame" });
      expect(refused.status).toBe(429);
      expect(refused.body.code).toBe("TOO_MANY_REQUESTS");
    });
  });

  // ── Analytics and export ─────────────────────────────────────────────────────

  describe("responses and analytics", () => {
    it("reports time to complete for a form that has a response", async () => {
      /*
       * This exists because the empty case looked healthy while the populated one did not.
       * The service returned `max: Infinity` for the open-ended top bucket, which zod v4's
       * `z.number()` rejects, so the router's output validation turned every
       * time-to-complete query on a form with a response into a 500 — while a service-level
       * test passed, because output validation only happens in the tRPC layer.
       */
      const user = await signUp();
      const form = await publishedForm(user.cookie);
      const deviceId = "00000000-0000-4000-8000-00000000feed";

      const question = await request(app as never)
        .get(`/api/form/question/listQuestions?formId=${form.formId}`)
        .set(auth(user.cookie));

      const started = await request(app as never)
        .post("/api/public/form/startSession")
        .send({ slug: form.slug, deviceId });

      await request(app as never)
        .post("/api/public/form/submitForm")
        .send({
          sessionId: started.body.sessionId,
          deviceId,
          answers: [{ questionId: question.body[0].id, value: "Gopal" }],
        });

      const timing = await request(app as never)
        .get(`/api/form/analytics/getTimeToComplete?formId=${form.formId}`)
        .set(auth(user.cookie));

      expect(timing.status).toBe(200);
      expect(timing.body.count).toBe(1);
      expect(timing.body.averageSeconds).not.toBeNull();

      // Every bucket is a finite bound, or null for the open-ended top one.
      const top = timing.body.histogram[timing.body.histogram.length - 1];
      expect(top.max).toBeNull();
      for (const bucket of timing.body.histogram) {
        if (bucket.max !== null) expect(Number.isFinite(bucket.max)).toBe(true);
      }
      expect(
        timing.body.histogram.reduce((sum: number, bucket: { count: number }) => sum + bucket.count, 0),
      ).toBe(1);
    });

    it("reports zero rather than dividing by zero for a new form", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const funnel = await request(app as never)
        .get(`/api/form/analytics/getFunnel?formId=${form.formId}`)
        .set(auth(user.cookie));

      expect(funnel.status).toBe(200);
      expect(funnel.body.views).toBe(0);
      expect(funnel.body.overallRate).toBe(0);
    });

    it("exports CSV with a header row", async () => {
      const user = await signUp();
      const form = await publishedForm(user.cookie);

      const response = await request(app as never)
        .get(`/api/form/response/exportCsv?formId=${form.formId}`)
        .set(auth(user.cookie));

      expect(response.status).toBe(200);
      expect(response.body.csv).toContain("Name");
    });

    it("keeps another user's analytics out of reach", async () => {
      const owner = await signUp();
      const stranger = await signUp();
      const form = await publishedForm(owner.cookie);

      const response = await request(app as never)
        .get(`/api/form/analytics/getFormAnalytics?formId=${form.formId}`)
        .set(auth(stranger.cookie));

      expect(response.status).toBe(403);
    });
  });

  // ── Transport concerns ───────────────────────────────────────────────────────

  describe("transport", () => {
    it("serves the OpenAPI document with a cookie security scheme", async () => {
      const response = await request(app as never).get("/openapi.json");

      expect(response.status).toBe(200);
      expect(response.body.components.securitySchemes.sessionCookie).toMatchObject({
        type: "apiKey",
        in: "cookie",
      });
    });

    it("allows the configured origin and refuses others", async () => {
      const allowed = await request(app as never).get("/health").set("Origin", "http://localhost:3000");
      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

      const refused = await request(app as never)
        .get("/health")
        .set("Origin", "http://evil.example.com");
      expect(refused.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("echoes a request id back", async () => {
      const response = await request(app as never)
        .get("/health")
        .set("x-request-id", "test-request-id");

      expect(response.headers["x-request-id"]).toBe("test-request-id");
    });

    it("returns a generic 404 for a route that does not exist", async () => {
      const response = await request(app as never).get("/api/nope");

      expect(response.status).toBe(404);
    });
  });
});
