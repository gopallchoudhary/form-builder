"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { AddQuestionButton, QuestionCard } from "~/components/builder/question-card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useBuilderStore } from "~/stores/builder-store";
import { getFormTheme } from "@repo/services/utils/theme";
import { FormThemeProvider } from "~/components/form/theme-provider";

/**
 * The builder canvas.
 *
 * In `PAGED` the questions are grouped into sections, one per page, each with its own add
 * button; in `STEP` there are no pages and the list is flat. The two layouts are genuinely
 * different documents, so the canvas shows the difference rather than hiding pages behind
 * a switch.
 *
 * Reordering is dnd-kit, with a keyboard sensor wired to the same handlers — the grip is a
 * real button, so it is focusable and the arrow keys move a card without a pointer.
 */

function PageSection({
  pageId,
  title,
  index,
  total,
  questionIds,
}: {
  pageId: string;
  title: string | null;
  index: number;
  total: number;
  questionIds: string[];
}) {
  const definition = useBuilderStore((state) => state.definition);
  const updatePage = useBuilderStore((state) => state.updatePage);
  const removePage = useBuilderStore((state) => state.removePage);
  const questions = useBuilderStore((state) => state.definition?.questions ?? []);
  const pageCount = useBuilderStore((state) => state.definition?.pages.length ?? 0);

  const theme = getFormTheme(definition?.themeKey);

  return (
    <FormThemeProvider theme={theme}>
      <section aria-labelledby={`page-${pageId}`} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {/*
            The page number is the order the respondent will meet it in, which is
            information rather than decoration.
          */}
          <span className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
            Page {index + 1} of {total}
          </span>
          <Input
            value={title ?? ""}
            onChange={(event) => updatePage(pageId, { title: event.target.value })}
            placeholder="Page title"
            aria-label={`Title of page ${index + 1}`}
            className="h-8 max-w-56 text-sm"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete page ${index + 1}`}
            className="hover:text-destructive"
            disabled={pageCount <= 1}
            title={pageCount <= 1 ? "A form needs at least one page" : undefined}
            onClick={() => removePage(pageId)}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>

        <SortableContext
          items={questionIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {questionIds.map((id) => {
              const question = questions.find((entry) => entry.id === id);
              return question ? <QuestionCard key={id} question={question} /> : null;
            })}
          </div>
        </SortableContext>

        <AddQuestionButton pageId={pageId} label="Add question to this page" />
      </section>
    </FormThemeProvider>
  );
}

export function BuildCanvas() {
  const definition = useBuilderStore((state) => state.definition);
  const addPage = useBuilderStore((state) => state.addPage);
  const setQuestionOrder = useBuilderStore((state) => state.setQuestionOrder);
  const [lastError, setLastError] = useState<string | null>(null);

  const sensors = useSensors(
    // A small activation distance so a click on the card still selects it.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!definition) return null;

  const isPaged = definition.layoutMode === "PAGED";
  const pages = [...definition.pages].sort((a, b) => Number(a.position) - Number(b.position));

  /** A question moving between groups changes its page as well as its position. */
  const onDragEnd = (event: DragEndEvent) => {
    setLastError(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeQuestion = definition.questions.find((q) => q.id === active.id);
    if (!activeQuestion) return;

    const overQuestion = definition.questions.find((q) => q.id === over.id);

    if (!isPaged) {
      const ids = [...definition.questions]
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((q) => q.id);
      setQuestionOrder(null, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
      return;
    }

    const targetPageId = overQuestion?.pageId ?? null;

    // Dropping into another page's list: reparent first, then order within the new page.
    if (activeQuestion.pageId !== targetPageId) {
      const inNewPage = definition.questions
        .filter((q) => q.pageId === targetPageId && q.id !== activeQuestion.id)
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((q) => q.id);

      setQuestionOrder(
        activeQuestion.pageId,
        definition.questions
          .filter((q) => q.pageId === activeQuestion.pageId && q.id !== activeQuestion.id)
          .sort((a, b) => Number(a.position) - Number(b.position))
          .map((q) => q.id),
      );

      const insertAt = overQuestion ? inNewPage.indexOf(overQuestion.id) : inNewPage.length;
      if (insertAt < 0) {
        setLastError("That question could not be moved. Try dropping it onto a card.");
        return;
      }
      setQuestionOrder(targetPageId, [
        ...inNewPage.slice(0, insertAt),
        String(active.id),
        ...inNewPage.slice(insertAt),
      ]);
    }
  };

  if (definition.questions.length === 0) {
    return (
      <Empty className="border border-dashed bg-card/60">
        <EmptyHeader>
          <EmptyMedia>
            <PlusIcon className="text-muted-foreground size-5" />
          </EmptyMedia>
          <EmptyTitle>No questions yet</EmptyTitle>
          <EmptyDescription>
            {isPaged
              ? "Add a question to the first page. It appears on the public link as soon as you publish."
              : "Add your first question. It appears on the public link as soon as you publish."}
          </EmptyDescription>
        </EmptyHeader>
        <div className="w-56">
          <AddQuestionButton
            pageId={isPaged ? (pages[0]?.id ?? null) : null}
            label="Add the first question"
          />
        </div>
      </Empty>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col gap-8">
        {lastError && (
          <p role="alert" className="text-destructive text-sm">
            {lastError}
          </p>
        )}

        {isPaged ? (
          pages.map((page, index) => (
            <PageSection
              key={page.id}
              pageId={page.id}
              title={page.title}
              index={index}
              total={pages.length}
              questionIds={definition.questions
                .filter((question) => question.pageId === page.id)
                .sort((a, b) => Number(a.position) - Number(b.position))
                .map((question) => question.id)}
            />
          ))
        ) : (
          <section aria-label="Questions" className="flex flex-col gap-3">
            <SortableContext
              items={definition.questions.map((question) => question.id)}
              strategy={verticalListSortingStrategy}
            >
              {definition.questions
                .sort((a, b) => Number(a.position) - Number(b.position))
                .map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))}
            </SortableContext>
            <AddQuestionButton pageId={null} />
          </section>
        )}

        {isPaged && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={addPage}
          >
            <PlusIcon className="size-4" />
            Add page
          </Button>
        )}
      </div>
    </DndContext>
  );
}
