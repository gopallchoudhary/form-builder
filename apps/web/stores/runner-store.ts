import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The respondent's runtime state.
 *
 * Persisted to `localStorage` so a refresh, a crashed tab or a closed laptop loses
 * nothing. The server draft is the source of truth on resume — `startSession` returns the
 * saved answers — so the local copy is only a fast first paint, and `reconcile` always
 * wins over it.
 */

export type AnswerValue = string | number | boolean | string[] | Record<string, string>;

/** `localStorage` key, namespaced per form so two tabs can hold two forms. */
export const runnerStorageKey = (formId: string) => `streamyst:runner:${formId}`;

export type SubmitState = "idle" | "submitting" | "done" | "error";

export interface RunnerState {
  formId: string | null;
  sessionId: string | null;
  deviceId: string | null;
  /** Where the respondent is. A question index in `STEP`, a page index in `PAGED`. */
  cursor: number;
  answers: Record<string, AnswerValue>;
  /** Questions the respondent has left. Errors are only shown for these. */
  touched: Record<string, true>;
  errors: Record<string, string>;
  submitState: SubmitState;
  submitted: boolean;

  begin: (input: {
    formId: string;
    deviceId: string;
    sessionId: string;
    cursor?: number;
    answers?: Record<string, AnswerValue>;
  }) => void;
  reconcile: (input: {
    sessionId: string;
    answers: Record<string, AnswerValue>;
    cursor?: number;
    submitted?: boolean;
  }) => void;
  setAnswer: (questionId: string, value: AnswerValue) => void;
  setCursor: (cursor: number) => void;
  goNext: (total: number) => void;
  goBack: () => void;
  touch: (questionId: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  setSubmitState: (submitState: SubmitState) => void;
  reset: () => void;
}

const INITIAL = {
  formId: null,
  sessionId: null,
  deviceId: null,
  cursor: 0,
  answers: {} as Record<string, AnswerValue>,
  touched: {} as Record<string, true>,
  errors: {} as Record<string, string>,
  submitState: "idle" as SubmitState,
  submitted: false,
};

export const useRunnerStore = create<RunnerState>()(
  persist(
    (set) => ({
      ...INITIAL,

      begin: ({ formId, deviceId, sessionId, cursor, answers }) =>
        set((state) => ({
          formId,
          deviceId,
          sessionId,
          cursor: cursor ?? state.cursor,
          answers: answers ?? state.answers,
          submitState: "idle",
        })),

      reconcile: ({ sessionId, answers, cursor, submitted }) =>
        set((state) => ({
          sessionId,
          answers: { ...state.answers, ...answers },
          cursor: cursor ?? state.cursor,
          submitted: submitted ?? state.submitted,
          submitState: submitted ? "done" : state.submitState,
        })),

      setAnswer: (questionId, value) =>
        set((state) => {
          // Clearing an error the moment it is corrected is what makes a form feel
          // responsive; leaving a stale "required" message under a filled field is worse
          // than showing no validation at all.
          const { [questionId]: _cleared, ...errors } = state.errors;
          return { answers: { ...state.answers, [questionId]: value }, errors };
        }),

      setCursor: (cursor) => set({ cursor }),

      goNext: (total) =>
        set((state) => ({ cursor: Math.min(state.cursor + 1, Math.max(total - 1, 0)) })),

      goBack: () => set((state) => ({ cursor: Math.max(state.cursor - 1, 0) })),

      touch: (questionId) =>
        set((state) => ({ touched: { ...state.touched, [questionId]: true } })),

      setErrors: (errors) => set({ errors }),

      setSubmitState: (submitState) => set({ submitState }),

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "streamyst:runner",
      /**
       * Only the answers and the cursor are worth keeping across a refresh. The session id
       * is deliberately *not* persisted here: it is only meaningful together with the
       * device id, and a stale pair from another browser would only produce a confusing
       * 403. It is re-established by `startSession`.
       */
      partialize: (state) => ({
        answers: state.answers,
        cursor: state.cursor,
        touched: state.touched,
      }),
    },
  ),
);

/** Per-form key, so the persisted blob can hold more than one form's draft. */
export const runnerKeySelector = (formId: string | null | undefined) =>
  formId ? runnerStorageKey(formId) : "streamyst:runner";

/** True when the respondent has an answer worth sending. */
export function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}
