"use client";

import { useEffect, useState } from "react";

import { useGetPollResults } from "~/hooks/api/poll";
import { getPollSocket } from "~/lib/poll-socket";
import { applyLiveCounts, type TallyBucket } from "~/lib/poll-tally";

export type LiveState = "connecting" | "live" | "unavailable";

interface SocketTally {
  pollId: string;
  counts: Record<string, number>;
  total: number;
  updatedAt: string;
}

/**
 * A poll's tally, live.
 *
 * Starts from the tRPC fetch — so the page renders real numbers immediately, socket or no
 * socket — then folds each `poll:results` broadcast into those buckets. Labels and order
 * come from the fetch and never move; only the numbers do.
 *
 * `live` is honest about the transport: `"live"` once the server accepts the watch,
 * `"unavailable"` if it refuses or the socket never connects. Anything else shows the last
 * fetch with the badge saying so, rather than a spinner pretending numbers are coming.
 *
 * The creator authenticates with the session cookie, which the handshake carries because
 * the socket was created `withCredentials`. No token is passed in the open — the server
 * checks ownership from the cookie, the same way the REST surface does.
 */
export function useLivePollResults(pollId: string | null): {
  buckets: TallyBucket[];
  total: number;
  live: LiveState;
  isLoading: boolean;
} {
  const { results, isLoading } = useGetPollResults(pollId);

  const [liveCounts, setLiveCounts] = useState<Record<string, number> | null>(null);
  const [liveTotal, setLiveTotal] = useState<number | null>(null);
  const [live, setLive] = useState<LiveState>("connecting");

  useEffect(() => {
    if (!pollId) return;

    let cancelled = false;
    const socket = getPollSocket();

    socket.emit("poll:watch", { pollId }, (response: unknown) => {
      if (cancelled) return;

      if (
        typeof response === "object" &&
        response !== null &&
        (response as { ok?: unknown }).ok === true
      ) {
        setLive("live");
      } else {
        // Refused — wrong owner, missing poll, rate-limited. The fetch below still shows
        // the tally; it just will not move until a reload.
        setLive("unavailable");
      }
    });

    const onResults = (payload: unknown) => {
      if (cancelled) return;

      const tally = payload as Partial<SocketTally> | null;
      if (!tally || tally.pollId !== pollId) return;
      if (typeof tally.total !== "number" || typeof tally.counts !== "object" || !tally.counts) {
        return;
      }

      setLiveCounts({ ...tally.counts });
      setLiveTotal(tally.total);
      setLive("live");
    };

    socket.on("poll:results", onResults);

    // Reaching this effect without an answer means the socket itself is down, not merely
    // refused: the server always acks, even to deny. A short grace period keeps a slow
    // handshake from flashing "unavailable" on every load.
    const grace = setTimeout(() => {
      if (!cancelled) {
        setLive((state) => (state === "connecting" ? "unavailable" : state));
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(grace);
      socket.off("poll:results", onResults);
    };
  }, [pollId]);

  const base = results?.buckets ?? [];
  const buckets = liveCounts ? applyLiveCounts(base, liveCounts) : base;
  const total = liveTotal ?? results?.total ?? 0;

  return { buckets, total, live, isLoading };
}
