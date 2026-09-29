"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  PlusIcon,
  FileTextIcon,
  Loader2Icon,
  ArrowRightIcon,
  CalendarIcon,
  LinkIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useCreateForm, useListForms } from "~/hooks/api/form";
import { publicFormUrl } from "~/lib/share-url";
import { cn } from "~/lib/utils";

type CreateFormValues = {
  title: string;
  description?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// ── Create Form Modal ──────────────────────────────────────────────────────────
function CreateFormModal() {
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

// ── Form Card Skeleton ─────────────────────────────────────────────────────────
function FormCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center justify-between mt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

// ── Form Card ──────────────────────────────────────────────────────────────────
function FormCard({
  id,
  slug,
  title,
  description,
  status,
  createdAt,
}: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: Date | null;
}) {
  const [copied, setCopied] = useState(false);

  const share = publicFormUrl(slug);
  const isDraft = status === "DRAFT";

  /*
   * Copying rather than navigating, because a creator on this page is looking at a list, not
   * editing anything — and "get me the link" is the question the icon answers.
   *
   * The clipboard rejects on any page that is not a secure origin, which is exactly how you
   * would reach a dev server from a phone on the LAN (`http://192.168.x.x:3000` is not
   * secure). Falling back to showing the URL means the button is never a silent no-op.
   */
  const copyLink = async () => {
    if (!share) return;

    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast.success(
        isDraft
          ? "Link copied — this form is a draft, so it will not accept responses until you publish it."
          : "Link copied",
      );
    } catch {
      toast.error("Could not copy", {
        description: share,
      });
    }
  };

  return (
    <Card className="group rounded-lg flex flex-col justify-between gap-0 py-0 overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pt-6 pb-3">
        <CardTitle className="text-base truncate">{title}</CardTitle>
        {description && (
          <CardDescription className="line-clamp-2 text-sm">{description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="size-3.5 shrink-0" />
          <span>{formatDate(createdAt)}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-4 pb-5 border-t mt-4">
        <Button
          size="icon"
          variant="ghost"
          // Named per form: a grid of eight identical "Copy link" buttons tells a screen
          // reader nothing about which is which.
          aria-label={`Copy share link for ${title}`}
          disabled={!share}
          onClick={() => void copyLink()}
          className={cn(
            "size-8 rounded-md transition-colors",
            // Dimmed rather than hidden, so a draft still offers the link — sharing one
            // early is a real thing to want — and the toast explains why it will not work yet.
            isDraft && "text-muted-foreground/60",
          )}
        >
          {copied ? (
            <CheckIcon className="text-[#2ead4b]" />
          ) : (
            <LinkIcon className={cn("transition-transform", isDraft && "opacity-70")} />
          )}
        </Button>

        <Link href={`/forms/${id}/build`} id={`open-form-${id}`} className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 group-hover:border-primary group-hover:text-primary transition-colors"
          >
            Open Builder
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

// ── Forms Page ─────────────────────────────────────────────────────────────────
const FormsPage = () => {
  const { forms, isLoading } = useListForms();

  const hasForms = forms && forms.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and build your forms</p>
        </div>
        <CreateFormModal />
      </div>

      {/* Loading skeleton grid */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <FormCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Forms grid */}
      {!isLoading && hasForms && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              id={form.id}
              slug={form.slug}
              title={form.title}
              description={form.description}
              status={form.status}
              createdAt={form.createdAt ? new Date(form.createdAt) : null}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasForms && (
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
      )}
    </div>
  );
};

export default FormsPage;
