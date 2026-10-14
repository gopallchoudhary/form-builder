/**
 * What a voter sees, decided from the poll query alone.
 *
 * Extracted because the branches are easy to get subtly wrong — a closed poll must still
 * show its final tally to someone who voted, while a stranger gets only the closed notice —
 * and rendering code is the worst place to reason about that. Each state maps to one branch
 * in the voter component, and nothing else.
 */

export type VoterView =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "closed" }
  | { kind: "vote" }
  | { kind: "results" };

interface VoterPoll {
  status: "DRAFT" | "OPEN" | "CLOSED";
  voted: boolean;
}

export function resolveVoterView({
  isLoading,
  isError,
  poll,
}: {
  isLoading: boolean;
  isError: boolean;
  poll: VoterPoll | null | undefined;
}): VoterView {
  if (isLoading) return { kind: "loading" };

  // Drafts read as missing all the way down: the service throws NOT_FOUND for them, which
  // lands here as an error with no poll, identical to an unknown slug.
  if (isError || !poll) return { kind: "missing" };

  // Voted is checked before status: someone who voted before the close still gets the final
  // tally, while a stranger only gets told it is over.
  if (poll.voted) return { kind: "results" };
  if (poll.status === "CLOSED") return { kind: "closed" };

  return { kind: "vote" };
}
