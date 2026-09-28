"use client";

import { useEffect, useState } from "react";

import type { FormDefinition } from "@repo/services/form/model";

import { FormRenderer } from "./form-renderer";
import type { AnswerValue } from "~/stores/runner-store";

/**
 * The same renderer, driven by the builder store instead of the respondent's session.
 *
 * Preview has no answers and no navigation — it answers "what does this look like", and
 * the runtime wiring belongs to the respondent phase. Sharing `FormRenderer` is what makes
 * the preview trustworthy: there is no second implementation to fall out of date.
 */
export function FormPreview({
  definition,
  deviceWidth = "desktop",
}: {
  definition: FormDefinition;
  deviceWidth?: "mobile" | "desktop";
}) {
  // The store's definition is replaced on every keystroke, so the preview follows along
  // without a round trip. Answers are held locally because a preview respondent changes
  // nothing; they just want to see a control respond.
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  // A different form, or a deleted question, must not leave a stale answer behind.
  useEffect(() => {
    setAnswers({});
  }, [definition.id]);

  const width = deviceWidth === "mobile" ? "max-w-[375px]" : "max-w-2xl";

  return (
    <div
      className={`mx-auto w-full overflow-hidden rounded-xl border shadow-sm ${width}`}
    >
      <FormRenderer
        definition={definition}
        answers={answers}
        onAnswer={(questionId, value) =>
          setAnswers((current) => ({ ...current, [questionId]: value }))
        }
        readOnly={false}
      />
    </div>
  );
}
