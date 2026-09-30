"use client";

import { getFormTheme } from "@repo/services/utils/theme";
import type { AnswerValue } from "~/stores/runner-store";
import { FormThemeProvider } from "./theme-provider";
import { QuestionInput } from "./question-input";

/**
 * The respondent form, as one component tree.
 *
 * This is the whole point of the phase: the public route and the builder's preview mount
 * *this*, so a preview cannot drift from what respondents see. Nothing here fetches — the
 * caller supplies the definition, which is why the same tree serves a published form from
 * the server and a draft straight out of the builder store.
 */

/**
 * What the renderer actually needs from a form.
 *
 * Deliberately not `FormDefinition`. The builder's definition carries `position` and
 * `labelKey`; the public API withholds both, because a respondent has no business knowing
 * them. Declaring the smaller structural type is what lets one component serve the
 * published form and a draft out of the store — a `FormDefinition` parameter would force
 * the public route to invent fields the server does not send.
 */
export interface RenderableQuestion {
  id: string;
  /** Which page this belongs to. The public API sends it; the renderer needs it to group. */
  pageId: string | null;
  kind: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  isRequired: boolean;
  /**
   * Optional because `z.unknown()` infers an optional key — `unknown` already includes
   * `undefined`. Every consumer treats a missing `settings` as "no configuration".
   */
  settings?: unknown;
  /**
   * Absent on the public form, which the API already returns in order. When it is present
   * — the builder store — the arrays are sorted by it, so a drag that only changed
   * `position` still reorders what is shown.
   */
  position?: string;
}

export interface RenderablePage {
  id: string;
  title: string | null;
  description: string | null;
  position?: string;
}

export interface RenderableDefinition {
  title: string;
  description: string | null;
  layoutMode: "STEP" | "PAGED";
  themeKey: string;
  showProgress: boolean;
  allowBack: boolean;
  pages: RenderablePage[];
  questions: RenderableQuestion[];
}

export interface FormRendererProps {
  definition: RenderableDefinition;
  answers: Record<string, AnswerValue>;
  errors?: Record<string, string>;
  touched?: Record<string, true>;
  /** Index of the visible question (`STEP`) or page (`PAGED`). */
  cursor?: number;
  onAnswer?: (questionId: string, value: AnswerValue) => void;
  onNext?: () => void;
  onBack?: () => void;
  onSubmit?: () => void;
  submitState?: "idle" | "submitting" | "done" | "error";
  /**
   * Not interactive: the fields are disabled and the action row is hidden.
   *
   * Two callers, and they mean the same thing to a respondent — a static preview, and the
   * short window on the public form before the session has been established and the inputs
   * are actually listening.
   */
  readOnly?: boolean;
  children?: React.ReactNode;
}

/**
 * Sorts by `position` when it is there, and otherwise leaves the order alone.
 *
 * `Array.prototype.sort` is stable, so a definition with no positions at all — which is
 * what the public API sends — comes back exactly as the server ordered it.
 */
const byPosition = (a: { position?: string }, b: { position?: string }) =>
  a.position === undefined || b.position === undefined
    ? 0
    : Number(a.position) - Number(b.position);

/**
 * The progress rail — the one memorable thing in the product.
 *
 * A pill-shaped track that fills as the respondent advances, divided into one segment per
 * step. In `PAGED` a segment is a page, so the rail reads as "two of three"; in `STEP` it
 * reads as one tick per question. Segments rather than a continuous bar because a
 * respondent who abandons mid-page is exactly the thing drop-off analytics is trying to
 * surface, and a smooth bar hides which step they stopped at.
 */
function ProgressRail({
  value,
  segments,
  label,
}: {
  value: number;
  segments: number;
  label: string;
}) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const filled = value * segments;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="flex gap-1"
      >
        {Array.from({ length: Math.max(segments, 1) }, (_, index) => {
          // Each segment fills on its own, so a partially-answered page shows a partial
          // tick rather than snapping to whole steps.
          const fill = Math.min(Math.max(filled - index, 0), 1);

          return (
            <span
              key={index}
              className="h-1.5 flex-1 overflow-hidden rounded-pill bg-[var(--form-surface)]"
            >
              <span
                className={[
                  "block h-full rounded-pill transition-[width] duration-500",
                  "motion-reduce:transition-none",
                  fill > 0 ? "bg-[var(--form-accent)]" : "bg-transparent",
                ].join(" ")}
                style={{ width: `${fill * 100}%` }}
              />
            </span>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-[var(--form-muted)]">
        {percent}% · {Math.max(Math.ceil(filled), 1)} of {Math.max(segments, 1)}
      </p>
    </div>
  );
}

function Question({
  question,
  value,
  error,
  onChange,
  readOnly,
}: {
  question: RenderableQuestion;
  value: AnswerValue | undefined;
  error: string | undefined;
  onChange?: (value: AnswerValue) => void;
  readOnly: boolean;
}) {
  const labelId = `q-label-${question.id}`;
  const hintId = `q-hint-${question.id}`;
  const errorId = `q-error-${question.id}`;
  const hasError = Boolean(error);

  return (
    <div className="rounded-xl bg-[var(--form-surface)] p-5 sm:p-6">
      <label
        id={labelId}
        htmlFor={`q-${question.id}`}
        className="block text-lg font-semibold text-[var(--form-heading)]"
      >
        {question.label}
        {question.isRequired && (
          <span aria-hidden className="ml-1 text-[var(--form-accent)]">
            *
          </span>
        )}
      </label>

      {question.description && (
        <p id={hintId} className="mt-1 text-sm text-[var(--form-muted)]">
          {question.description}
        </p>
      )}

      <div className="mt-4">
        <QuestionInput
          id={`q-${question.id}`}
          kind={question.kind}
          settings={question.settings}
          placeholder={question.placeholder}
          value={value}
          onChange={(next) => onChange?.(next)}
          labelledBy={labelId}
          describedBy={[question.description ? hintId : null, hasError ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined}
          invalid={hasError}
          disabled={readOnly}
        />
      </div>

      {hasError && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormRenderer({
  definition,
  answers,
  errors = {},
  touched = {},
  cursor = 0,
  onAnswer,
  onNext,
  onBack,
  onSubmit,
  submitState = "idle",
  readOnly = false,
  children,
}: FormRendererProps) {
  const theme = getFormTheme(definition.themeKey);
  const isStep = definition.layoutMode === "STEP";

  const questions = [...definition.questions].sort(byPosition);
  const pages = [...definition.pages].sort(byPosition);

  const stepQuestions = isStep ? questions : [];
  const stepIndex = Math.min(cursor, Math.max(stepQuestions.length - 1, 0));
  const stepQuestion = stepQuestions[stepIndex];

  const pageIndex = Math.min(cursor, Math.max(pages.length - 1, 0));
  const page = pages[pageIndex];
  const pageQuestions = isStep
    ? []
    : questions.filter((question) => question.pageId === page?.id);

  const visibleQuestions = isStep
    ? stepQuestion
      ? [stepQuestion]
      : []
    : pageQuestions;

  const total = isStep ? stepQuestions.length : pages.length;
  const isLast = cursor >= total - 1;
  const progress = total > 0 ? (cursor + 1) / total : 0;

  return (
    <FormThemeProvider
      theme={theme}
      className="min-h-screen bg-[var(--form-bg)] px-4 py-8 text-[var(--form-text)] sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--form-heading)] sm:text-3xl">
            {definition.title}
          </h1>
          {definition.description && (
            <p className="text-[var(--form-muted)]">{definition.description}</p>
          )}
        </header>

        {definition.showProgress && total > 0 && (
          <ProgressRail
            value={progress}
            segments={isStep ? stepQuestions.length || total : pages.length}
            label={`Step ${cursor + 1} of ${total}`}
          />
        )}

        {!isStep && page && (
          <section aria-labelledby={`page-${page.id}`} className="flex flex-col gap-1">
            {page.title && (
              <h2
                id={`page-${page.id}`}
                className="text-lg font-semibold text-[var(--form-heading)]"
              >
                {page.title}
              </h2>
            )}
            {page.description && (
              <p className="text-sm text-[var(--form-muted)]">{page.description}</p>
            )}
          </section>
        )}

        {visibleQuestions.length === 0 ? (
          <p className="rounded-xl bg-[var(--form-surface)] p-6 text-center text-[var(--form-muted)]">
            {questions.length === 0
              ? "This form has no questions yet."
              : "This page has no questions on it."}
          </p>
        ) : (
          visibleQuestions.map((question) => (
            <Question
              key={question.id}
              question={question}
              value={answers[question.id]}
              // An error is only shown once the respondent has left the question, so
              // nobody is told they are wrong before they have had a chance to answer.
              error={touched[question.id] ? errors[question.id] : undefined}
              onChange={
                readOnly || !onAnswer
                  ? undefined
                  : (value) => onAnswer(question.id, value)
              }
              readOnly={readOnly}
            />
          ))
        )}

        {children}

        {!readOnly && (onNext || onSubmit) && (
          <div className="flex items-center justify-between gap-3">
            {definition.allowBack && onBack && cursor > 0 ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-[var(--form-border)] bg-[var(--form-surface)] px-5 py-2.5 text-sm font-medium text-[var(--form-text)]"
              >
                Back
              </button>
            ) : (
              <span />
            )}

            {isLast && onSubmit ? (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitState === "submitting"}
                className="rounded-xl bg-[var(--form-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--form-accent-fg)] disabled:opacity-60"
              >
                {submitState === "submitting" ? "Submitting…" : "Submit"}
              </button>
            ) : (
              onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-xl bg-[var(--form-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--form-accent-fg)]"
                >
                  Next
                </button>
              )
            )}
          </div>
        )}
      </div>
    </FormThemeProvider>
  );
}
