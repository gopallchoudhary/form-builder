/**
 * The Phase 8 gate, checked two ways.
 *
 * 1. Every number the analytics UI shows is recomputed with raw SQL against the same
 *    database and compared to the API's answer. A chart that disagrees with the database is
 *    worse than no chart.
 * 2. A second creator's analytics for the same form are refused, and one creator's overview
 *    never mentions another creator's form.
 */
import { Client } from "pg";

const API = "http://localhost:8000/api";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — run this through `dotenv --` or export it");
}

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

function equal(label: string, actual: unknown, expected: unknown) {
  check(label, actual === expected, `ui=${JSON.stringify(actual)} sql=${JSON.stringify(expected)}`);
}

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<{ status: number; body: T }> {
  const response = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: T = {} as T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    parsed = text as unknown as T;
  }
  return { status: response.status, body: parsed };
}

const device = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function signUp(label: string) {
  const response = await fetch(`${API}/authentication/createUserWithEmailAndPassword`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      password: "a-very-long-password",
      fullName: label,
    }),
  });
  const token = /authentication-token=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? "";
  return `authentication-token=${token}`;
}

async function main() {
  const sql = new Client({ connectionString });
  await sql.connect();

  const owner = await signUp("owner");
  const stranger = await signUp("stranger");

  const { body: form } = await call<{ id: string; slug: string }>(
    "POST",
    "/form/createForm",
    { title: "Gate check" },
    owner,
  );
  const formId = form.id;

  // Two chartable questions plus one free-text, so every UI panel has data to draw.
  const { body: rating } = await call<{ id: string }>(
    "POST",
    "/form/question/createQuestion",
    {
      formId,
      kind: "RATING",
      label: "Rate us",
      settings: { scale: 5, style: "STAR" },
    },
    owner,
  );
  const { body: choice } = await call<{ id: string }>(
    "POST",
    "/form/question/createQuestion",
    {
      formId,
      kind: "SINGLE_CHOICE",
      label: "Plan",
      settings: { options: [{ id: "free", label: "Free" }, { id: "pro", label: "Pro" }] },
    },
    owner,
  );
  const { body: note } = await call<{ id: string }>(
    "POST",
    "/form/question/createQuestion",
    { formId, kind: "LONG_TEXT", label: "Anything else" },
    owner,
  );

  await call("POST", "/form/setFormStatus", { formId, status: "PUBLISHED" }, owner);

  // Four respondents: three finish, one abandons part-way.
  const answersFor = (ratingValue: number, plan: string, comment: string) => [
    { questionId: rating.id, value: ratingValue },
    { questionId: choice.id, value: plan },
    { questionId: note.id, value: comment },
  ];

  for (let index = 1; index <= 3; index += 1) {
    const { body: session } = await call<{ sessionId: string }>(
      "POST",
      "/public/form/startSession",
      { slug: form.slug, deviceId: device(index) },
    );

    /*
     * Save a draft naming the last question before submitting, the way the runtime does on
     * every step. Submitting directly would leave no `QUESTION_VIEW` rows at all, so drop-off
     * would read 0 reached for every question — correct for that data, and a gate that
     * quietly passed on a flow nothing actually uses.
     */
    await call("POST", "/public/form/saveDraft", {
      sessionId: session.sessionId,
      deviceId: device(index),
      answers: answersFor(index, index === 2 ? "pro" : "free", `Comment ${index}`),
      currentQuestionId: note.id,
    });

    const submitted = await call<{ status: string }>(
      "POST",
      "/public/form/submitForm",
      {
        sessionId: session.sessionId,
        deviceId: device(index),
        answers: answersFor(index, index === 2 ? "pro" : "free", `Comment ${index}`),
      },
    );
    if (submitted.body.status !== "SUBMITTED") throw new Error("seed submit failed");
  }

  // The fourth opens the form and answers only the first question.
  const { body: abandoner } = await call<{ sessionId: string }>(
    "POST",
    "/public/form/startSession",
    { slug: form.slug, deviceId: device(9) },
  );
  await call("POST", "/public/form/saveDraft", {
    sessionId: abandoner.sessionId,
    deviceId: device(9),
    answers: [{ questionId: rating.id, value: 2 }],
    currentQuestionId: rating.id,
  });

  // ── 1. The UI's numbers against raw SQL ────────────────────────────────────
  console.log("Numbers against raw SQL");

  const headline = await call<{
    totals: { views: number; starts: number; completions: number; completionRate: number };
  }>("GET", `/form/analytics/getFormAnalytics?formId=${formId}`, undefined, owner);

  const sqlViews = await sql.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM form_events WHERE form_id = $1 AND type = 'VIEW'`,
    [formId],
  );
  const sqlStarts = await sql.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM form_events WHERE form_id = $1 AND type = 'START'`,
    [formId],
  );
  const sqlCompletions = await sql.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM form_sessions WHERE form_id = $1 AND status = 'COMPLETED'`,
    [formId],
  );

  equal("opened matches the VIEW events", headline.body.totals.views, Number(sqlViews.rows[0]?.n));
  equal("started matches the START events", headline.body.totals.starts, Number(sqlStarts.rows[0]?.n));
  equal(
    "responses match the completed sessions",
    headline.body.totals.completions,
    Number(sqlCompletions.rows[0]?.n),
  );

  const expectedRate = Number(sqlCompletions.rows[0]?.n) / Number(sqlViews.rows[0]?.n);
  equal("completion rate is responses over opened", headline.body.totals.completionRate, expectedRate);

  const funnel = await call<{
    views: number;
    starts: number;
    completions: number;
    viewToStartRate: number;
    overallRate: number;
  }>("GET", `/form/analytics/getFunnel?formId=${formId}`, undefined, owner);
  equal("funnel views match", funnel.body.views, Number(sqlViews.rows[0]?.n));
  equal("funnel completions match", funnel.body.completions, Number(sqlCompletions.rows[0]?.n));
  equal("funnel view-to-start matches", funnel.body.viewToStartRate, Number(sqlStarts.rows[0]?.n) / Number(sqlViews.rows[0]?.n));
  equal("funnel overall matches", funnel.body.overallRate, expectedRate);

  // The trend's last point must account for every event in range.
  const trend = await call<{ series: Array<{ views: number; starts: number; submissions: number }> }>(
    "GET",
    `/form/analytics/getFormAnalytics?formId=${formId}`,
    undefined,
    owner,
  );
  const summedViews = trend.body.series.reduce((sum: number, point) => sum + point.views, 0);
  equal("the trend accounts for every view", summedViews, Number(sqlViews.rows[0]?.n));

  const dropOff = await call<
    Array<{ questionId: string; label: string; reached: number; answered: number }>
  >("GET", `/form/analytics/getQuestionDropOff?formId=${formId}`, undefined, owner);

  for (const question of dropOff.body) {
    const sqlAnswered = await sql.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM form_answers
        WHERE question_id = $1 AND is_draft = false
          AND session_id IN (SELECT id FROM form_sessions WHERE form_id = $2 AND status = 'COMPLETED')`,
      [question.questionId, formId],
    );
    equal(
      `answered matches SQL for "${question.label}"`,
      question.answered,
      Number(sqlAnswered.rows[0]?.n),
    );
  }

  /*
   * Drop-off is measured over *completed* sessions, so the abandoned response is excluded —
   * and that is observable rather than a matter of trust. It produced a `QUESTION_VIEW` for
   * "Rate us" (a draft save naming it), yet that question's `reached` is still 0, because
   * nobody who *finished* got that far.
   */
  const ratingRow = dropOff.body.find((row) => row.questionId === rating.id);
  const noteRow = dropOff.body.find((row) => row.questionId === note.id);
  const abandonedViews = await sql.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM form_events
      WHERE form_id = $1 AND type = 'QUESTION_VIEW' AND question_id = $2`,
    [formId, rating.id],
  );

  equal("answered counts only finished responses", ratingRow?.answered, 3);
  equal("the part-finished response is excluded from reached", ratingRow?.reached, 0);
  equal(
    "it did leave a question-view event behind",
    Number(abandonedViews.rows[0]?.n),
    1,
  );
  equal("the question they did reach is counted", noteRow?.reached, 3);

  const distribution = await call<{
    total: number;
    buckets: Array<{ value: string; label: string; count: number }>;
  }>(
    "GET",
    `/form/analytics/getAnswerDistribution?formId=${formId}&questionId=${choice.id}`,
    undefined,
    owner,
  );
  const sqlPlans = await sql.query<{ value_text: string; n: string }>(
    `SELECT value_text, count(*)::text AS n FROM form_answers
      WHERE question_id = $1 AND is_draft = false GROUP BY value_text`,
    [choice.id],
  );
  const sqlTotal = sqlPlans.rows.reduce((sum: number, row) => sum + Number(row.n), 0);
  equal("the distribution total matches SQL", distribution.body.total, sqlTotal);
  for (const bucket of distribution.body.buckets) {
    const row = sqlPlans.rows.find((entry) => entry.value_text === bucket.value);
    equal(
      `the "${bucket.label}" bucket matches SQL`,
      bucket.count,
      row ? Number(row.n) : 0,
    );
  }

  const timing = await call<{ count: number; averageSeconds: number | null }>(
    "GET",
    `/form/analytics/getTimeToComplete?formId=${formId}`,
    undefined,
    owner,
  );
  equal("timing counts the completed responses", timing.body.count, Number(sqlCompletions.rows[0]?.n));

  const overview = await call<{
    totals: { forms: number; published: number; views: number; completions: number };
    forms: Array<{ id: string }>;
  }>("GET", "/form/analytics/getOverview", undefined, owner);
  equal("the overview counts this creator's forms", overview.body.totals.forms, 1);
  equal("the overview's views match", overview.body.totals.views, Number(sqlViews.rows[0]?.n));
  equal(
    "the overview's completions match",
    overview.body.totals.completions,
    Number(sqlCompletions.rows[0]?.n),
  );

  // ── 2. Ownership ────────────────────────────────────────────────────────────
  console.log("\nOwnership");

  for (const path of [
    `getFormAnalytics?formId=${formId}`,
    `getFunnel?formId=${formId}`,
    `getQuestionDropOff?formId=${formId}`,
    `getTimeToComplete?formId=${formId}`,
    `getAnswerDistribution?formId=${formId}&questionId=${choice.id}`,
  ]) {
    const refused = await call("GET", `/form/analytics/${path}`, undefined, stranger);
    check(`${path.split("?")[0]} refuses another creator`, refused.status === 403, refused.status);
  }

  // A stranger's own form must not appear in the owner's overview, and vice versa.
  const { body: theirForm } = await call<{ id: string; slug: string }>(
    "POST",
    "/form/createForm",
    { title: "Theirs" },
    stranger,
  );
  await call("POST", "/form/question/createQuestion", { formId: theirForm.id, kind: "SHORT_TEXT", label: "Theirs" }, stranger);
  await call("POST", "/form/setFormStatus", { formId: theirForm.id, status: "PUBLISHED" }, stranger);

  const ownerAfter = await call<{ totals: { forms: number }; forms: Array<{ id: string }> }>(
    "GET",
    "/form/analytics/getOverview",
    undefined,
    owner,
  );
  equal("the overview still shows one form", ownerAfter.body.totals.forms, 1);
  check(
    "another creator's form never appears",
    ownerAfter.body.forms.every((entry: { id: string }) => entry.id !== theirForm.id),
  );

  const strangerOverview = await call<{ totals: { forms: number } }>(
    "GET",
    "/form/analytics/getOverview",
    undefined,
    stranger,
  );
  equal("the stranger sees only their own form", strangerOverview.body.totals.forms, 1);

  await sql.end();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

void main();
