"use client";

import { useParams } from "next/navigation";

import { BuildCanvas } from "~/components/builder/build-canvas";
import { BuilderChrome } from "~/components/builder/builder-chrome";
import { QuestionInspector } from "~/components/builder/question-inspector";
import { useBuilderStore } from "~/stores/builder-store";

/**
 * The builder: canvas on the left, inspector on the right.
 *
 * The inspector is not a panel that has to be opened — it is always there, because a
 * creator's hands alternate between the two and a panel that appears and disappears makes
 * that alternation impossible. On a narrow screen it moves below the canvas, in the same
 * reading order.
 */
export function BuildWorkspace() {
  const { formId } = useParams<{ formId: string }>();
  const selectedId = useBuilderStore((state) => state.selectedQuestionId);

  return (
    <BuilderChrome formId={formId}>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <BuildCanvas />
          </div>
        </div>

        {selectedId && (
          <aside
            aria-label="Question settings"
            className="border-t bg-card lg:border-t-0 lg:border-l"
          >
            <div className="lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <QuestionInspector />
            </div>
          </aside>
        )}
      </div>
    </BuilderChrome>
  );
}

export default BuildWorkspace;
