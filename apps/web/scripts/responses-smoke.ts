/**
 * Exercises the responses surface against a running API: one response of every answer kind,
 * then the filters, the delete, and — the phase's gate — an export that survives a rename
 * and a delete.
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

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<{ status: number; body: T; setCookie: string | null }> {
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

  return { status: response.status, body: parsed, setCookie: response.headers.get("set-cookie") };
}

const device = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function owner(): Promise<string> {
  const response = await fetch(`${API}/authentication/createUserWithEmailAndPassword`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `responses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      password: "a-very-long-password",
      fullName: "Responses Test",
    }),
  });
  const token = /authentication-token=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? "";
  return `authentication-token=${token}`;
}

async function main() {
  const cookie = await owner();

  const { body: form } = await call<{ id: string; slug: string }>(
    "POST",
    "/form/createForm",
    { title: "Every kind" },
    cookie,
  );
  const formId = form.id;

  // One question per answer kind the table has to render differently.
  const kinds: Array<{ label: string; kind: string; extra?: Record<string, unknown>; answer: unknown }> = [
    { label: "Name", kind: "SHORT_TEXT", answer: "Gopal" },
    { label: "How we did", kind: "RATING", extra: { settings: { scale: 10, style: "STAR" } }, answer: 8 },
    { label: "Recommend", kind: "YES_NO", answer: true },
    {
      label: "What you use",
      kind: "MULTI_CHOICE",
      extra: { settings: { options: [{ id: "api", label: "The API" }, { id: "ui", label: "The UI" }] } },
      answer: ["api", "ui"],
    },
    {
      label: "Where you are",
      kind: "ADDRESS",
      extra: { settings: { fields: ["line1", "city", "country"] } },
      answer: { line1: "12 Bridge Street", city: "London", country: "United Kingdom" },
    },
    { label: "Team size", kind: "NUMBER", answer: 12 },
    { label: "Start date", kind: "DATE", answer: "2026-03-01" },
  ];

  const questionIds: Record<string, string> = {};
  for (const entry of kinds) {
    const { body } = await call<{ id: string }>(
      "POST",
      "/form/question/createQuestion",
      { formId, kind: entry.kind, label: entry.label, ...entry.extra },
      cookie,
    );
    questionIds[entry.label] = body.id;
  }

  await call("POST", "/form/setFormStatus", { formId, status: "PUBLISHED" }, cookie);

  // ── Two responses: one complete, one abandoned part-way ─────────────────────
  console.log("Collecting responses");
  const first = await call<{ sessionId: string }>("POST", "/public/form/startSession", {
    slug: form.slug,
    deviceId: device(1),
  });
  const complete = await call<{ status: string }>(
    "POST",
    "/public/form/submitForm",
    {
      sessionId: first.body.sessionId,
      deviceId: device(1),
      answers: kinds.map((entry) => ({ questionId: questionIds[entry.label], value: entry.answer })),
    },
  );
  check("a response with every kind submits", complete.body.status === "SUBMITTED", complete.body);

  const second = await call<{ sessionId: string }>("POST", "/public/form/startSession", {
    slug: form.slug,
    deviceId: device(2),
  });
  await call("POST", "/public/form/saveDraft", {
    sessionId: second.body.sessionId,
    deviceId: device(2),
    answers: [{ questionId: questionIds.Name, value: "Priya" }],
  });

  // ── The table's query ───────────────────────────────────────────────────────
  console.log("\nListing");
  const completed = await call<{ total: number; responses: Array<{ answers: unknown[] }> }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=COMPLETED`,
    undefined,
    cookie,
  );
  check("completed responses are listed", completed.body.total === 1, completed.body.total);
  check("every kind came back as an answer", completed.body.responses[0]?.answers.length === kinds.length, completed.body.responses[0]?.answers.length);

  const inProgress = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=IN_PROGRESS`,
    undefined,
    cookie,
  );
  check("a part-finished response is listed under in-progress", inProgress.body.total === 1, inProgress.body.total);

  const every = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=ALL`,
    undefined,
    cookie,
  );
  check("all combines them", every.body.total === 2, every.body.total);

  const searched = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=ALL&search=Priya`,
    undefined,
    cookie,
  );
  check("searching answers narrows the list", searched.body.total === 1, searched.body.total);

  const paged = await call<{ total: number; page: number; pageSize: number; responses: unknown[] }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=ALL&page=2&pageSize=1`,
    undefined,
    cookie,
  );
  check("pagination reports the total, not the page", paged.body.total === 2 && paged.body.responses.length === 1, paged.body);

  const today = new Date().toISOString().slice(0, 10);
  const ranged = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=ALL&from=${today}T00:00:00.000Z&to=${today}T23:59:59.999Z`,
    undefined,
    cookie,
  );
  check("a date range covering today finds both", ranged.body.total === 2, ranged.body.total);

  const future = new Date(Date.now() + 86_400_000).toISOString();
  const empty = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=ALL&from=${future}`,
    undefined,
    cookie,
  );
  check("a range in the future finds nothing", empty.body.total === 0, empty.body.total);

  // ── The phase's gate ────────────────────────────────────────────────────────
  console.log("\nExport survives the form being tidied up");
  const before_ = await call<{ csv: string }>(
    "GET",
    `/form/response/exportCsv?formId=${formId}`,
    undefined,
    cookie,
  );
  const headerBefore = before_.body.csv.split("\r\n")[0] ?? "";
  check("the export has a column per question", headerBefore.includes("Where you are") && headerBefore.includes("What you use"), headerBefore);

  await call("PATCH", "/form/question/updateQuestion", { questionId: questionIds.Name, label: "Full name" }, cookie);
  await call("DELETE", "/form/question/deleteQuestion", { questionId: questionIds["Team size"] }, cookie);

  const after_ = await call<{ csv: string }>(
    "GET",
    `/form/response/exportCsv?formId=${formId}`,
    undefined,
    cookie,
  );
  const [header, row] = after_.body.csv.split("\r\n");

  check("a renamed question takes its new header", header?.includes("Full name") === true, header);
  check("a deleted question keeps its column", header?.includes("Team size") === true, header);
  check("the deleted question's value survives", row?.includes("12") === true, row);
  check("the multi-select exports the labels the respondent saw", row?.includes("The API; The UI") === true, row);
  check("the address exports readable field labels", row?.includes("Address: 12 Bridge Street") === true && row?.includes("City: London") === true, row);

  // ── Deleting a response ─────────────────────────────────────────────────────
  console.log("\nDeleting a response");
  const target = completed.body.responses[0] as unknown as { sessionId: string };
  const deleted = await call(
    "DELETE",
    `/form/response/deleteResponse?formId=${formId}&sessionId=${target.sessionId}`,
    undefined,
    cookie,
  );
  check("a response can be deleted", deleted.status === 200, deleted.body);

  const afterDelete = await call<{ total: number }>(
    "GET",
    `/form/response/listResponses?formId=${formId}&status=COMPLETED`,
    undefined,
    cookie,
  );
  check("it is gone from the list", afterDelete.body.total === 0, afterDelete.body.total);

  const analytics = await call<{ totals: { completions: number } }>(
    "GET",
    `/form/analytics/getFormAnalytics?formId=${formId}`,
    undefined,
    cookie,
  );
  check("the totals follow the delete", analytics.body.totals.completions === 0, analytics.body.totals);

  const stillOurs = await call(
    "DELETE",
    `/form/response/deleteResponse?formId=${formId}&sessionId=${target.sessionId}`,
    undefined,
    cookie,
  );
  check("deleting it twice is not a crash", stillOurs.status === 404 || stillOurs.status === 200, stillOurs.status);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

void main();
