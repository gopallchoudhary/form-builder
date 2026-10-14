"use client";

import { useEffect, useState } from "react";

import { getPollSocket } from "~/lib/poll-socket";
import { applyLiveCounts, type TallyBucket } from "~/lib/poll-tally";

interface SocketTally {
  pollId: string;
  counts: Record<string, number>;
  total: number;
  updatedAt: string;
}

/**
 * A voter-facing live tally for one poll.
 *
 * The creator hook (`use-live-poll-results`) cannot be reused here: it authenticates with a
 * session cookie the voter does not have, and it watches by poll id, which the voter never
 * sees. This subscribes by slug plus device id instead, and the server only lets the join
 * happen for a device that voted — so the hook never sees a tally the voter is not entitled
 * to, and there is nothing here to get wrong about that.
 *
 * Like its sibling, this starts from fetched buckets and folds broadcasts into them. Labels
 * and order come from the fetch and never move; only the numbers do.
 */
export function useLiveVoterTally({
  pollId,
  slug,
  deviceId,
  base,
  baseTotal,
  enabled,
}: {
  pollId: string | null;
  slug: string;
  deviceId: string | null;
  base: readonly TallyBucket[];
  baseTotal: number;
  enabled: boolean;
}): {
  buckets: TallyBucket[];
  total: number;
  live: boolean;
} {
  const [liveCounts, setLiveCounts] = useState<Record<string, number> | null>(null);
  const [liveTotal, setLiveTotal] = useState<number | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled || !pollId || !deviceId) return;

    let cancelled = false;
    const socket = getPollSocket();

    socket.emit("poll:subscribe", { slug, deviceId }, (response: unknown) => {
      if (cancelled) return;

      // Accepted: the ack carries the current tally, which covers the gap between the fetch
      // and the first broadcast. Refused (or silent): the fetch below is still correct, just
      // still.
      if (
        typeof response === "object" &&
        response !== null &&
        (response as { ok?: unknown }).ok === true
      ) {
        const tally = (response as { tally?: Partial<SocketTally> | null }).tally;
        if (tally && typeof tally.counts === "object" && tally.counts) {
          setLiveCounts({ ...tally.counts });
        }
        if (tally && typeof tally.total === "number") {
          setLiveTotal(tally.total);
        }
        setLive(true);
      }
    });

    const onResults = (payload: unknown) => {
      if (cancelled) return;

      const tally = payload as Partial<SocketTally> | null;
      if (!tally || tally.pollId !== pollId) return;
      if (typeof tally.counts !== "object" || !tally.counts) return;

      setLiveCounts({ ...tally.counts });
      if (typeof tally.total === "number") setLiveTotal(tally.total);
      setLive(true);
    };

    socket.on("poll:results", onResults);

    // No grace timer here, unlike the creator hook: a refused join is an expected outcome
    // (the device has not voted), not a failure, so there is nothing to escalate to.
    return () => {
      cancelled = true;
      socket.off("poll:results", onResults);
    };
  }, [enabled, pollId, slug, deviceId]);

  return {
    buckets: liveCounts ? applyLiveCounts(base, liveCounts) : [...base],
    // The broadcast total is authoritative while live: re-summing the merged buckets would
    // disagree with it whenever the payload and the fetch were taken a vote apart.
    total: liveTotal ?? baseTotal,
    live,
  };
}
