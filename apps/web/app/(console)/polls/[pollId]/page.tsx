"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  ArrowLeftIcon,
  CheckIcon,
  LinkIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Field, FieldLabel } from "~/components/ui/field";
import { Skeleton } from "~/components/ui/skeleton";
import {
  useDeletePoll,
  useGetPoll,
  useGetPollInsights,
  useSetPollStatus,
  useUpdatePoll,
} from "~/hooks/api/poll";
import { publicPollUrl } from "~/lib/poll-url";
import { cn } from "~/lib/utils";
import { PollStatusBadge } from "~/components/console/poll-status-badge";
import { PollResultsBars } from "~/components/polls/poll-results-bars";
import { useLivePollResults } from "~/components/polls/use-live-poll-results";

// ── Header ───────────────────────────────────────────────────────────────────
function PollHeader({ pollId }: { pollId: string }) {
  const router = useRouter();
  const { poll, isLoading } = useGetPoll(pollId);
  const { setPollStatusAsync, status: mutationStatus } = useSetPollStatus();
  const { deletePollAsync, status: deleteStatus } = useDeletePoll();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !poll) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    );
  }

  const share = publicPollUrl(poll.slug);
  const isToggling = mutationStatus === "pending";
  const isDeleting = deleteStatus === "pending";

  const copyLink = async () => {
    if (!share) return;

    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(
        poll.status === "DRAFT"
          ? "Link copied — this poll is a draft, so nobody can vote yet."
          : "Link copied",
      );
    } catch {
      toast.error("Could not copy", { description: share });
    }
  };

  const setStatus = async (status: "OPEN" | "CLOSED") => {
    try {
      await setPollStatusAsync({ pollId, status });
      toast.success(status === "OPEN" ? "Poll is open for voting" : "Poll is closed");
    } catch {
      toast.error("Could not change the poll's status");
    }
  };

  const remove = async () => {
    try {
      await deletePollAsync({ pollId });
      toast.success("Poll deleted");
      router.push("/polls");
    } catch {
      toast.error("Could not delete the poll");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/polls"
        className="text-muted-foreground inline-flex w-fit items-center gap-1.5 text-sm hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All polls
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{poll.title}</h1>
            <PollStatusBadge status={poll.status} />
          </div>
          {poll.description && (
            <p className="text-muted-foreground mt-1 text-sm">{poll.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void copyLink()}
            disabled={!share}
            className="gap-1.5"
          >
            {copied ? (
              <CheckIcon className="size-4 text-positive" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            Share
          </Button>

          {poll.status === "DRAFT" && (
            <Button size="sm" disabled={isToggling} onClick={() => void setStatus("OPEN")}>
              Open poll
            </Button>
          )}
          {poll.status === "OPEN" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isToggling}
              onClick={() => void setStatus("CLOSED")}
            >
              Close poll
            </Button>
          )}
          {poll.status === "CLOSED" && (
            <Button size="sm" disabled={isToggling} onClick={() => void setStatus("OPEN")}>
              Reopen
            </Button>
          )}

          {(poll.status === "DRAFT" || poll.status === "CLOSED") && (
            <EditPollDialog
              pollId={pollId}
              title={poll.title}
              description={poll.description}
              open={editOpen}
              onOpenChange={setEditOpen}
            />
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive gap-1.5">
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
                <AlertDialogDescription>
                  {poll.title} and all of its votes will be permanently deleted. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void remove()}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting…" : "Delete poll"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ── Edit dialog ──────────────────────────────────────────────────────────────
function EditPollDialog({
  pollId,
  title,
  description,
  open,
  onOpenChange,
}: {
  pollId: string;
  title: string;
  description: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePollAsync, status } = useUpdatePoll();
  const isPending = status === "pending";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ title: string; description?: string }>({
    defaultValues: { title, description: description ?? "" },
  });

  // Re-seed the form whenever it opens: the header may have re-rendered with newer
  // values since the last edit, and stale defaults would silently revert them.
  React.useEffect(() => {
    if (open) reset({ title, description: description ?? "" });
  }, [open, title, description, reset]);

  const onSubmit: SubmitHandler<{ title: string; description?: string }> = async (data) => {
    try {
      await updatePollAsync({
        pollId,
        title: data.title,
        description: data.description || null,
      });
      onOpenChange(false);
      toast.success("Poll updated");
    } catch {
      toast.error("Could not update the poll");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <PencilIcon className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit poll</DialogTitle>
          <DialogDescription>
            Options cannot be changed once a poll has opened — only its name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="poll-edit-title">
              Title <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="poll-edit-title"
              disabled={isPending}
              {...register("title", {
                required: "Title is required",
                maxLength: { value: 120, message: "Title must be 120 characters or fewer" },
              })}
            />
            {errors.title && (
              <p className="text-destructive text-xs mt-1">{errors.title.message}</p>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="poll-edit-description">Description</FieldLabel>
            <Textarea
              id="poll-edit-description"
              disabled={isPending}
              {...register("description", {
                maxLength: { value: 300, message: "Description must be 300 characters or fewer" },
              })}
            />
            {errors.description && (
              <p className="text-destructive text-xs mt-1">{errors.description.message}</p>
            )}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────
function PollResults({ pollId, status }: { pollId: string; status: string }) {
  const { buckets, total, live, isLoading } = useLivePollResults(pollId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Results</CardTitle>
        {/*
          Whether the numbers on screen are moving. "Live" means the server accepted the
          watch and broadcasts land here; anything else means this is the last fetch,
          which is still correct — just still.
        */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
            live === "live"
              ? "bg-positive-subtle text-positive-foreground"
              : "bg-muted text-muted-foreground",
          )}
          role="status"
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live === "live" ? "bg-positive animate-pulse" : "bg-muted-foreground/50",
            )}
          />
          {live === "live" ? "Live" : live === "connecting" ? "Connecting…" : "Not live"}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <PollResultsBars buckets={buckets} total={total} />
            <p className="text-muted-foreground mt-4 text-sm tabular-nums">
              {total === 1 ? "1 vote" : `${total} votes`}
              {status !== "OPEN" && " · voting is closed"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Insights ─────────────────────────────────────────────────────────────────
function PollInsights({ pollId }: { pollId: string }) {
  const { insights, isLoading } = useGetPollInsights(pollId, 30);

  if (isLoading || !insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insights</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxDay = Math.max(1, ...insights.series.map((point) => point.count));
  const maxHour = Math.max(1, ...insights.peakHours.map((point) => point.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">Votes over time</p>
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Votes per day">
            {insights.series.map((point) => (
              <div
                key={point.day}
                title={`${point.day}: ${point.count}`}
                className={cn(
                  "min-w-0 flex-1 rounded-sm",
                  point.count > 0 ? "bg-primary" : "bg-muted",
                )}
                style={{ height: `${Math.max(4, (point.count / maxDay) * 100)}%` }}
              />
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
            <span>{insights.series[0]?.day}</span>
            <span>{insights.series[insights.series.length - 1]?.day}</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Peak voting hours (UTC)</p>
          <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Votes per hour">
            {insights.peakHours.map((point) => (
              <div
                key={point.hour}
                title={`${point.hour}:00 — ${point.count} votes`}
                className={cn(
                  "min-w-0 flex-1 rounded-sm",
                  point.count > 0 ? "bg-chart-2" : "bg-muted",
                )}
                style={{ height: `${Math.max(4, (point.count / maxHour) * 100)}%` }}
              />
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
            <span>00</span>
            <span>12</span>
            <span>23</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PollDetailPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { poll, isLoading } = useGetPoll(pollId);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PollHeader pollId={pollId} />

      {!isLoading && poll && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PollResults pollId={pollId} status={poll.status} />
          <PollInsights pollId={pollId} />
        </div>
      )}
    </div>
  );
}
