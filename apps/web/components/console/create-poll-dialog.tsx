"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { useCreatePoll } from "~/hooks/api/poll";

type CreatePollValues = {
  title: string;
  description?: string;
};

/** A poll holds at most ten options: beyond that it is a survey, not a poll. */
const MAX_OPTIONS = 10;

interface DraftOption {
  id: string;
  label: string;
}

const seedOptions = (): DraftOption[] => [
  { id: "option-1", label: "" },
  { id: "option-2", label: "" },
];

/**
 * The dialog a poll starts in.
 *
 * Title and description go through `react-hook-form` like the form dialog, because those
 * rules (required, max length) are per-field. The options live in `useState` instead: they
 * are a *list* whose validity is collective — at least two non-empty labels — which a
 * per-field register cannot express without fighting it.
 *
 * Option ids are minted as `option-N` and never shown, matching the builder: the id is
 * plumbing for the tally and the label is the whole interface.
 */
export function CreatePollDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DraftOption[]>(seedOptions);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const router = useRouter();
  const { createPollAsync, status } = useCreatePoll();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePollValues>({
    defaultValues: { title: "", description: "" },
  });

  const isPending = status === "pending";

  const setLabel = (id: string, label: string) => {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, label } : option)));
    setOptionsError(null);
  };

  const addOption = () => {
    setOptions((current) => {
      if (current.length >= MAX_OPTIONS) return current;

      // Same minting as the builder's options editor: the first free `option-N`.
      let n = current.length + 1;
      while (current.some((option) => option.id === `option-${n}`)) n += 1;
      return [...current, { id: `option-${n}`, label: "" }];
    });
  };

  const removeOption = (id: string) => {
    setOptions((current) => (current.length <= 2 ? current : current.filter((option) => option.id !== id)));
  };

  const onSubmit: SubmitHandler<CreatePollValues> = async (data) => {
    const filled = options
      .map((option) => ({ ...option, label: option.label.trim() }))
      .filter((option) => option.label.length > 0);

    if (filled.length < 2) {
      setOptionsError("Add at least two options with labels.");
      return;
    }

    const created = await createPollAsync({
      title: data.title,
      description: data.description || undefined,
      options: filled,
    });

    reset();
    setOptions(seedOptions());
    setOptionsError(null);
    setOpen(false);

    /*
     * Straight to the detail page. A poll is born a draft, and the next thing its creator
     * wants is the open button and the share link — both live there, not on the list.
     */
    router.push(`/polls/${created.id}`);
  };

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      reset();
      setOptions(seedOptions());
      setOptionsError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusIcon className="size-4" />
          New Poll
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new poll</DialogTitle>
          <DialogDescription>
            Name it, give voters at least two options, then open it from its page.
          </DialogDescription>
        </DialogHeader>

        <form id="create-poll" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="poll-title">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="poll-title"
                placeholder="e.g. Team lunch"
                disabled={isPending}
                {...register("title", {
                  required: "Title is required",
                  maxLength: {
                    value: 120,
                    message: "Title must be 120 characters or fewer",
                  },
                })}
              />
              {errors.title && (
                <p className="text-destructive text-xs mt-1">{errors.title.message}</p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="poll-description">Description</FieldLabel>
              <Textarea
                id="poll-description"
                placeholder="What is this poll about? (optional)"
                disabled={isPending}
                {...register("description", {
                  maxLength: {
                    value: 300,
                    message: "Description must be 300 characters or fewer",
                  },
                })}
              />
              {errors.description && (
                <p className="text-destructive text-xs mt-1">{errors.description.message}</p>
              )}
            </Field>

            <Field>
              <FieldLabel>
                Options <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="flex flex-col gap-2">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.label}
                      onChange={(event) => setLabel(option.id, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                      disabled={isPending}
                      aria-label={`Option ${index + 1}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={isPending || options.length <= 2}
                      onClick={() => removeOption(option.id)}
                      aria-label={`Remove option ${index + 1}`}
                      title={options.length <= 2 ? "A poll needs at least two options" : undefined}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-muted-foreground text-xs">
                  {options.length} of {MAX_OPTIONS}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending || options.length >= MAX_OPTIONS}
                  onClick={addOption}
                  className="gap-1.5"
                >
                  <PlusIcon className="size-3.5" />
                  Add option
                </Button>
              </div>
              {optionsError && (
                <p role="alert" className="text-destructive text-xs mt-1">
                  {optionsError}
                </p>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="submit" form="create-poll" disabled={isPending}>
              {isPending ? "Creating…" : "Create poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
