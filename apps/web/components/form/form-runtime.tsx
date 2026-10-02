"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FormRenderer, type RenderableDefinition } from "./form-renderer";
import { FormStateScreen } from "./form-states";
import {
  checkStep,
  cursorFor,
  positionFor,
  shouldAutoAdvance,
  stepCount,
  visibleQuestions,
  type AnswerMap,
  type RuntimeQuestion,
} from "./runtime-logic";
import { useSaveDraft, useStartSession, useSubmitForm } from "~/hooks/api/public";
import { runWithRetries } from "~/lib/retry";
import { useRunnerStore, type AnswerValue } from "~/stores/runner-store";

/**
 * The respondent runtime.
 *
 * Owns the session, the position and the draft; renders through the same `FormRenderer` the
 * builder previews, so the two cannot disagree. The server revalidates every answer on
 * submit regardless of what passed here — this only decides *when* to complain, so a
 * respondent hears about a bad email while they are still looking at the field.
 */

export type BootState = "starting" | "ready" | "already-submitted" | "error";

/** A stable per-browser id. Not an identity — only a key for resuming a draft. */
export function readDeviceId(): string {
  const KEY = "streamyst:device";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(KEY, created);
  return created;
}

export const unlockTokenKey = (slug: string) => `streamyst:unlock:${slug}`;

export function FormRuntime({
  form,
  unlockToken,
}: {
  form: RenderableDefinition & { slug: string };
  unlockToken?: string;
}) {
  const router = useRouter();

  const [boot, setBoot] = useState<BootState>("starting");
  const deviceId = useRef("");
  const bootedFor = useRef("");

  const { mutateAsync: startSessionAsync } = useStartSession();
  const { mutateAsync: saveDraftAsync, status: saveStatus } = useSaveDraft();
  const { mutateAsync: submitAsync } = useSubmitForm();

  const begin = useRunnerStore((state) => state.begin);
  const reset = useRunnerStore((state) => state.reset);
  const setAnswer = useRunnerStore((state) => state.setAnswer);
  const setErrors = useRunnerStore((state) => state.setErrors);
  const setSubmitState = useRunnerStore((state) => state.setSubmitState);
  const touch = useRunnerStore((state) => state.touch);

  const answers = useRunnerStore((state) => state.answers);
  const touched = useRunnerStore((state) => state.touched);
  const errors = useRunnerStore((state) => state.errors);
  const cursor = useRunnerStore((state) => state.cursor);
  const submitState = useRunnerStore((state) => state.submitState);

  const questions = form.questions as unknown as RuntimeQuestion[];
  const total = stepCount(questions, form.pages, form.layoutMode);

  /**
   * The draft is saved on every move, and again on the way out, so a closed tab or a
   * refresh loses nothing. It carries the respondent's position because the server turns a
   * genuine change of position into the `PAGE_VIEW` / `QUESTION_VIEW` events that the
   * drop-off and funnel analytics read.
   */
  const save = useCallback(
    async (nextCursor: number, nextAnswers: AnswerMap) => {
      const device = deviceId.current;
      const session = useRunnerStore.getState().sessionId;
      if (!device || !session) return;

      const position = positionFor(questions, form.pages, nextCursor, form.layoutMode);

      try {
        await saveDraftAsync({
          sessionId: session,
          deviceId: device,
          answers: Object.entries(nextAnswers).map(([questionId, value]) => ({
            questionId,
            value: value as AnswerValue,
          })),
          currentQuestionId: position.currentQuestionId,
          currentPageId: position.currentPageId,
        });
      } catch (error) {
        // A failed draft save is not worth interrupting the respondent for: the answers
        // are still in the store and still on screen, and the next move tries again. It
        // is still logged, because a silent failure here is indistinguishable from a
        // draft that never saved at all.
        console.error("draft save failed", error);
      }
    },
    [questions, form.pages, form.layoutMode, saveDraftAsync],
  );

  const submit = useCallback(
    async (finalAnswers: AnswerMap) => {
      const device = deviceId.current;
      const session = useRunnerStore.getState().sessionId;
      if (!device || !session) return;

      setSubmitState("submitting");
      try {
        const result = await submitAsync({
          sessionId: session,
          deviceId: device,
          answers: Object.entries(finalAnswers).map(([questionId, value]) => ({
            questionId,
            value: value as AnswerValue,
          })),
        });

        // The server can still refuse: the form may have closed or filled up while this
        // response was being written.
        if (result.status === "SUBMITTED") {
          setSubmitState("done");
          router.push(`/f/${form.slug}/thanks`);
          return;
        }

        setSubmitState("error");
      } catch {
        setSubmitState("error");
      }
    },
    [submitAsync, setSubmitState, router, form.slug],
  );

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Set once a session is genuinely live, so a re-render cannot start a second one.
    if (bootedFor.current === form.slug) return;

    let cancelled = false;
    const pending: ReturnType<typeof setTimeout>[] = [];

    const start = async () => {
      try {
        const device = readDeviceId();
        deviceId.current = device;

        /*
         * Retried, because a failed boot has no way to recover on its own. The respondent is
         * left looking at a form that will not finish starting, and the only escape anyone
         * knows is a manual refresh.
         *
         * Safe to repeat: `startSession` resumes an existing in-progress draft for the same
         * device, so a retry after an unknown outcome continues the same session rather than
         * creating a second one.
         */
        const session = await runWithRetries(() =>
          startSessionAsync({
            slug: form.slug,
            deviceId: device,
            ...(unlockToken ? { unlockToken } : {}),
          }),
        );

        // Abandoned mid-flight — most often because `unlockToken` arrived and the effect ran
        // again. The latch is deliberately left unset, so the next run starts a real session
        // rather than early-returning on a session that never began.
        if (cancelled) return;

        if (session.alreadyCompleted) {
          bootedFor.current = form.slug;
          setBoot("already-submitted");
          return;
        }

        const resumed = session.answers as Record<string, AnswerValue>;

        begin({
          formId: form.slug,
          deviceId: device,
          sessionId: session.sessionId,
          answers: resumed,
          // Resume where they left off, so a refresh does not restart the form.
          cursor: cursorFor(questions, form.pages, form.layoutMode, {
            questionId: session.currentQuestionId,
            pageId: session.currentPageId,
          }),
        });

        bootedFor.current = form.slug;
        setBoot("ready");
      } catch {
        if (!cancelled) setBoot("error");
      }
    };

    void start();
    return () => {
      cancelled = true;
      // A retry that outlives the component would land on a form nobody is filling.
      for (const timer of pending) clearTimeout(timer);
    };
    // `questions` and `pages` are derived from `form` and stable per render of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug, form.layoutMode, unlockToken, startSessionAsync, begin]);

  // A different form on the same device must not inherit the last one's answers.
  useEffect(() => {
    const stored = useRunnerStore.getState().formId;
    if (stored && stored !== form.slug) reset();
  }, [form.slug, reset]);

  // Save on the way out, so a refresh keeps the last keystroke too.
  useEffect(() => {
    if (boot !== "ready") return;

    const onHide = () => {
      void save(cursor, answers);
    };

    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [boot, cursor, answers, save]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const stepQuestions = visibleQuestions(questions, form.pages, cursor, form.layoutMode);

  const goTo = useCallback(
    async (nextCursor: number, nextAnswers: AnswerMap) => {
      useRunnerStore.setState({ cursor: nextCursor });
      await save(nextCursor, nextAnswers);
    },
    [save],
  );

  const advance = useCallback(
    async (override?: AnswerMap) => {
      const currentAnswers = (override ?? useRunnerStore.getState().answers) as AnswerMap;

      // Mark the step as left first, so a complaint is shown on the question it belongs to
      // rather than appearing out of nowhere on the next one.
      for (const question of stepQuestions) touch(question.id);

      const found = checkStep(stepQuestions, currentAnswers);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        return false;
      }
      setErrors({});

      if (cursor >= total - 1) {
        await submit(currentAnswers);
        return true;
      }

      await goTo(cursor + 1, currentAnswers);
      return true;
    },
    [cursor, total, stepQuestions, touch, setErrors, goTo, submit],
  );

  const back = useCallback(async () => {
    if (cursor === 0) return;
    await goTo(cursor - 1, useRunnerStore.getState().answers as AnswerMap);
  }, [cursor, goTo]);

  const answer = useCallback(
    (questionId: string, value: AnswerValue) => {
      setAnswer(questionId, value);
      const next = { ...(useRunnerStore.getState().answers as AnswerMap), [questionId]: value };

      // Choosing the only possible answer moves on by itself — but not before the value
      // is valid, or a bounded question could step straight past its own limit.
      const question = questions.find((entry) => entry.id === questionId);
      if (!question || !shouldAutoAdvance(question)) return;
      if (Object.keys(checkStep([question], next)).length > 0) return;

      void advance(next);
    },
    [questions, setAnswer, advance],
  );

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (boot !== "ready") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // In a textarea, Enter is a newline and Shift+Enter is the escape hatch. Everywhere
      // else Enter moves on and Shift+Enter goes back, so a stepper form can be answered
      // without ever touching the mouse.
      const target = event.target as HTMLElement | null;
      const isTextarea = target?.tagName === "TEXTAREA";
      if (isTextarea && !event.shiftKey) return;

      event.preventDefault();
      if (event.shiftKey) void back();
      else void advance();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [boot, advance, back]);

  if (boot === "already-submitted") {
    return <FormStateScreen reason="ALREADY_SUBMITTED" themeKey={form.themeKey} />;
  }

  return (
    <FormRenderer
      definition={form}
      answers={answers}
      errors={errors}
      touched={touched}
      cursor={cursor}
      onAnswer={answer}
      onNext={() => void advance()}
      onBack={() => void back()}
      onSubmit={() => void advance()}
      submitState={submitState}
      /*
       * Not interactive until the session exists.
       *
       * The definition is server-rendered, so the fields are on screen and focusable
       * before React has hydrated and before `onChange` is wired to anything. A respondent
       * on a slow connection could type a whole answer into a field that was only a picture
       * of a field, and watch it vanish when hydration finished — the keystrokes never
       * reached the store, so the draft saved empty and the answer was silently lost.
       *
       * Presenting a field as fillable before it can hold anything is the actual bug here;
       * the "Getting this form ready" line was a hint, not a guard. Disabling the inputs
       * also makes the behaviour honest for everyone, not just the unlucky.
       */
      readOnly={boot !== "ready"}
    >
      {boot === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          This form could not be opened. Try reloading the page.
        </p>
      )}

      {/*
        The definition came from the server, so the form is on screen before the session
        is. Saving and submitting are the only things that need a session id.
      */}
      {boot === "starting" && (
        <p className="text-center text-sm text-[var(--form-muted)]">Getting this form ready…</p>
      )}

      {submitState === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Your answers could not be submitted — the form may have closed or filled up while
          you were answering. Try again.
        </p>
      )}

      {saveStatus === "pending" && (
        <p className="sr-only" role="status">
          Saving your progress
        </p>
      )}
    </FormRenderer>
  );
}
