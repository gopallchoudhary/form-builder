import { describe, expect, it, vi } from "vitest";
import type { FormDefinition, QuestionDefinition } from "@repo/services/form/model";

import { planSync } from "~/stores/builder-store/plan-sync";
import { runSync, type SyncExecutor } from "~/stores/builder-store/run-sync";

function question(overrides: Partial<QuestionDefinition> = {}): QuestionDefinition {
  return {
    id: "q1",
    pageId: null,
    position: "1.00",
    kind: "SHORT_TEXT",
    label: "Name",
    labelKey: "name",
    description: null,
    placeholder: null,
    isRequired: true,
    settings: {},
    ...overrides,
  };
}

function definition(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return {
    id: "form1",
    slug: "a-form",
    title: "A form",
    description: null,
    layoutMode: "PAGED",
    themeKey: "sage",
    status: "DRAFT",
    showProgress: true,
    allowBack: true,
    oneResponsePerDevice: false,
    maxResponses: null,
    closesAt: null,
    thankYouTitle: null,
    thankYouMessage: null,
    thankYouRedirectUrl: null,
    version: 1,
    publishedAt: null,
    createdAt: null,
    updatedAt: null,
    pages: [],
    questions: [],
    ...overrides,
  };
}

function fakeExecutor(overrides: Partial<SyncExecutor> = {}): SyncExecutor {
  return {
    updateSettings: vi.fn().mockResolvedValue({}),
    createPage: vi.fn().mockResolvedValue({ id: "srv-page", position: "1.00" }),
    updatePage: vi.fn().mockResolvedValue({}),
    deletePage: vi.fn().mockResolvedValue({}),
    reorderPages: vi.fn().mockResolvedValue({}),
    createQuestion: vi
      .fn()
      .mockResolvedValue({ id: "srv-question", labelKey: "name", position: "1.00" }),
    updateQuestion: vi.fn().mockResolvedValue({}),
    deleteQuestion: vi.fn().mockResolvedValue({}),
    reorderQuestions: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe("runSync", () => {
  it("creates a page before a question that lives on it", async () => {
    const after = definition({
      pages: [{ id: "local:p1", title: "One", description: null, position: "1.00" }],
      questions: [question({ id: "local:q1", pageId: "local:p1" })],
    });

    const calls: string[] = [];
    const executor = fakeExecutor({
      createPage: vi.fn().mockImplementation(async () => {
        calls.push("createPage");
        return { id: "srv-p1", position: "1.00" };
      }),
      createQuestion: vi.fn().mockImplementation(async (input) => {
        calls.push(`createQuestion:${input.pageId}`);
        return { id: "srv-q1", labelKey: "name", position: "1.00" };
      }),
    });

    const result = await runSync(after, planSync(definition(), after), executor);

    expect(calls).toEqual(["createPage", "createQuestion:srv-p1"]);
    expect(result.idMap.get("local:p1")).toBe("srv-p1");
    expect(result.idMap.get("local:q1")).toBe("srv-q1");
  });

  it("returns a definition with local ids replaced", async () => {
    const after = definition({
      pages: [{ id: "local:p1", title: "One", description: null, position: "1.00" }],
      questions: [question({ id: "local:q1", pageId: "local:p1" })],
    });

    const result = await runSync(after, planSync(definition(), after), fakeExecutor());

    expect(result.definition.pages[0]?.id).toBe("srv-page");
    expect(result.definition.questions[0]?.id).toBe("srv-question");
    expect(result.definition.questions[0]?.pageId).toBe("srv-page");
  });

  it("rewrites a reorder so it names the server id of a question it just created", async () => {
    // An existing page gains a new question above the existing one. The reorder has to
    // carry the *server* id of the new question, which did not exist when the plan was
    // built, and the page's real id.
    const before = definition({
      layoutMode: "PAGED",
      pages: [{ id: "p1", title: null, description: null, position: "1.00" }],
      questions: [question({ id: "q1", pageId: "p1", position: "2.00" })],
    });
    const after = definition({
      layoutMode: "PAGED",
      pages: [{ id: "p1", title: null, description: null, position: "1.00" }],
      questions: [
        question({ id: "local:q2", pageId: "p1", position: "1.00" }),
        question({ id: "q1", pageId: "p1", position: "2.00" }),
      ],
    });

    const executor = fakeExecutor();

    await runSync(after, planSync(before, after), executor);

    const reorder = vi.mocked(executor.reorderQuestions).mock.calls[0]?.[0];
    expect(reorder?.pageId).toBe("p1");
    expect(reorder?.orderedQuestionIds).toEqual(["srv-question", "q1"]);
    expect(reorder?.orderedQuestionIds).not.toContain("local:q2");
  });

  it("does not reorder a group whose questions are all being created", async () => {
    // A brand new page with brand new questions: the creates carry the positions, so a
    // reorder would only add a call that cannot change anything.
    const before = definition();
    const after = definition({
      layoutMode: "PAGED",
      pages: [{ id: "local:p1", title: "One", description: null, position: "1.00" }],
      questions: [
        question({ id: "local:q1", pageId: "local:p1", position: "2.00" }),
        question({ id: "local:q2", pageId: "local:p1", position: "1.00" }),
      ],
    });

    const executor = fakeExecutor();
    await runSync(after, planSync(before, after), executor);

    expect(executor.reorderQuestions).not.toHaveBeenCalled();
  });

  it("omits pageId for a stepper question rather than sending null", async () => {
    const after = definition({
      layoutMode: "STEP",
      questions: [question({ id: "local:q1" })],
    });

    const executor = fakeExecutor();
    await runSync(after, planSync(definition(), after), executor);

    const input = vi.mocked(executor.createQuestion).mock.calls[0]?.[0] as {
      pageId?: string;
    };
    expect("pageId" in input).toBe(false);
  });

  it("skips a reorder that would contain nothing but local ids", async () => {
    const after = definition({
      layoutMode: "PAGED",
      pages: [{ id: "p1", title: null, description: null, position: "1.00" }],
      questions: [
        question({ id: "local:q1", pageId: "p1", position: "1.00" }),
        question({ id: "q2", pageId: "p1", position: "2.00" }),
      ],
    });

    const executor = fakeExecutor();
    await runSync(after, planSync(definition(), after), executor);

    for (const call of vi.mocked(executor.reorderQuestions).mock.calls) {
      expect(call[0].orderedQuestionIds.every((id) => !id.startsWith("local:"))).toBe(true);
    }
  });

  it("sends a settings patch through untouched", async () => {
    const before = definition({ title: "Old" });
    const after = definition({ title: "New" });

    const executor = fakeExecutor();
    await runSync(after, planSync(before, after), executor);

    expect(executor.updateSettings).toHaveBeenCalledWith({
      formId: "form1",
      title: "New",
    });
  });

  it("stops at the first failure so a partial plan is never half-applied silently", async () => {
    const before = definition({ title: "Old" });
    const after = definition({ title: "New" });
    const failure = new Error("conflict");

    const executor = fakeExecutor({ updateSettings: vi.fn().mockRejectedValue(failure) });

    await expect(runSync(after, planSync(before, after), executor)).rejects.toThrow(
      "conflict",
    );
  });
});
