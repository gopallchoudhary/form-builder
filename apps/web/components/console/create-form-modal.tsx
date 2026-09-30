"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { PlusIcon, Loader2Icon } from "lucide-react";

import { Button, buttonVariants } from "~/components/ui/button";
import type { VariantProps } from "class-variance-authority";
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
import { useCreateForm } from "~/hooks/api/form";

type CreateFormValues = {
  title: string;
  description?: string;
};

export interface CreateFormModalProps {
  id?: string;
  triggerLabel?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerSize?: VariantProps<typeof buttonVariants>["size"];
  triggerClassName?: string;
  showIcon?: boolean;
}

export function CreateFormModal({
  id = "create-form-btn",
  triggerLabel = "New Form",
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName = "gap-2",
  showIcon = true,
}: CreateFormModalProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { createFormAsync, isError, error, status } = useCreateForm();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    defaultValues: { title: "", description: "" },
  });

  const isPending = status === "pending";

  const onSubmit: SubmitHandler<CreateFormValues> = async (data) => {
    const created = await createFormAsync({
      title: data.title,
      description: data.description || undefined,
    });

    reset();
    setOpen(false);

    /*
     * Straight to the builder. Somebody who has just named a form wants to put questions
     * in it, and dropping them back on a list of forms makes them find it again by
     * recognising the title they just typed.
     */
    router.push(`/forms/${created.id}/build`);
  };

  const handleOpenChange = (next: boolean) => {
    if (!isPending) {
      setOpen(next);
      if (!next) reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          id={id}
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
        >
          {showIcon && <PlusIcon className="size-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new form</DialogTitle>
          <DialogDescription>
            Give your form a title and an optional description to get started.
          </DialogDescription>
        </DialogHeader>

        <form id="create-form" onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="form-title">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="form-title"
                placeholder="e.g. Customer Feedback"
                disabled={isPending}
                {...register("title", {
                  required: "Title is required",
                  maxLength: {
                    value: 55,
                    message: "Title must be 55 characters or fewer",
                  },
                })}
              />
              {errors.title && (
                <p className="text-destructive text-xs mt-1">{errors.title.message}</p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="form-description">
                Description{" "}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </FieldLabel>
              <Textarea
                id="form-description"
                placeholder="What is this form about?"
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

            {isError && (
              <p className="text-destructive text-sm">
                {(error as unknown as Error)?.message ?? "Something went wrong."}
              </p>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-form" disabled={isPending} className="gap-2">
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <PlusIcon className="size-4" />
                Create Form
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
