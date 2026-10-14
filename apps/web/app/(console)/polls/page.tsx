"use client";

import React, { useState } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChartPieIcon,
  CheckIcon,
  LinkIcon,
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
import { Skeleton } from "~/components/ui/skeleton";
import Link from "next/link";
import { useListPolls, useSetPollStatus } from "~/hooks/api/poll";
import { publicPollUrl } from "~/lib/poll-url";
import { cn } from "~/lib/utils";
import { CreatePollDialog } from "~/components/console/create-poll-dialog";
import { PollStatusBadge, type PollStatus } from "~/components/console/poll-status-badge";

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// ── Poll Card Skeleton ─────────────────────────────────────────────────────────
function PollCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center justify-between mt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

// ── Poll Card ──────────────────────────────────────────────────────────────────
function PollCard({
  id,
  slug,
  title,
  description,
  status,
  totalVotes,
  createdAt,
}: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: PollStatus;
  totalVotes: number;
  createdAt: Date | null;
}) {
  const [copied, setCopied] = useState(false);
  const { setPollStatusAsync, status: mutationStatus } = useSetPollStatus();

  const share = publicPollUrl(slug);
  const isDraft = status === "DRAFT";
  const isOpen = status === "OPEN";
  const isToggling = mutationStatus === "pending";

  const copyLink = async () => {
    if (!share) return;

    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast.success(
        isDraft
          ? "Link copied — this poll is a draft, so nobody can vote yet. Open it from its page."
          : "Link copied",
      );
    } catch {
      toast.error("Could not copy", {
        description: share,
      });
    }
  };

  /*
   * The only status move the list offers is the one a creator reaches for mid-day: open a
   * draft's voting, or close a live one. Anything else — reopening, renaming — lives on the
   * detail page, where the consequences are visible next to the tally.
   */
  const toggleStatus = async () => {
    const next = isDraft || !isOpen ? "OPEN" : "CLOSED";

    try {
      await setPollStatusAsync({ pollId: id, status: next });
      toast.success(next === "OPEN" ? "Poll is open for voting" : "Poll is closed");
    } catch {
      toast.error("Could not change the poll's status");
    }
  };

  return (
    <Card className="group rounded-lg flex flex-col justify-between gap-0 py-0 overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pt-6 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base truncate">{title}</CardTitle>
          <PollStatusBadge status={status} className="shrink-0" />
        </div>
        {description && (
          <CardDescription className="line-clamp-2 text-sm">{description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ChartPieIcon className="size-3.5 shrink-0" />
            {totalVotes === 1 ? "1 vote" : `${totalVotes} votes`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5 shrink-0" />
            <span>{formatDate(createdAt)}</span>
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-4 pb-5 border-t mt-4">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Copy share link for ${title}`}
          disabled={!share}
          onClick={() => void copyLink()}
          className={cn(
            "size-8 rounded-md transition-colors",
            isDraft && "text-muted-foreground/60",
          )}
        >
          {copied ? (
            <CheckIcon className="text-positive" />
          ) : (
            <LinkIcon className={cn("transition-transform", isDraft && "opacity-70")} />
          )}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isToggling}
            onClick={() => void toggleStatus()}
          >
            {isOpen ? "Close" : "Open"}
          </Button>
          <Link href={`/polls/${id}`}>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 group-hover:border-primary group-hover:text-primary transition-colors"
            >
              Open
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

// ── Polls Page ─────────────────────────────────────────────────────────────────
const PollsPage = () => {
  const { polls, isLoading } = useListPolls();

  const hasPolls = polls && polls.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Polls</h1>
          <p className="text-muted-foreground text-sm mt-1">Ask one question, watch the votes land</p>
        </div>
        <CreatePollDialog />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PollCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && hasPolls && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              id={poll.id}
              slug={poll.slug}
              title={poll.title}
              description={poll.description}
              status={poll.status}
              totalVotes={poll.totalVotes}
              createdAt={poll.createdAt ? new Date(poll.createdAt) : null}
            />
          ))}
        </div>
      )}

      {!isLoading && !hasPolls && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            <ChartPieIcon className="text-muted-foreground size-7" />
          </div>
          <div>
            <p className="font-medium">No polls yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first poll to get started
            </p>
          </div>
          <CreatePollDialog />
        </div>
      )}
    </div>
  );
};

export default PollsPage;
