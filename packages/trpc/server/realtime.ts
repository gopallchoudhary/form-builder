/**
 * Outbound realtime bus.
 *
 * Socket.IO is broadcast-only here by design: votes travel over tRPC mutations (which keeps
 * zod validation, rate limiting and deviceId auth on the write path), and the socket only
 * tells interested clients that fresh tallies exist. A socket that could write would need a
 * second copy of every guard the mutation already has.
 *
 * Lifetime: `apps/api` creates the Socket.IO server against its raw `http.Server` and hands
 * it over once via `attachRealtimeServer`. Until then — unit tests, the OpenAPI doc build,
 * any context without a socket — `emitPollResults` drops the event with a warning instead of
 * throwing, so nothing outside a running API process needs a socket to exist.
 *
 * Deliberately free of a `socket.io` import. The holder is structural (`to(room).emit(...)`),
 * which the real `Server` satisfies, so this package gains no new dependency for a bus it
 * only ever sends through.
 */

interface RoomEmitter {
  // `unknown` return on purpose: Socket.IO's `emit` returns `this` for chaining, and a
  // method returning `this` is not assignable to one returning `boolean`. `unknown` accepts
  // any of them without importing `socket.io` here.
  to(room: string): { emit(event: string, payload: unknown): unknown };
}

let bus: RoomEmitter | null = null;

export function attachRealtimeServer(server: RoomEmitter): void {
  bus = server;
}

/** For tests: forget the attached server so cases cannot leak through each other. */
export function detachRealtimeServer(): void {
  bus = null;
}

/** The room every watcher of one poll joins, creator and voter alike. */
export function pollRoom(pollId: string): string {
  return `poll:${pollId}`;
}

export interface PollResultsPayload {
  pollId: string;
  /** Votes per option id. Percentages are derived client-side; they need no wire cost. */
  counts: Record<string, number>;
  total: number;
  /** ISO timestamp of the vote that triggered this broadcast. */
  updatedAt: string;
}

export function emitPollResults(pollId: string, tally: Omit<PollResultsPayload, "pollId">): void {
  if (!bus) {
    console.warn("[realtime] emitPollResults before attachRealtimeServer; dropping event", {
      pollId,
    });
    return;
  }
  bus.to(pollRoom(pollId)).emit("poll:results", { ...tally, pollId });
}
