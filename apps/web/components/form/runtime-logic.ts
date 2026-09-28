import { isEmptyAnswer, validateAnswer } from "@repo/services/utils/answer-validation";
import type { QuestionKind } from "@repo/services/question/model";

/**
 * The respondent runtime's rules, kept out of the component.
 *
 * Navigation and validation are the parts of a form that decide whether a response is
 * usable, so they are the parts worth testing directly. The component drives them; it does
 * not contain them.
 */

export interface RuntimeQuestion {
  id: string;
  kind: string;
  isRequired: boolean;
  settings: unknown;
  pageId: string | null;
  position: string;
}

export interface RuntimePage {
  id: string;
  /** Optional because the public API sends pages already in order. */
  position?: string;
}

export type AnswerMap = Record<string, unknown>;

/**
 * Sorts by position when it is present, and otherwise leaves the order alone — the same
 * rule the renderer uses. A stable sort with no positions comes back exactly as given.
 */
const byPosition = (a: { position?: string }, b: { position?: string }) =>
  a.position === undefined || b.position === undefined
    ? 0
    : Number(a.position) - Number(b.position);

export function orderedQuestions(questions: RuntimeQuestion[]): RuntimeQuestion[] {
  return [...questions].sort(byPosition);
}

export function orderedPages(pages: RuntimePage[]): RuntimePage[] {
  return [...pages].sort(byPosition);
}

/**
 * The questions on the current step, or the current page.
 *
 * A `PAGED` form with no page for a question would render nothing, so a pageless question
 * is treated as belonging to the first page — the same thing the store does when it adopts
 * them on a layout switch.
 */
export function visibleQuestions(
  questions: RuntimeQuestion[],
  pages: RuntimePage[],
  cursor: number,
  layoutMode: "STEP" | "PAGED",
): RuntimeQuestion[] {
  const ordered = orderedQuestions(questions);
  if (layoutMode === "STEP") {
    const one = ordered[Math.min(cursor, Math.max(ordered.length - 1, 0))];
    return one ? [one] : [];
  }

  const page = orderedPages(pages)[Math.min(cursor, Math.max(pages.length - 1, 0))];
  if (!page) return [];

  const onPage = ordered.filter((question) => question.pageId === page.id);
  const orphans = ordered.filter((question) => question.pageId === null);

  return [...onPage, ...orphans];
}

/** How many steps there are: questions in `STEP`, pages in `PAGED`. */
export function stepCount(
  questions: RuntimeQuestion[],
  pages: RuntimePage[],
  layoutMode: "STEP" | "PAGED",
): number {
  return layoutMode === "STEP" ? questions.length : pages.length;
}

/** The cursor a resumed session should start at. Falls back to the first step. */
export function cursorFor(
  questions: RuntimeQuestion[],
  pages: RuntimePage[],
  layoutMode: "STEP" | "PAGED",
  current: { questionId: string | null; pageId: string | null },
): number {
  if (layoutMode === "STEP") {
    if (!current.questionId) return 0;
    const index = orderedQuestions(questions).findIndex((q) => q.id === current.questionId);
    return index < 0 ? 0 : index;
  }

  if (!current.pageId) return 0;
  const index = orderedPages(pages).findIndex((page) => page.id === current.pageId);
  return index < 0 ? 0 : index;
}

/** The id the draft save should record as the respondent's position. */
export function positionFor(
  questions: RuntimeQuestion[],
  pages: RuntimePage[],
  cursor: number,
  layoutMode: "STEP" | "PAGED",
): { currentQuestionId: string | null; currentPageId: string | null } {
  if (layoutMode === "STEP") {
    const question = orderedQuestions(questions)[cursor];
    return { currentQuestionId: question?.id ?? null, currentPageId: null };
  }

  const page = orderedPages(pages)[cursor];
  return {
    currentQuestionId: null,
    currentPageId: page?.id ?? null,
  };
}

/**
 * Check one question, and say why not if it fails.
 *
 * The same `validateAnswer` the service uses, so the client cannot disagree with the
 * server about what counts as a valid email or a rating out of range — the only thing
 * decided here is *when* to complain, which the server has no opinion about.
 */
export function checkQuestion(
  question: RuntimeQuestion,
  answers: AnswerMap,
): { ok: true } | { ok: false; message: string } {
  const value = answers[question.id];

  if (isEmptyAnswer(value)) {
    return question.isRequired
      ? { ok: false, message: "This question needs an answer" }
      : { ok: true };
  }

  const result = validateAnswer(
    question.kind as QuestionKind,
    question.settings,
    value,
  );

  if (!result.success) return { ok: false, message: result.message };
  return { ok: true };
}

/** Check everything on the current step. Empty when it is fine to move on. */
export function checkStep(
  questions: RuntimeQuestion[],
  answers: AnswerMap,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const question of questions) {
    const result = checkQuestion(question, answers);
    if (!result.ok) errors[question.id] = result.message;
  }

  return errors;
}

/**
 * Whether answering this question should move on by itself.
 *
 * Only for the kinds where there is exactly one possible answer and picking it *is* the
 * decision. A rating has a range, a text field needs typing, and a multi-select needs more
 * than one click — advancing out from under any of those would discard the choice.
 */
const AUTO_ADVANCE: ReadonlySet<string> = new Set(["YES_NO", "SINGLE_CHOICE", "DROPDOWN"]);

export function shouldAutoAdvance(question: RuntimeQuestion): boolean {
  return AUTO_ADVANCE.has(question.kind);
}
