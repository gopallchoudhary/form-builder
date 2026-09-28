/**
 * Replays the builder's autosave against a running API with a real HTTP executor.
 *
 * Run it by hand, with both servers up and a session cookie in SMOKE_COOKIE:
 *
 *   pnpm --filter @repo/api dev
 *   pnpm --filter web dev
 *   SMOKE_COOKIE="authentication-token=..." pnpm --filter web exec tsx scripts/autosave-smoke.ts
 *
 * The unit tests use a fake executor, which proves the plan is right but not that the
 * shapes it produces are ones the server accepts. This closes that gap: the same
 * `planSync` + `runSync` the browser runs, talking to a real server.
 */
import { planSync } from "../stores/builder-store/plan-sync";
import { runSync, type SyncExecutor } from "../stores/builder-store/run-sync";
import type { BuilderShape } from "../stores/builder-store";

const API = "http://localhost:8000/api";
const cookie = process.env.SMOKE_COOKIE ?? ""; // eslint-disable-line turbo/no-undeclared-env-vars

/**
 * A fresh form each run. The plan is deliberately not idempotent — a duplicate question
 * label is a real conflict — so reusing a form would test the wrong thing.
 */
const created = (await (
  await fetch(`${API}/form/createForm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "Feedback survey" }),
  })
).json()) as { id: string; slug: string };

const formId = created.id;
console.log("fresh form:", created.slug);

let calls = 0;

async function post(path: string, body: unknown) {
  calls += 1;
  const response = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as never;
}

async function patch(path: string, body: unknown) {
  calls += 1;
  const response = await fetch(API + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

const executor: SyncExecutor = {
  updateSettings: (input) => patch("/form/updateFormSettings", input),
  createPage: (input) => post("/form/page/createPage", input),
  updatePage: (input) => patch("/form/page/updatePage", input),
  deletePage: (input) => post("/form/page/deletePage", input),
  reorderPages: (input) => post("/form/page/reorderPages", input),
  createQuestion: (input) => post("/form/question/createQuestion", input),
  updateQuestion: (input) => patch("/form/question/updateQuestion", input),
  deleteQuestion: (input) => post("/form/question/deleteQuestion", input),
  reorderQuestions: (input) => post("/form/question/reorderQuestions", input),
};

const get = async (path: string) => {
  const response = await fetch(API + path, { headers: { cookie } });
  return (await response.json()) as Record<string, unknown>;
};

const definition = (await get(`/form/getForm?formId=${formId}`)) as unknown as BuilderShape;
console.log("fetched:", definition.title, "|", definition.layoutMode, "| questions:", definition.questions.length);

/** A page section holding a rating and a multi-choice, the shape a creator would build. */
const localId = () => `local:${crypto.randomUUID()}`;

const pageId = localId();
const ratingId = localId();
const choiceId = localId();

const edited: BuilderShape = {
  ...definition,
  title: "Feedback survey (edited)",
  themeKey: "ink",
  layoutMode: "PAGED",
  pages: [...definition.pages, { id: pageId, title: "The fun part", description: null, position: "2.00" }],
  questions: [
    ...definition.questions,
    {
      id: ratingId,
      pageId,
      position: "1.00",
      kind: "RATING",
      label: "How likely are you to recommend us?",
      labelKey: "",
      description: null,
      placeholder: null,
      isRequired: true,
      settings: { scale: 10, style: "STAR", lowLabel: "Not at all", highLabel: "Very" },
    },
    {
      id: choiceId,
      pageId,
      position: "2.00",
      kind: "MULTI_CHOICE",
      label: "What do you use it for?",
      labelKey: "",
      description: null,
      placeholder: null,
      isRequired: false,
      settings: { options: [{ id: "api", label: "The API" }, { id: "ui", label: "The UI" }] },
    },
  ],
};

const before = calls;
const plan = planSync(definition, edited);
console.log("\nplan:");
for (const operation of plan) console.log("  -", operation.type);

const result = await runSync(edited, plan, executor);
console.log("\nhttp calls:", calls - before);
console.log("local ids replaced:", [...result.idMap.entries()].map(([k, v]) => `${k.slice(0, 11)}… -> ${v.slice(0, 8)}…`));

// The ids the store now holds must be the server's, or the next diff would try to create
// the same questions again.
const unresolved = [...result.idMap.values()].filter((id) => id.startsWith("local:"));
if (unresolved.length > 0) throw new Error("a local id survived the sync");

const after = (await get(`/form/getForm?formId=${formId}`)) as unknown as BuilderShape;
console.log("\nserver now:", after.title, "|", after.themeKey, "| pages:", after.pages.length, "| questions:", after.questions.length);
console.log("rating on the server:", JSON.stringify(after.questions.find((q) => q.id === result.idMap.get(ratingId))?.settings));

// A second plan with nothing changed must be empty, or autosave would loop.
const secondPlan = planSync(result.definition, result.definition);
console.log("plan after a clean sync:", secondPlan.length === 0 ? "empty (correct)" : JSON.stringify(secondPlan));
if (secondPlan.length !== 0) throw new Error("autosave would loop");

console.log("\nOK: create -> autosave -> persisted, with no second spurious call");
