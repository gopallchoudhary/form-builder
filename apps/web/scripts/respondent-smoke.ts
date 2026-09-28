/**
 * Drives the respondent journey against a running API, in the same order the runtime does.
 *
 * The unit tests cover the navigation and validation rules; this covers the *contract* —
 * that the endpoints the runtime calls accept what it sends, that the view events land,
 * that time-to-complete has a start, and that the password gate's cookie really unlocks.
 */

const API = "http://localhost:8000/api";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`, detail === undefined ? "" : detail);
  }
}

interface Session {
  cookie: string;
}

async function call<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; body: T; setCookie: string | null }> {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: T = {} as T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    parsed = text as unknown as T;
  }

  return {
    status: response.status,
    body: parsed,
    setCookie: response.headers.get("set-cookie"),
  };
}

const device = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function newOwner(): Promise<Session> {
  const response = await fetch(`${API}/authentication/createUserWithEmailAndPassword`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: "a-very-long-password",
      fullName: "Runtime Test",
    }),
  });

  const setCookie = response.headers.get("set-cookie") ?? "";
  const token = /authentication-token=([^;]+)/.exec(setCookie)?.[1] ?? "";
  return { cookie: `authentication-token=${token}` };
}

interface Seeded {
  id: string;
  slug: string;
  questionIds: Record<string, string>;
  pageIds: string[];
}

async function seed(
  owner: Session,
  title: string,
  build: (formId: string) => Promise<{ questionIds: Record<string, string>; pageIds: string[] }>,
): Promise<Seeded> {
  const created = await call<{ id: string; slug: string }>(
    "POST",
    "/form/createForm",
    { title },
    owner.cookie,
  );
  const { questionIds, pageIds } = await build(created.body.id);

  const published = await call(
    "POST",
    "/form/setFormStatus",
    { formId: created.body.id, status: "PUBLISHED" },
    owner.cookie,
  );
  check(`"${title}" published`, published.status === 200, published.body);

  return { id: created.body.id, slug: created.body.slug, questionIds, pageIds };
}

async function question(
  owner: Session,
  formId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const created = await call<{ id: string }>("POST", "/form/question/createQuestion", { formId, ...body }, owner.cookie);
  if (created.status !== 200) throw new Error(`createQuestion failed: ${JSON.stringify(created.body)}`);
  return created.body.id;
}

async function page(owner: Session, formId: string, title: string): Promise<string> {
  const created = await call<{ id: string }>("POST", "/form/page/createPage", { formId, title }, owner.cookie);
  if (created.status !== 200) throw new Error(`createPage failed: ${JSON.stringify(created.body)}`);
  return created.body.id;
}

async function main() {
  const owner = await newOwner();
  console.log("owner created\n");

  // ── Stepper layout ─────────────────────────────────────────────────────────
  console.log("STEP layout");
  const stepper = await seed(owner, "Runtime stepper", async (formId) => {
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Your name", isRequired: true });
    const q2 = await question(owner, formId, { kind: "YES_NO", label: "Recommend us?" });
    const q3 = await question(owner, formId, { kind: "RATING", label: "Rate us", settings: { scale: 5, style: "STAR" } });
    return { questionIds: { q1, q2, q3 }, pageIds: [] };
  });

  const opened = await call<{ available: boolean; locked: boolean; form: unknown }>(
    "GET",
    `/public/form/getFormBySlug?slug=${stepper.slug}`,
    undefined,
  );
  check("opens without a password", opened.status === 200 && opened.body.available && !opened.body.locked);

  // The runtime always has a form on screen before the session exists.
  const first = await call<{ sessionId: string; created: boolean; alreadyCompleted: boolean }>(
    "POST",
    "/public/form/startSession",
    { slug: stepper.slug, deviceId: device(1) },
  );
  check("startSession creates a session", first.status === 200 && first.body.created);

  const answeredOne = await call(
    "POST",
    "/public/form/saveDraft",
    {
      sessionId: first.body.sessionId,
      deviceId: device(1),
      answers: [{ questionId: stepper.questionIds.q1, value: "Gopal" }],
      currentQuestionId: stepper.questionIds.q1,
    },
  );
  check("draft saves the first answer", answeredOne.status === 200, answeredOne.body);

  // The same save again, naming the same question: no second view.
  await call("POST", "/public/form/saveDraft", {
    sessionId: first.body.sessionId,
    deviceId: device(1),
    answers: [{ questionId: stepper.questionIds.q1, value: "Gopal" }],
    currentQuestionId: stepper.questionIds.q1,
  });

  await call("POST", "/public/form/saveDraft", {
    sessionId: first.body.sessionId,
    deviceId: device(1),
    answers: [{ questionId: stepper.questionIds.q2, value: true }],
    currentQuestionId: stepper.questionIds.q2,
  });

  // A refresh: same device, new call, and the draft comes back.
  const resumed = await call<{ created: boolean; answers: Record<string, unknown>; currentQuestionId: string | null }>(
    "POST",
    "/public/form/startSession",
    { slug: stepper.slug, deviceId: device(1) },
  );
  check("a refresh resumes the same session", resumed.status === 200 && resumed.body.created === false);
  check(
    "a refresh keeps the answers",
    resumed.body.answers[stepper.questionIds.q1!] === "Gopal",
    resumed.body.answers,
  );
  check(
    "a refresh resumes at the question it stopped on",
    resumed.body.currentQuestionId === stepper.questionIds.q2,
    resumed.body.currentQuestionId,
  );

  const submitted = await call<{ status: string }>("POST", "/public/form/submitForm", {
    sessionId: first.body.sessionId,
    deviceId: device(1),
    answers: [
      { questionId: stepper.questionIds.q1, value: "Gopal" },
      { questionId: stepper.questionIds.q2, value: true },
      { questionId: stepper.questionIds.q3, value: 5 },
    ],
  });
  check("submit succeeds", submitted.status === 200 && submitted.body.status === "SUBMITTED", submitted.body);

  // Time to complete needs the first VIEW, which is emitted before START.
  const timing = await call<{ count: number; averageSeconds: number | null }>(
    "GET",
    `/form/analytics/getTimeToComplete?formId=${stepper.id}`,
    undefined,
    owner.cookie,
  );
  check("time to complete has a start", timing.body.count === 1 && timing.body.averageSeconds !== null, timing.body);

  const dropOff = await call<{ length: number }>(
    "GET",
    `/form/analytics/getQuestionDropOff?formId=${stepper.id}`,
    undefined,
    owner.cookie,
  );
  check("drop-off reports every question", (dropOff.body as unknown as unknown[]).length === 3, dropOff.body);

  // One response per device.
  const repeat = await call<{ alreadyCompleted: boolean }>("POST", "/public/form/startSession", {
    slug: stepper.slug,
    deviceId: device(1),
  });
  check("the same device cannot answer twice", repeat.body.alreadyCompleted === true, repeat.body);

  const honestSecond = await call<{ status: string }>("POST", "/public/form/submitForm", {
    sessionId: first.body.sessionId,
    deviceId: device(1),
  });
  check("a second submit is refused", honestSecond.body.status === "ALREADY_SUBMITTED", honestSecond.body);

  // ── Paged layout ───────────────────────────────────────────────────────────
  console.log("\nPAGED layout");
  const paged = await seed(owner, "Runtime paged", async (formId) => {
    const p1 = await page(owner, formId, "About you");
    const p2 = await page(owner, formId, "Feedback");
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Your name", isRequired: true, pageId: p1 });
    const q2 = await question(owner, formId, { kind: "RATING", label: "Rate us", settings: { scale: 10, style: "STAR" }, pageId: p2 });
    return { questionIds: { q1, q2 }, pageIds: [p1, p2] };
  });

  const pagedSession = await call<{ sessionId: string }>("POST", "/public/form/startSession", {
    slug: paged.slug,
    deviceId: device(2),
  });

  const pageOne = await call(
    "POST",
    "/public/form/saveDraft",
    {
      sessionId: pagedSession.body.sessionId,
      deviceId: device(2),
      answers: [{ questionId: paged.questionIds.q1, value: "Priya" }],
      currentPageId: paged.pageIds[0],
    },
  );
  check("a page draft saves", pageOne.status === 200, pageOne.body);

  const pageTwo = await call(
    "POST",
    "/public/form/saveDraft",
    {
      sessionId: pagedSession.body.sessionId,
      deviceId: device(2),
      answers: [{ questionId: paged.questionIds.q2, value: 9 }],
      currentPageId: paged.pageIds[1],
    },
  );
  check("the second page saves", pageTwo.status === 200, pageTwo.body);

  const pagedSubmit = await call<{ status: string }>("POST", "/public/form/submitForm", {
    sessionId: pagedSession.body.sessionId,
    deviceId: device(2),
    answers: [
      { questionId: paged.questionIds.q1, value: "Priya" },
      { questionId: paged.questionIds.q2, value: 9 },
    ],
  });
  check("a paged form submits", pagedSubmit.body.status === "SUBMITTED", pagedSubmit.body);

  // ── Password gate ──────────────────────────────────────────────────────────
  console.log("\nPassword gate");
  const lockedForm = await seed(owner, "Runtime locked", async (formId) => {
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Your name", isRequired: true });
    return { questionIds: { q1 }, pageIds: [] };
  });

  const setPassword = await call(
    "POST",
    "/form/setFormPassword",
    { formId: lockedForm.id, password: "open-sesame" },
    owner.cookie,
  );
  check("a password can be set", setPassword.status === 200, setPassword.body);

  const gated = await call<{ locked: boolean; form: unknown }>(
    "GET",
    `/public/form/getFormBySlug?slug=${lockedForm.slug}`,
    undefined,
  );
  check("a protected form withholds its definition", gated.body.locked === true && !gated.body.form);

  const wrong = await call<{ unlocked: boolean }>("POST", "/public/form/unlockForm", {
    slug: lockedForm.slug,
    password: "nope",
  });
  check("a wrong password is refused", wrong.status === 200 && wrong.body.unlocked === false);

  const unlocked = await call<{ unlocked: boolean; unlockToken?: string }>(
    "POST",
    "/public/form/unlockForm",
    { slug: lockedForm.slug, password: "open-sesame" },
  );
  check("the right password unlocks", unlocked.body.unlocked === true && Boolean(unlocked.body.unlockToken));
  check(
    "the unlock is set as a cookie",
    Boolean(unlocked.setCookie?.includes(`form-unlock-${lockedForm.slug}`)),
    unlocked.setCookie,
  );

  const unlockCookie = decodeURIComponent(
    /form-unlock-[^=]+=([^;]+)/.exec(unlocked.setCookie ?? "")?.[1] ?? "",
  );
  const withCookie = await call<{ locked: boolean; form: unknown }>(
    "GET",
    `/public/form/getFormBySlug?slug=${lockedForm.slug}`,
    undefined,
    `form-unlock-${lockedForm.slug}=${encodeURIComponent(unlockCookie)}`,
  );
  check("the cookie alone opens the form on a later request", withCookie.body.locked === false && Boolean(withCookie.body.form));

  // An unlock token for one form must not open another.
  const otherForm = await seed(owner, "Runtime other", async (formId) => {
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Name", isRequired: true });
    await call("POST", "/form/setFormPassword", { formId, password: "different" }, owner.cookie);
    return { questionIds: { q1 }, pageIds: [] };
  });
  const crossForm = await call<{ locked: boolean }>(
    "GET",
    `/public/form/getFormBySlug?slug=${otherForm.slug}`,
    undefined,
    `form-unlock-${lockedForm.slug}=${encodeURIComponent(unlockCookie)}`,
  );
  check("an unlock does not carry across forms", crossForm.body.locked === true, crossForm.body);

  // A protected form still completes once unlocked.
  const lockedSession = await call<{ sessionId: string; alreadyCompleted: boolean }>(
    "POST",
    "/public/form/startSession",
    { slug: lockedForm.slug, deviceId: device(3), unlockToken: unlockCookie },
  );
  check("a session starts with the unlock token", lockedSession.status === 200 && Boolean(lockedSession.body.sessionId), lockedSession.body);

  await call("POST", "/public/form/saveDraft", {
    sessionId: lockedSession.body.sessionId,
    deviceId: device(3),
    answers: [{ questionId: lockedForm.questionIds.q1, value: "Someone" }],
    currentQuestionId: lockedForm.questionIds.q1,
  });

  const lockedSubmit = await call<{ status: string }>("POST", "/public/form/submitForm", {
    sessionId: lockedSession.body.sessionId,
    deviceId: device(3),
    answers: [{ questionId: lockedForm.questionIds.q1, value: "Someone" }],
  });
  check("a protected form completes once unlocked", lockedSubmit.body.status === "SUBMITTED", lockedSubmit.body);

  // ── The closed / full / expired states ─────────────────────────────────────
  console.log("\nDesigned states");

  /*
   * A closed form reports NOT_PUBLISHED, and that check runs before the deadline, so each
   * reason has to be set up on a form that is still published — otherwise every case below
   * would collapse into the first one.
   */

  const closedForm = await seed(owner, "Runtime closed", async (formId) => {
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Name", isRequired: true });
    return { questionIds: { q1 }, pageIds: [] };
  });
  await call("POST", "/form/setFormStatus", { formId: closedForm.id, status: "CLOSED" }, owner.cookie);
  const closed = await call<{ available: boolean; reason: string | null }>(
    "GET",
    `/public/form/getFormBySlug?slug=${closedForm.slug}`,
    undefined,
  );
  check("a closed form reports itself closed", closed.body.available === false && closed.body.reason === "NOT_PUBLISHED", closed.body);

  // A published form that already has one response, with a limit of one.
  const limited = await call("PATCH", "/form/updateFormSettings", { formId: paged.id, maxResponses: 1 }, owner.cookie);
  check("a response limit can be set", limited.status === 200, limited.body);
  const full = await call<{ available: boolean; reason: string | null }>(
    "GET",
    `/public/form/getFormBySlug?slug=${paged.slug}`,
    undefined,
  );
  check("a full form says it is full", full.body.available === false && full.body.reason === "LIMIT_REACHED", full.body);

  // A published form whose closing date has passed.
  const expiringForm = await seed(owner, "Runtime expiring", async (formId) => {
    const q1 = await question(owner, formId, { kind: "SHORT_TEXT", label: "Name", isRequired: true });
    return { questionIds: { q1 }, pageIds: [] };
  });
  const expiring = await call("PATCH", "/form/updateFormSettings", {
    formId: expiringForm.id,
    closesAt: new Date(Date.now() - 1000).toISOString(),
  }, owner.cookie);
  check("a past closing date can be set", expiring.status === 200, expiring.body);
  const expired = await call<{ available: boolean; reason: string | null }>(
    "GET",
    `/public/form/getFormBySlug?slug=${expiringForm.slug}`,
    undefined,
  );
  check("a past deadline says it has closed", expired.body.available === false && expired.body.reason === "EXPIRED", expired.body);

  const missing = await call<{ available: boolean; reason: string | null }>(
    "GET",
    "/public/form/getFormBySlug?slug=no-such-form",
    undefined,
  );
  check(
    "an unknown slug is reported as not found",
    missing.status === 200 && missing.body.available === false && missing.body.reason === "NOT_FOUND",
    missing.body,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

void main();
