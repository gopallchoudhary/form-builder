import type { RouterInputs } from "@repo/trpc/client";
import type { FormDefinition, QuestionDefinition } from "@repo/services/form/model";

import type { SyncOperation } from "./plan-sync";

/**
 * Executes a sync plan, resolving the ids of anything it creates.
 *
 * A plan is built from the store, where a new question or page has a `local:` id. The
 * server assigns the real one. Everything downstream in the same plan — a question on a
 * page that was just created, a reorder that lists both — has to be rewritten with the
 * server's ids before it can be sent, or the request names something that does not exist.
 *
 * So the creates run first, in dependency order, and the rest is rewritten around them.
 *
 * The input types are taken from the router rather than restated here, so a field renamed
 * on the server is a compile error in this file instead of a rejected request at runtime.
 */
type Inputs = RouterInputs;

export interface SyncExecutor {
  updateSettings(input: Inputs["form"]["updateFormSettings"]): Promise<unknown>;
  createPage(
    input: Inputs["formPage"]["createPage"],
  ): Promise<{ id: string; position: string }>;
  updatePage(input: Inputs["formPage"]["updatePage"]): Promise<unknown>;
  deletePage(input: Inputs["formPage"]["deletePage"]): Promise<unknown>;
  reorderPages(input: Inputs["formPage"]["reorderPages"]): Promise<unknown>;
  createQuestion(
    input: Inputs["question"]["createQuestion"],
  ): Promise<{ id: string; labelKey: string; position: string }>;
  updateQuestion(input: Inputs["question"]["updateQuestion"]): Promise<unknown>;
  deleteQuestion(input: Inputs["question"]["deleteQuestion"]): Promise<unknown>;
  reorderQuestions(input: Inputs["question"]["reorderQuestions"]): Promise<unknown>;
}

export interface SyncResult {
  /** Local id to server id, for everything created by this plan. */
  idMap: Map<string, string>;
  /** The definition with every local id replaced, which becomes the new baseline. */
  definition: FormDefinition;
}

function applyIdMap(definition: FormDefinition, idMap: Map<string, string>): FormDefinition {
  const resolve = (id: string) => idMap.get(id) ?? id;

  return {
    ...definition,
    pages: definition.pages.map((page) => ({ ...page, id: resolve(page.id) })),
    questions: definition.questions.map((question) => {
      const resolved: QuestionDefinition = { ...question, id: resolve(question.id) };
      if (question.pageId) resolved.pageId = resolve(question.pageId);
      return resolved;
    }),
  };
}

export async function runSync(
  definition: FormDefinition,
  operations: SyncOperation[],
  executor: SyncExecutor,
): Promise<SyncResult> {
  const idMap = new Map<string, string>();
  const formId = definition.id;

  // ── Pass 1: pages, so a question can reference a page that is being created ────
  for (const operation of operations) {
    if (operation.type !== "createPage") continue;

    const created = await executor.createPage({
      formId,
      ...(operation.title ? { title: operation.title } : {}),
      ...(operation.description ? { description: operation.description } : {}),
    });

    idMap.set(operation.id, created.id);
  }

  // ── Pass 2: questions ────────────────────────────────────────────────────────
  for (const operation of operations) {
    if (operation.type !== "createQuestion") continue;

    const pageId = operation.pageId ? idMap.get(operation.pageId) ?? operation.pageId : undefined;
    const { question } = operation;

    const created = await executor.createQuestion({
      formId,
      ...(pageId ? { pageId } : {}),
      kind: question.kind,
      label: question.label,
      ...(question.labelKey ? { labelKey: question.labelKey } : {}),
      ...(question.description ? { description: question.description } : {}),
      ...(question.placeholder ? { placeholder: question.placeholder } : {}),
      isRequired: question.isRequired,
      ...(question.position ? { position: question.position } : {}),
      settings: question.settings ?? {},
    });

    idMap.set(operation.id, created.id);
  }

  const resolve = (id: string) => idMap.get(id) ?? id;

  // ── Pass 3: everything else, in the order the plan produced ───────────────────
  for (const operation of operations) {
    switch (operation.type) {
      case "createPage":
      case "createQuestion":
        break;

      case "updateSettings":
        await executor.updateSettings({ formId, ...operation.patch });
        break;

      case "updatePage":
        await executor.updatePage({ pageId: resolve(operation.pageId), ...operation.patch });
        break;

      case "deletePage":
        await executor.deletePage({ pageId: resolve(operation.pageId) });
        break;

      case "reorderPages":
        await executor.reorderPages({
          formId,
          orderedPageIds: operation.pageIds
            .map(resolve)
            .filter((id) => !id.startsWith("local:")),
        });
        break;

      case "updateQuestion":
        await executor.updateQuestion({
          questionId: resolve(operation.questionId),
          ...operation.patch,
        });
        break;

      case "deleteQuestion":
        await executor.deleteQuestion({ questionId: resolve(operation.questionId) });
        break;

      case "reorderQuestions": {
        const questionIds = operation.questionIds
          .map(resolve)
          .filter((id) => !id.startsWith("local:"));
        if (questionIds.length === 0) break;
        await executor.reorderQuestions({
          formId,
          ...(operation.pageId ? { pageId: resolve(operation.pageId) } : {}),
          orderedQuestionIds: questionIds,
        });
        break;
      }
    }
  }

  return { idMap, definition: applyIdMap(definition, idMap) };
}
