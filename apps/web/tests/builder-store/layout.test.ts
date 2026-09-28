import { beforeEach, describe, expect, it } from "vitest";

import { useBuilderStore, type BuilderShape } from "~/stores/builder-store";

/**
 * The layout switch is the one place the builder reconciles two things that can disagree:
 * a stepper form's questions have no page, and a paged form's questions must all be on one.
 */

function shape(overrides: Partial<BuilderShape> = {}): BuilderShape {
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
    questions: [
      {
        id: "q1",
        pageId: null,
        position: "1.00",
        kind: "SHORT_TEXT",
        label: "Name",
        labelKey: "name",
        description: null,
        placeholder: null,
        isRequired: false,
        settings: {},
      },
    ],
    ...overrides,
  };
}

const definition = () => useBuilderStore.getState().definition;

describe("builder store layout", () => {
  beforeEach(() => {
    useBuilderStore.setState({ past: [], future: [], selectedQuestionId: null });
  });

  it("adopts pageless questions onto a page when switching to paged", () => {
    useBuilderStore.getState().hydrate(shape());
    useBuilderStore.getState().setLayoutMode("PAGED");

    const after = definition();
    expect(after?.layoutMode).toBe("PAGED");
    // Without a page, a paged form renders nothing and cannot be published.
    expect(after?.pages).toHaveLength(1);
    expect(after?.questions[0]?.pageId).toBe(after?.pages[0]?.id);
  });

  it("keeps an existing grouping when switching to paged", () => {
    useBuilderStore.getState().hydrate(
      shape({
        layoutMode: "PAGED",
        pages: [
          { id: "p1", title: "One", description: null, position: "1.00" },
          { id: "p2", title: "Two", description: null, position: "2.00" },
        ],
        questions: [{ ...shape().questions[0]!, id: "q1", pageId: "p2" }],
      }),
    );

    useBuilderStore.getState().setLayoutMode("STEP");
    useBuilderStore.getState().setLayoutMode("PAGED");

    // The stepper view ignores pages, so switching back must not flatten the grouping.
    expect(definition()?.questions[0]?.pageId).toBe("p2");
  });

  it("keeps the page structure when switching to a stepper", () => {
    useBuilderStore.getState().hydrate(
      shape({
        layoutMode: "PAGED",
        pages: [{ id: "p1", title: "One", description: null, position: "1.00" }],
        questions: [{ ...shape().questions[0]!, pageId: "p1" }],
      }),
    );

    useBuilderStore.getState().setLayoutMode("STEP");

    expect(definition()?.layoutMode).toBe("STEP");
    expect(definition()?.pages).toHaveLength(1);
  });

  it("does nothing when the layout is already that one", () => {
    useBuilderStore.getState().hydrate(shape());
    const before = definition();

    useBuilderStore.getState().setLayoutMode("STEP");

    expect(definition()).toBe(before);
  });

  it("records the layout change in the undo history", () => {
    useBuilderStore.getState().hydrate(shape());
    useBuilderStore.getState().setLayoutMode("PAGED");

    expect(useBuilderStore.getState().past).toHaveLength(1);

    useBuilderStore.getState().undo();

    expect(definition()?.layoutMode).toBe("STEP");
    expect(definition()?.pages).toHaveLength(0);
  });
});
