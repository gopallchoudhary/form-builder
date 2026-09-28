import { describe, expect, it } from "vitest";

import {
  checkQuestion,
  checkStep,
  cursorFor,
  positionFor,
  shouldAutoAdvance,
  stepCount,
  visibleQuestions,
  type RuntimePage,
  type RuntimeQuestion,
} from "~/components/form/runtime-logic";

function question(overrides: Partial<RuntimeQuestion> = {}): RuntimeQuestion {
  return {
    id: "q1",
    kind: "SHORT_TEXT",
    isRequired: false,
    settings: {},
    pageId: null,
    position: "1.00",
    ...overrides,
  };
}

const page = (id: string, position: string): RuntimePage => ({ id, position });

describe("runtime navigation", () => {
  describe("stepper layout", () => {
    const questions = [
      question({ id: "q1", position: "1.00" }),
      question({ id: "q2", position: "2.00" }),
      question({ id: "q3", position: "3.00" }),
    ];

    it("counts a step per question", () => {
      expect(stepCount(questions, [], "STEP")).toBe(3);
    });

    it("shows exactly one question at a time", () => {
      expect(visibleQuestions(questions, [], 0, "STEP").map((q) => q.id)).toEqual(["q1"]);
      expect(visibleQuestions(questions, [], 2, "STEP").map((q) => q.id)).toEqual(["q3"]);
    });

    it("clamps a cursor past the end rather than rendering nothing", () => {
      // A resumed session can name a question the creator has since deleted.
      expect(visibleQuestions(questions, [], 99, "STEP").map((q) => q.id)).toEqual(["q3"]);
    });

    it("reports the question as the position to save", () => {
      expect(positionFor(questions, [], 1, "STEP")).toEqual({
        currentQuestionId: "q2",
        currentPageId: null,
      });
    });
  });

  describe("paged layout", () => {
    const pages = [page("p1", "1.00"), page("p2", "2.00")];
    const questions = [
      question({ id: "q1", pageId: "p1", position: "1.00" }),
      question({ id: "q2", pageId: "p1", position: "2.00" }),
      question({ id: "q3", pageId: "p2", position: "1.00" }),
    ];

    it("counts a step per page", () => {
      expect(stepCount(questions, pages, "PAGED")).toBe(2);
    });

    it("groups the questions of a page", () => {
      expect(visibleQuestions(questions, pages, 0, "PAGED").map((q) => q.id)).toEqual([
        "q1",
        "q2",
      ]);
      expect(visibleQuestions(questions, pages, 1, "PAGED").map((q) => q.id)).toEqual(["q3"]);
    });

    it("keeps a pageless question visible rather than hiding it", () => {
      // A question adopted onto no page would otherwise vanish from the form entirely.
      const withOrphan = [...questions, question({ id: "q4", pageId: null, position: "1.00" })];
      expect(visibleQuestions(withOrphan, pages, 0, "PAGED").map((q) => q.id)).toEqual([
        "q1",
        "q2",
        "q4",
      ]);
    });

    it("reports the page as the position to save", () => {
      expect(positionFor(questions, pages, 1, "PAGED")).toEqual({
        currentQuestionId: null,
        currentPageId: "p2",
      });
    });
  });

  describe("resuming", () => {
    const questions = [
      question({ id: "q1", position: "1.00" }),
      question({ id: "q2", position: "2.00" }),
    ];

    it("starts where the draft left off", () => {
      expect(
        cursorFor(questions, [], "STEP", { questionId: "q2", pageId: null }),
      ).toBe(1);
    });

    it("starts at the beginning when the named question is gone", () => {
      expect(
        cursorFor(questions, [], "STEP", { questionId: "deleted", pageId: null }),
      ).toBe(0);
      expect(cursorFor(questions, [], "STEP", { questionId: null, pageId: null })).toBe(0);
    });

    it("resumes a paged form by page", () => {
      const pages = [page("p1", "1.00"), page("p2", "2.00")];
      expect(cursorFor(questions, pages, "PAGED", { questionId: null, pageId: "p2" })).toBe(1);
    });
  });
});

describe("validating an answer", () => {
  it("accepts an empty answer to an optional question", () => {
    expect(checkQuestion(question(), {}).ok).toBe(true);
    expect(checkQuestion(question(), { q1: "   " }).ok).toBe(true);
  });

  it("refuses an empty answer to a required one", () => {
    const result = checkQuestion(question({ isRequired: true }), {});
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toMatch(/needs an answer/);
  });

  it("applies the same rules the service does", () => {
    // The client must not disagree with the server about what a valid email is; it only
    // decides when to say so.
    const email = question({ id: "e", kind: "EMAIL", isRequired: true });
    expect(checkQuestion(email, { e: "not-an-email" }).ok).toBe(false);
    expect(checkQuestion(email, { e: "a@b.com" }).ok).toBe(true);
  });

  it("honours a bounded number question", () => {
    const number = question({ id: "n", kind: "NUMBER", settings: { min: 1, max: 10 } });
    expect(checkQuestion(number, { n: 0 }).ok).toBe(false);
    expect(checkQuestion(number, { n: 11 }).ok).toBe(false);
    expect(checkQuestion(number, { n: 5 }).ok).toBe(true);
  });

  it("honours a rating scale", () => {
    const rating = question({ id: "r", kind: "RATING", settings: { scale: 5, style: "STAR" } });
    expect(checkQuestion(rating, { r: 6 }).ok).toBe(false);
    expect(checkQuestion(rating, { r: 5 }).ok).toBe(true);
  });

  it("reports every problem on a page, keyed by question", () => {
    const questions = [
      question({ id: "a", isRequired: true }),
      question({ id: "b", kind: "EMAIL", isRequired: true, position: "2.00" }),
    ];

    const errors = checkStep(questions, { a: "filled", b: "nope" });

    expect(Object.keys(errors).sort()).toEqual(["b"]);
  });

  it("reports nothing when the whole page is fine", () => {
    const questions = [
      question({ id: "a", isRequired: true }),
      question({ id: "b", kind: "EMAIL", isRequired: false, position: "2.00" }),
    ];

    expect(checkStep(questions, { a: "filled", b: "" })).toEqual({});
  });
});

describe("auto-advance", () => {
  it("advances for a question with exactly one possible answer", () => {
    expect(shouldAutoAdvance(question({ kind: "YES_NO" }))).toBe(true);
    expect(shouldAutoAdvance(question({ kind: "SINGLE_CHOICE" }))).toBe(true);
    expect(shouldAutoAdvance(question({ kind: "DROPDOWN" }))).toBe(true);
  });

  it("waits when the answer still needs typing or choosing", () => {
    // Advancing out from under any of these would discard the choice in progress.
    for (const kind of ["SHORT_TEXT", "LONG_TEXT", "EMAIL", "PHONE", "PASSWORD", "NUMBER", "DATE", "MULTI_CHOICE", "RATING", "ADDRESS"]) {
      expect(shouldAutoAdvance(question({ kind }))).toBe(false);
    }
  });
});
