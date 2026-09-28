import { describe, expect, it } from "vitest";
import type { BuilderQuestion, BuilderShape } from "~/stores/builder-store";

import { planSync } from "~/stores/builder-store/plan-sync";

function question(overrides: Partial<BuilderQuestion> = {}): BuilderQuestion {
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

function definition(overrides: Partial<BuilderShape> = {}): BuilderShape {
  return {
    id: "form1",
    slug: "a-form",
    title: "A form",
    description: null,
    layoutMode: "STEP",
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

describe("planSync", () => {
  it("does nothing when the definition is unchanged", () => {
    const form = definition({ questions: [question()] });

    expect(planSync(form, form)).toEqual([]);
  });

  it("does nothing when the server state is unknown", () => {
    // Guessing here would create duplicates and delete questions it has never seen.
    const operations = planSync(
      null,
      definition({ questions: [question({ id: "local:1" })] }),
    );

    expect(operations).toEqual([]);
  });

  it("sends only the settings that changed", () => {
    const before = definition({ title: "Old", showProgress: true });
    const after = definition({ title: "New", showProgress: true });

    expect(planSync(before, after)).toEqual([
      { type: "updateSettings", formId: "form1", patch: { title: "New" } },
    ]);
  });

  it("compares closesAt by value, not by reference", () => {
    const before = definition({ closesAt: "2026-01-01T00:00:00.000Z" });
    const after = definition({ closesAt: "2026-01-01T00:00:00.000Z" });

    expect(planSync(before, after)).toEqual([]);
  });

  it("compares question settings as json", () => {
    const before = definition({ questions: [question({ settings: { options: [] } })] });
    const after = definition({
      questions: [question({ settings: { options: [] } })],
    });

    expect(planSync(before, after)).toEqual([]);
  });

  it("creates a question that is new, and reports the local id to replace", () => {
    const before = definition();
    const after = definition({ questions: [question({ id: "local:abc" })] });

    expect(planSync(before, after)).toEqual([
      {
        type: "createQuestion",
        formId: "form1",
        id: "local:abc",
        pageId: null,
        question: {
          pageId: null,
          kind: "SHORT_TEXT",
          label: "Name",
          description: null,
          placeholder: null,
          isRequired: true,
          settings: {},
        },
      },
    ]);
  });

  it("deletes a question that is gone", () => {
    const before = definition({ questions: [question({ id: "q1" }), question({ id: "q2", position: "2.00" })] });
    const after = definition({ questions: [question({ id: "q1" })] });

    expect(planSync(before, after)).toEqual([
      { type: "deleteQuestion", formId: "form1", questionId: "q2" },
    ]);
  });

  it("does not renumber when only a label was edited", () => {
    const before = definition({
      questions: [question({ id: "q1" }), question({ id: "q2", position: "2.00" })],
    });
    const after = definition({
      questions: [
        question({ id: "q1", label: "Full name" }),
        question({ id: "q2", position: "2.00" }),
      ],
    });

    expect(planSync(before, after)).toEqual([
      {
        type: "updateQuestion",
        formId: "form1",
        questionId: "q1",
        patch: { label: "Full name" },
      },
    ]);
  });

  it("sends a reorder when the order within a page changed", () => {
    const page = { id: "p1", title: null, description: null, position: "1.00" };
    const before = definition({
      layoutMode: "PAGED",
      pages: [page],
      questions: [
        question({ id: "q1", pageId: "p1", position: "1.00" }),
        question({ id: "q2", pageId: "p1", position: "2.00" }),
      ],
    });
    const after = definition({
      layoutMode: "PAGED",
      pages: [page],
      questions: [
        question({ id: "q1", pageId: "p1", position: "2.00" }),
        question({ id: "q2", pageId: "p1", position: "1.00" }),
      ],
    });

    expect(planSync(before, after)).toEqual([
      {
        type: "reorderQuestions",
        formId: "form1",
        pageId: "p1",
        questionIds: ["q2", "q1"],
      },
    ]);
  });

  it("orders stepper questions globally, not per page", () => {
    const before = definition({
      layoutMode: "STEP",
      questions: [
        question({ id: "q1", position: "1.00" }),
        question({ id: "q2", position: "2.00" }),
        question({ id: "q3", position: "3.00" }),
      ],
    });
    const after = definition({
      layoutMode: "STEP",
      questions: [
        question({ id: "q3", position: "1.00" }),
        question({ id: "q1", position: "2.00" }),
        question({ id: "q2", position: "3.00" }),
      ],
    });

    expect(planSync(before, after)).toEqual([
      {
        type: "reorderQuestions",
        formId: "form1",
        pageId: null,
        questionIds: ["q3", "q1", "q2"],
      },
    ]);
  });

  it("groups questions by page, whatever the layout", () => {
    // The server's `reorderQuestions` scopes to a page, and an omitted `pageId` there
    // means "the questions with no page". Branching on the layout once sent a page-scoped
    // list to that endpoint for a stepper form, and it rejected the request with "must
    // list every question in scope exactly once". Questions sharing a page are one group,
    // always.
    const page = { id: "p1", title: null, description: null, position: "1.00" };
    const before = definition({
      layoutMode: "STEP",
      pages: [page],
      questions: [
        question({ id: "q1", pageId: "p1", position: "1.00" }),
        question({ id: "q2", pageId: "p1", position: "2.00" }),
      ],
    });
    const after = definition({
      layoutMode: "STEP",
      pages: [page],
      questions: [
        question({ id: "q2", pageId: "p1", position: "1.00" }),
        question({ id: "q1", pageId: "p1", position: "2.00" }),
      ],
    });

    expect(planSync(before, after)).toEqual([
      {
        type: "reorderQuestions",
        formId: "form1",
        pageId: "p1",
        questionIds: ["q2", "q1"],
      },
    ]);
  });

  it("keeps pageless and paged questions in separate groups", () => {
    const page = { id: "p1", title: null, description: null, position: "1.00" };
    const before = definition({
      layoutMode: "PAGED",
      pages: [page],
      questions: [
        question({ id: "q1", pageId: "p1", position: "1.00" }),
        question({ id: "q2", pageId: null, position: "1.00" }),
        question({ id: "q3", pageId: null, position: "2.00" }),
      ],
    });
    const after = definition({
      layoutMode: "PAGED",
      pages: [page],
      questions: [
        question({ id: "q1", pageId: "p1", position: "1.00" }),
        question({ id: "q3", pageId: null, position: "1.00" }),
        question({ id: "q2", pageId: null, position: "2.00" }),
      ],
    });

    // Only the pageless group changed, so only it is sent — and it is sent without a
    // pageId, which is how the service is told to scope to the questions with no page.
    expect(planSync(before, after)).toEqual([
      {
        type: "reorderQuestions",
        formId: "form1",
        pageId: null,
        questionIds: ["q3", "q2"],
      },
    ]);
  });

  it("reorders pages when a page is inserted", () => {
    const before = definition({
      layoutMode: "PAGED",
      pages: [{ id: "p1", title: "One", description: null, position: "1.00" }],
      questions: [],
    });
    const after = definition({
      layoutMode: "PAGED",
      pages: [
        { id: "p1", title: "One", description: null, position: "1.00" },
        { id: "local:new", title: "Two", description: null, position: "2.00" },
      ],
      questions: [],
    });

    const operations = planSync(before, after);

    expect(operations).toContainEqual({
      type: "createPage",
      formId: "form1",
      id: "local:new",
      title: "Two",
      description: null,
    });
    expect(operations).toContainEqual({
      type: "reorderPages",
      formId: "form1",
      pageIds: ["p1", "local:new"],
    });
  });

  it("clears a question's page when the page is deleted", () => {
    const before = definition({
      layoutMode: "PAGED",
      pages: [{ id: "p1", title: "One", description: null, position: "1.00" }],
      questions: [question({ id: "q1", pageId: "p1" })],
    });
    const after = definition({
      layoutMode: "PAGED",
      pages: [],
      questions: [question({ id: "q1", pageId: null })],
    });

    const operations = planSync(before, after);

    expect(operations).toContainEqual({ type: "deletePage", formId: "form1", pageId: "p1" });
    expect(operations).toContainEqual({
      type: "updateQuestion",
      formId: "form1",
      questionId: "q1",
      patch: { pageId: null },
    });
  });
});
