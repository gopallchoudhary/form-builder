"use client";

import { XIcon } from "lucide-react";

import { KindConfig } from "~/components/builder/kind-config";
import { KIND_GROUPS, KIND_LABELS } from "~/components/builder/kinds";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { useBuilderStore } from "~/stores/builder-store";
import type { QuestionKind } from "@repo/services/question/model";

/**
 * The inspector for the selected question.
 *
 * Every field writes straight into the store, which debounces its own persistence — there
 * is no save button, because a creator should never be able to lose a label to a forgotten
 * click. `labelKey` is shown but not editable: it is write-once on the server, and
 * changing it would orphan the data already collected under it.
 */
export function QuestionInspector() {
  const definition = useBuilderStore((state) => state.definition);
  const selectedId = useBuilderStore((state) => state.selectedQuestionId);
  const selectQuestion = useBuilderStore((state) => state.selectQuestion);
  const renameQuestion = useBuilderStore((state) => state.renameQuestion);

  const question = definition?.questions.find((entry) => entry.id === selectedId);

  if (!question) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        Select a question to edit it.
      </div>
    );
  }

  const settings = (question.settings ?? {}) as Record<string, unknown>;

  /**
   * Changing the kind replaces the settings outright rather than merging them: the old
   * shape would fail the new kind's validator, and a half-converted question is one the
   * publish gate would reject with a message nobody could act on.
   */
  const changeKind = (kind: QuestionKind) => {
    const defaults: Partial<Record<QuestionKind, Record<string, unknown>>> = {
      RATING: { scale: 5, style: "STAR" },
      SINGLE_CHOICE: { options: [{ id: "option-1", label: "Option 1" }, { id: "option-2", label: "Option 2" }] },
      MULTI_CHOICE: { options: [{ id: "option-1", label: "Option 1" }, { id: "option-2", label: "Option 2" }] },
      DROPDOWN: { options: [{ id: "option-1", label: "Option 1" }, { id: "option-2", label: "Option 2" }] },
    };

    renameQuestion(question.id, { kind, settings: defaults[kind] ?? {} });
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Question</p>
          {question.labelKey && (
            <p className="text-muted-foreground truncate font-mono text-[10px] tracking-widest uppercase">
              {question.labelKey}
            </p>
          )}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close inspector"
          onClick={() => selectQuestion(null)}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <Field>
        <FieldLabel htmlFor="q-label">Question</FieldLabel>
        <Input
          id="q-label"
          value={question.label}
          onChange={(event) => renameQuestion(question.id, { label: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="q-kind">Answer type</FieldLabel>
        <Select value={question.kind} onValueChange={(value) => changeKind(value as QuestionKind)}>
          <SelectTrigger id="q-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.kinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {question.labelKey && (
          <FieldDescription>
            Changing the answer type keeps the responses already collected, but they will not
            appear under the new answers.
          </FieldDescription>
        )}
      </Field>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="q-required" className="cursor-pointer">
          Required
        </Label>
        <Switch
          id="q-required"
          checked={question.isRequired}
          onCheckedChange={(checked) => renameQuestion(question.id, { isRequired: checked })}
        />
      </div>

      <Field>
        <FieldLabel htmlFor="q-description">Helper text</FieldLabel>
        <Textarea
          id="q-description"
          value={question.description ?? ""}
          onChange={(event) =>
            renameQuestion(question.id, { description: event.target.value || null })
          }
          placeholder="Shown under the question"
          className="min-h-16 resize-none"
        />
      </Field>

      {question.kind !== "YES_NO" && question.kind !== "SINGLE_CHOICE" && question.kind !== "MULTI_CHOICE" && question.kind !== "DROPDOWN" && (
        <Field>
          <FieldLabel htmlFor="q-placeholder">Placeholder</FieldLabel>
          <Input
            id="q-placeholder"
            value={question.placeholder ?? ""}
            onChange={(event) =>
              renameQuestion(question.id, { placeholder: event.target.value || null })
            }
          />
        </Field>
      )}

      <Separator />

      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold">Options</p>
        <KindConfig
          kind={question.kind}
          settings={settings}
          onChange={(next) => renameQuestion(question.id, { settings: next })}
        />
      </div>
    </div>
  );
}
