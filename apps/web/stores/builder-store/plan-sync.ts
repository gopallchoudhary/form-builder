import type { FormDefinition, QuestionDefinition } from "@repo/services/form/model";

/**
 * The difference between two form definitions, expressed as the tRPC calls that would make
 * the server match the second one.
 *
 * This is a pure function on purpose. The store owns the local definition, and the
 * mutations are the only thing that makes it durable, so the diff is the part most worth
 * testing — and it is the part that is impossible to test while it lives inside a
 * debounced effect.
 */

export type SyncOperation =
  | { type: "updateSettings"; formId: string; patch: Record<string, unknown> }
  | {
      type: "createPage";
      formId: string;
      /** The client-minted id, so the caller can swap in the server's. */
      id: string;
      title: string | null;
      description: string | null;
    }
  | { type: "updatePage"; formId: string; pageId: string; patch: Record<string, unknown> }
  | { type: "deletePage"; formId: string; pageId: string }
  | { type: "reorderPages"; formId: string; pageIds: string[] }
  | {
      type: "createQuestion";
      formId: string;
      id: string;
      pageId: string | null;
      question: Omit<QuestionDefinition, "id">;
    }
  | {
      type: "updateQuestion";
      formId: string;
      questionId: string;
      patch: Record<string, unknown>;
    }
  | { type: "deleteQuestion"; formId: string; questionId: string }
  | { type: "reorderQuestions"; formId: string; pageId: string | null; questionIds: string[] };

/** Settings that live on the form row, as opposed to pages and questions. */
const SETTINGS_KEYS = [
  "title",
  "description",
  "layoutMode",
  "themeKey",
  "showProgress",
  "allowBack",
  "oneResponsePerDevice",
  "maxResponses",
  "closesAt",
  "thankYouTitle",
  "thankYouMessage",
  "thankYouRedirectUrl",
] as const satisfies readonly (keyof FormDefinition)[];

const PAGE_KEYS = ["title", "description"] as const satisfies readonly (keyof FormDefinition["pages"][number])[];

/**
 * `position` is deliberately not diffed per row.
 *
 * It is part of `QuestionDefinition` because the store and the service both need it, but
 * a drag is one intent: diffing positions would turn a single reorder into an update per
 * question *plus* the reorder. Order is carried by `reorderQuestions`, which takes the
 * whole ordered list and renumbers server-side. `createQuestion` still sends a position,
 * because a new question has to land in the right place before any reorder happens.
 */
const QUESTION_KEYS = [
  "pageId",
  "kind",
  "label",
  "description",
  "placeholder",
  "isRequired",
  "settings",
] as const satisfies readonly (keyof QuestionDefinition)[];

/** `settings` is stored as jsonb, so equal JSON means "unchanged". */
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function pick<T extends object, K extends readonly (keyof T)[]>(source: T, keys: K) {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) result[key as string] = value;
  }
  return result;
}

function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
  jsonKeys: readonly string[] = [],
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  let dirty = false;

  for (const key of keys) {
    if (jsonKeys.includes(key)) {
      if (!sameJson(before[key], after[key])) {
        patch[key] = after[key];
        dirty = true;
      }
      continue;
    }
    if (!Object.is(before[key], after[key])) {
      patch[key] = after[key];
      dirty = true;
    }
  }

  return dirty ? patch : null;
}

const byPosition = (a: { position: string }, b: { position: string }) =>
  Number(a.position) - Number(b.position);

/**
 * The order every page is meant to be in.
 *
 * In `STEP` layout there are no pages, so its questions are ordered globally; in `PAGED`
 * they are ordered within their own page. Getting this wrong silently scrambles the
 * respondent's form, so the layout is taken from the *new* definition.
 */
function questionOrder(
  definition: Pick<FormDefinition, "layoutMode" | "pages" | "questions">,
): Map<string | null, string[]> {
  const order = new Map<string | null, string[]>();
  const questions = [...definition.questions].sort(byPosition);

  if (definition.layoutMode === "STEP") {
    order.set(null, questions.map((question) => question.id));
    return order;
  }

  const pages = [...definition.pages].sort(byPosition);
  for (const page of pages) {
    order.set(
      page.id,
      questions.filter((question) => question.pageId === page.id).map((question) => question.id),
    );
  }
  // Questions with no page still need an order, or a reorder of one page would drop them.
  const orphans = questions.filter((question) => question.pageId === null);
  if (orphans.length > 0) order.set(null, orphans.map((question) => question.id));

  return order;
}

/**
 * Plan the calls that take the server from `before` to `after`.
 *
 * `before` is the definition as it was last known to be persisted, so it may be null for a
 * form that exists but has never been synced in this session.
 */
export function planSync(
  before: FormDefinition | null,
  after: FormDefinition,
): SyncOperation[] {
  const operations: SyncOperation[] = [];
  const formId = after.id;

  if (!before) {
    // The server state is unknown, so there is nothing safe to diff against. Guessing
    // would mean creating pages and questions that may already exist, and — worse —
    // deleting the ones the diff could not see. The store is hydrated from `getForm`
    // before it can be edited, so this only happens if autosave is wired up wrongly.
    return operations;
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  const settingsPatch = diffOf(
    pick(before, SETTINGS_KEYS),
    pick(after, SETTINGS_KEYS),
    SETTINGS_KEYS,
    ["closesAt"],
  );
  if (settingsPatch) {
    operations.push({ type: "updateSettings", formId, patch: settingsPatch });
  }

  // ── Pages ───────────────────────────────────────────────────────────────────
  const beforePages = new Map(before.pages.map((page) => [page.id, page]));
  const afterPages = new Map(after.pages.map((page) => [page.id, page]));

  for (const page of after.pages) {
    const existing = beforePages.get(page.id);
    if (!existing) {
      operations.push({
        type: "createPage",
        formId,
        id: page.id,
        title: page.title,
        description: page.description,
      });
      continue;
    }
    const patch = diffOf(
      pick(existing, PAGE_KEYS),
      pick(page, PAGE_KEYS),
      PAGE_KEYS,
    );
    if (patch) operations.push({ type: "updatePage", formId, pageId: page.id, patch });
  }

  for (const page of before.pages) {
    if (!afterPages.has(page.id)) {
      operations.push({ type: "deletePage", formId, pageId: page.id });
    }
  }

  // Order is compared as an ordered list, not as a set: sorting the ids first would make
  // a drag indistinguishable from no change, and the reorder would never be sent.
  const beforePageOrder = [...before.pages].sort(byPosition).map((page) => page.id);
  const afterPageOrder = [...after.pages].sort(byPosition).map((page) => page.id);
  if (!sameJson(beforePageOrder, afterPageOrder)) {
    operations.push({ type: "reorderPages", formId, pageIds: afterPageOrder });
  }

  // ── Questions ───────────────────────────────────────────────────────────────
  const beforeQuestions = new Map(before.questions.map((question) => [question.id, question]));
  const afterQuestions = new Map(after.questions.map((question) => [question.id, question]));

  for (const question of after.questions) {
    const existing = beforeQuestions.get(question.id);
    if (!existing) {
      operations.push({
        type: "createQuestion",
        formId,
        id: question.id,
        pageId: question.pageId,
        question: pick(question, QUESTION_KEYS) as Omit<QuestionDefinition, "id">,
      });
      continue;
    }
    const patch = diffOf(
      pick(existing, QUESTION_KEYS),
      pick(question, QUESTION_KEYS),
      QUESTION_KEYS,
      ["settings"],
    );
    if (patch) {
      operations.push({ type: "updateQuestion", formId, questionId: question.id, patch });
    }
  }

  for (const question of before.questions) {
    if (!afterQuestions.has(question.id)) {
      operations.push({ type: "deleteQuestion", formId, questionId: question.id });
    }
  }

  // ── Order ───────────────────────────────────────────────────────────────────
  // Only the groups whose order actually changed are sent, so typing in the inspector
  // does not renumber the whole form.
  const beforeOrder = questionOrder(before);
  for (const [pageId, questionIds] of questionOrder(after)) {
    const previous = beforeOrder.get(pageId);
    if (previous === undefined) continue;
    if (questionIds.length > 1 && !sameJson(previous, questionIds)) {
      operations.push({ type: "reorderQuestions", formId, pageId, questionIds });
    }
  }

  return operations;
}
