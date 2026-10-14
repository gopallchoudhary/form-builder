"use client";

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useCastVote, usePublicPoll } from "~/hooks/api/public";
import { readDeviceId } from "~/lib/device";
import { resolveVoterView } from "~/lib/poll-voter";
import { PollResultsBars } from "~/components/polls/poll-results-bars";
import { useLiveVoterTally } from "~/components/polls/use-live-voter-tally";
import { cn } from "~/lib/utils";

/**
 * Everything a voter sees, in one component.
 *
 * Which branch renders comes from `resolveVoterView`, not from inline conditions: a closed
 * poll still shows its final tally to someone who voted, while a stranger only gets the
 * closed notice, and that distinction is too easy to get subtly wrong inside JSX.
 */
export function PollVoter({ slug }: { slug: string }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // localStorage exists only in the browser; the first render happens without it.
  useEffect(() => {
    setDeviceId(readDeviceId());
  }, []);

  const { poll, isLoading, isError } = usePublicPoll(slug, deviceId);

  const view = resolveVoterView({
    isLoading: isLoading || !deviceId,
    isError,
    poll: poll ? { status: poll.status, voted: poll.voted } : poll,
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
      {view.kind === "loading" && (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      )}

      {view.kind === "missing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">We could not find that poll</p>
            <p className="text-muted-foreground text-sm">
              The link may have a typo in it, or the poll may have been deleted.
            </p>
          </CardContent>
        </Card>
      )}

      {view.kind === "closed" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">This poll is closed</p>
            <p className="text-muted-foreground text-sm">
              Voting has ended. Ask the creator to reopen it if you think that is a mistake.
            </p>
          </CardContent>
        </Card>
      )}

      {view.kind === "vote" && poll && deviceId && (
        <VoteForm
          pollId={poll.id}
          title={poll.title}
          description={poll.description}
          options={poll.options}
          deviceId={deviceId}
          currentOptionId={null}
        />
      )}

      {view.kind === "results" && poll && deviceId && poll.tally && (
        <VoteResults
          slug={slug}
          pollId={poll.id}
          title={poll.title}
          description={poll.description}
          status={poll.status}
          options={poll.options}
          baseBuckets={poll.tally.buckets}
          baseTotal={poll.tally.total}
          deviceId={deviceId}
          votedOptionId={poll.optionId}
        />
      )}
    </div>
  );
}

// ── Voting ───────────────────────────────────────────────────────────────────
function VoteForm({
  pollId,
  title,
  description,
  options,
  deviceId,
  currentOptionId,
}: {
  pollId: string;
  title: string;
  description: string | null;
  options: Array<{ id: string; label: string }>;
  deviceId: string;
  /** The option this device already chose, if any — picking another moves the vote. */
  currentOptionId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(currentOptionId);
  const [failure, setFailure] = useState<string | null>(null);
  const { castVoteAsync, status } = useCastVote();
  const isPending = status === "pending";

  const dirty = selected !== null && selected !== currentOptionId;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !dirty) return;

    setFailure(null);
    try {
      // No local tally update here: the mutation's onSuccess invalidates the poll query
      // and the broadcast lands on top, so both paths converge without an optimistic
      // value that could disagree with either.
      await castVoteAsync({ pollId, deviceId, optionId: selected });
    } catch {
      setFailure(
        "That vote did not land. The poll may have just closed, or you may be voting too fast — wait a moment and try again.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <fieldset disabled={isPending} className="flex flex-col gap-2">
            <legend className="sr-only">Choose an option</legend>
            {options.map((option) => {
              const checked = selected === option.id;
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="radio"
                    name={`poll-${pollId}`}
                    value={option.id}
                    checked={checked}
                    onChange={() => setSelected(option.id)}
                    className="accent-primary size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </label>
              );
            })}
          </fieldset>

          {failure && (
            <p role="alert" className="text-destructive text-sm">
              {failure}
            </p>
          )}

          <Button type="submit" disabled={!dirty || isPending} className="mt-1">
            {isPending ? "Saving…" : currentOptionId ? "Update vote" : "Vote"}
          </Button>

          {currentOptionId && !dirty && (
            <p className="text-muted-foreground text-xs">
              That is your current vote. Pick another option to move it.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// ── Results ────────────────────────────────────────────────────────────────
function VoteResults({
  slug,
  pollId,
  title,
  description,
  status,
  options,
  baseBuckets,
  baseTotal,
  deviceId,
  votedOptionId,
}: {
  slug: string;
  pollId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
  options: Array<{ id: string; label: string }>;
  baseBuckets: Array<{ optionId: string; label: string; count: number }>;
  baseTotal: number;
  deviceId: string;
  votedOptionId: string | null;
}) {
  const [changing, setChanging] = useState(false);
  const { buckets, total, live } = useLiveVoterTally({
    pollId,
    slug,
    deviceId,
    base: baseBuckets,
    baseTotal,
    enabled: true,
  });

  /*
   * Changing a vote reuses the vote form rather than growing a second one. The toggle
   * costs one extra click against duplicating every line above — and the form already
   * handles the "already voted" case, since that is what `currentOptionId` is for.
   */
  if (changing && status === "OPEN") {
    return (
      <div className="flex flex-col gap-3">
        <VoteForm
          pollId={pollId}
          title={title}
          description={description}
          options={options}
          deviceId={deviceId}
          currentOptionId={votedOptionId}
        />
        <Button variant="ghost" size="sm" onClick={() => setChanging(false)} className="self-center">
          Back to results
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              live
                ? "bg-positive-subtle text-positive-foreground"
                : "bg-muted text-muted-foreground",
            )}
            role="status"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                live ? "bg-positive animate-pulse" : "bg-muted-foreground/50",
              )}
            />
            {live ? "Live" : "Results"}
          </span>
        </div>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PollResultsBars buckets={buckets} total={total} highlightOptionId={votedOptionId} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm tabular-nums">
            {total === 1 ? "1 vote" : `${total} votes`}
            {status === "CLOSED" && " · voting is closed"}
          </p>
          {status === "OPEN" && (
            <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
              Change vote
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
