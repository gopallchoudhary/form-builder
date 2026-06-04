"use client";

import React, { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { PlusIcon, FileTextIcon, Loader2Icon } from "lucide-react";
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
import { useCreateForm } from "~/hooks/api/form";

type CreateFormValues = {
  title: string;
  description?: string;
};

// ── Create Form Modal ──────────────────────────────────────────────────────────
function CreateFormModal() {
  const [open, setOpen] = useState(false);
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
    await createFormAsync({
      title: data.title,
      description: data.description || undefined,
    });
    reset();
    setOpen(false);
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
        <Button id="create-form-btn" className="gap-2">
          <PlusIcon className="size-4" />
          New Form
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
                <p className="text-destructive text-xs mt-1">
                  {errors.title.message}
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="form-description">
                Description{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional)
                </span>
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
                <p className="text-destructive text-xs mt-1">
                  {errors.description.message}
                </p>
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
          <Button
            type="submit"
            form="create-form"
            disabled={isPending}
            className="gap-2"
          >
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

// ── Forms Page ─────────────────────────────────────────────────────────────────
const FormsPage = () => {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and build your forms
          </p>
        </div>
        <CreateFormModal />
      </div>

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <FileTextIcon className="text-muted-foreground size-7" />
        </div>
        <div>
          <p className="font-medium">No forms yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Create your first form to get started
          </p>
        </div>
        <CreateFormModal />
      </div>
    </div>
  );
};

export default FormsPage;
