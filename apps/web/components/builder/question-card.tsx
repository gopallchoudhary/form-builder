"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CopyIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { QuestionInput } from "~/components/form/question-input";
import { KIND_LABELS } from "~/components/builder/kinds";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { isLocalId, useBuilderStore } from "~/stores/builder-store";
import type { QuestionDefinition } from "@repo/services/form/model";

/**
 * One question in the canvas.
 *
 * The card renders the *actual* control through the same `QuestionInput` the respondent
 * gets, with the form's own theme. That is the whole idea of the canvas: you compose the
 * form by looking at the form, not at a list of labels describing it. It also means a
 * question can never be dragged into a state the respondent renderer would not know how to
 * display.
 *
 * The controls are rendered disabled and non-interactive on purpose. They share a surface
 * with a drag handle, and a live text field there would be a click target that sometimes
 * drags and sometimes focuses, depending on how far the pointer moved before it lifted.
 * Read-only is also the honest depiction: nothing typed into a builder card is an answer.
 */

export function QuestionCard({ question }: { question: QuestionDefinition }) {
  const selectedId = useBuilderStore((state) => state.selectedQuestionId);
  const selectQuestion = useBuilderStore((state) => state.selectQuestion);
  const removeQuestion = useBuilderStore((state) => state.removeQuestion);
  const addQuestion = useBuilderStore((state) => state.addQuestion);

  const isSelected = selectedId === question.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const duplicate = () => {
    const copy = addQuestion({
      pageId: question.pageId,
      position: "",
      kind: question.kind,
      // \`labelKey\` is write-once and the server derives it, so the copy gets a blank one.
      labelKey: "",
      label: `${question.label} (copy)`,
      description: question.description,
      placeholder: question.placeholder,
      isRequired: question.isRequired,
      settings: question.settings,
    });
    selectQuestion(copy);
  };

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-xl bg-card p-5",
        // Elevation is surface contrast, not shadow: a white card on the sage canvas.
        "ring-1 ring-transparent transition-shadow",
        isSelected ? "ring-[#0e0f0c]" : "hover:ring-border",
        isDragging && "z-10 opacity-80 ring-2",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Reorder ${question.label}`}
          className="text-muted-foreground/50 hover:text-foreground focus-visible:ring-ring mt-0.5 cursor-grab touch-none rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => selectQuestion(isSelected ? null : question.id)}
          aria-expanded={isSelected}
          className="focus-visible:ring-ring min-w-0 flex-1 cursor-pointer text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{question.label}</span>
            {question.isRequired && (
              <span className="text-destructive text-xs font-semibold">required</span>
            )}
            <Badge variant="secondary" className="rounded-pill text-xs">
              {KIND_LABELS[question.kind] ?? question.kind}
            </Badge>
            {isLocalId(question.id) && (
              <Badge variant="outline" className="rounded-pill text-xs">
                Not saved yet
              </Badge>
            )}
          </span>
          {/*
            The stable key, in mono caps. It is not decoration: this is the column header
            a response gets in a CSV export, so a creator has to be able to see it.
          */}
          {question.labelKey && (
            <span className="text-muted-foreground mt-1 block font-mono text-[10px] tracking-widest uppercase">
              {question.labelKey}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Duplicate ${question.label}`}
            onClick={duplicate}
          >
            <CopyIcon className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${question.label}`}
            className="hover:text-destructive"
            onClick={() => {
              removeQuestion(question.id);
              if (isSelected) selectQuestion(null);
            }}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none mt-4 pl-8 select-none">
        <QuestionInput
          id={`preview-${question.id}`}
          kind={question.kind}
          settings={question.settings}
          placeholder={question.placeholder}
          value={undefined}
          onChange={() => {}}
          labelledBy={`preview-label-${question.id}`}
          disabled
        />
      </div>
    </article>
  );
}

export function AddQuestionButton({
  pageId,
  label = "Add question",
}: {
  pageId: string | null;
  label?: string;
}) {
  const addQuestion = useBuilderStore((state) => state.addQuestion);
  const selectQuestion = useBuilderStore((state) => state.selectQuestion);

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={() => {
        const id = addQuestion({
          pageId,
          position: "",
          kind: "SHORT_TEXT",
          labelKey: "",
          label: "Untitled question",
          description: null,
          placeholder: null,
          isRequired: false,
          settings: {},
        });
        selectQuestion(id);
      }}
    >
      <PlusIcon className="size-4" />
      {label}
    </Button>
  );
}
