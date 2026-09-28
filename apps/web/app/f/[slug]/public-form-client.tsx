"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FormRenderer, type RenderableDefinition } from "~/components/form/form-renderer";
import { useStartSession, useSubmitForm } from "~/hooks/api/public";
import { useRunnerStore, type AnswerValue } from "~/stores/runner-store";

/**
 * The public form's client half: it owns the session and the answers, and renders the
 * shared `FormRenderer` with them.
 *
 * Navigation, per-question validation and draft autosaving are the respondent phase. What
 * matters here is that the session is established before anyone can answer, because
 * `saveDraft` and `submitForm` are both keyed on a session id the server issues.
 */

/** Exactly what the renderer needs, plus the slug the session calls need. */
type PublicForm = RenderableDefinition & { slug: string };

/** A stable per-browser id. Not an identity — the server only uses it to resume a draft. */
function readDeviceId(): string {
  const KEY = "streamyst:device";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(KEY, created);
  return created;
}

export function PublicFormClient({ form }: { form: PublicForm }) {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  const { mutateAsync: startSessionAsync } = useStartSession();
  const { mutateAsync: submitAsync } = useSubmitForm();

  const begin = useRunnerStore((state) => state.begin);
  const setAnswer = useRunnerStore((state) => state.setAnswer);
  const goNext = useRunnerStore((state) => state.goNext);
  const goBack = useRunnerStore((state) => state.goBack);
  const setSubmitState = useRunnerStore((state) => state.setSubmitState);
  const answers = useRunnerStore((state) => state.answers);
  const cursor = useRunnerStore((state) => state.cursor);
  const submitState = useRunnerStore((state) => state.submitState);
  const deviceId = useRunnerStore((state) => state.deviceId);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const session = await startSessionAsync({
          slug: form.slug,
          deviceId: readDeviceId(),
        });

        if (cancelled) return;

        if (session.alreadyCompleted) {
          setBlocked("already-submitted");
          return;
        }

        begin({
          formId: form.slug,
          deviceId: readDeviceId(),
          sessionId: session.sessionId,
          answers: session.answers as Record<string, AnswerValue>,
        });
        setSessionReady(true);
      } catch {
        if (!cancelled) setBlocked("error");
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [form.slug, startSessionAsync, begin]);

  const submit = async () => {
    if (!deviceId) return;
    const sessionId = useRunnerStore.getState().sessionId;
    if (!sessionId) return;

    setSubmitState("submitting");
    try {
      await submitAsync({
        sessionId,
        deviceId,
        answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      });
      setSubmitState("done");
      router.push(`/f/${form.slug}/thanks`);
    } catch {
      setSubmitState("error");
    }
  };

  if (blocked === "already-submitted") {
    return (
      <Notice
        title="You have already responded"
        body="This form accepts one response per device. Thank you for answering."
      />
    );
  }

  if (blocked === "error") {
    return (
      <Notice
        title="Could not start this form"
        body="Something went wrong on our side. Try reloading the page."
      />
    );
  }

  const total =
    form.layoutMode === "STEP"
      ? form.questions.length
      : form.pages.length;

  return (
    <FormRenderer
      definition={form}
      answers={answers}
      cursor={cursor}
      onAnswer={setAnswer}
      onNext={() => goNext(total)}
      onBack={goBack}
      onSubmit={submit}
      submitState={submitState}
    >
      {/*
        The definition came from the server, so the form is on screen before the session
        is. Saving and submitting are the only things that need a session id, so the
        respondent can read and answer while it starts, rather than staring at a spinner.
      */}
      {!sessionReady && (
        <p className="text-center text-sm text-[var(--form-muted)]">
          Getting this form ready…
        </p>
      )}

      {submitState === "error" && (
        <p role="alert" className="text-sm font-medium text-[#d03238]">
          Your answers could not be submitted. Please try again.
        </p>
      )}
    </FormRenderer>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8ebe6] px-4">
      <div className="max-w-sm rounded-xl bg-white p-8 text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#0e0f0c]">{title}</h1>
        {body && <p className="mt-2 text-sm text-[#454745]">{body}</p>}
      </div>
    </main>
  );
}
