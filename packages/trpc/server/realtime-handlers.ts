import { z } from "zod";

import { pollRoom } from "./realtime";
import { getAuthenticationCookie } from "./utils/cookie";
import { createRateLimiter, RATE_LIMITS } from "./utils/rate-limit";
import { pollService, userService } from "./services";

/**
 * Who may listen to a poll's live tally, enforced where the socket is accepted.
 *
 * Two gates, matching the two audiences:
 *
 * - `poll:subscribe` (voters): the device must already have voted. Joining is the gate —
 *   nothing about the tally is sent before it — so "results after voting" is enforced
 *   server-side rather than hidden client-side.
 * - `poll:watch` (creators): the auth cookie must belong to the poll's owner.
 *
 * Both answer with an ack, never by throwing: a socket handler that throws disconnects the
 * client, which turns a wrong slug into a dropped connection. The client treats any non-ok
 * ack as "live updates unavailable" and keeps showing its last tRPC fetch.
 *
 * Rate limiting reuses the transport-agnostic limiter from `./utils/rate-limit`, keyed on
 * the handshake IP under the `public` policy. Subscribes are cheap reads, but an unchecked
 * event is a loop a client can spin for free.
 */

const subscribeInputSchema = z.object({
  slug: z.string().min(1).max(64),
  deviceId: z.string().uuid(),
});

const watchInputSchema = z.object({
  pollId: z.string().min(1),
});

export type SubscribeError =
  | "not-found"
  | "not-voted"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "invalid";

export interface SubscribeAck {
  (response: { ok: true; tally: unknown } | { ok: false; error: SubscribeError }): void;
}

/** The narrowest socket surface the handlers need — fakes satisfy this in tests. */
export interface RealtimeSocket {
  handshake: {
    headers: { cookie?: string };
    address: string;
  };
  join(room: string): void | Promise<void>;
  on(event: "poll:subscribe" | "poll:watch", handler: (input: unknown, ack: SubscribeAck) => void): void;
}

export interface RealtimeServer {
  on(event: "connection", handler: (socket: RealtimeSocket) => void): void;
}

/**
 * Everything the handlers read, as parameters rather than imports.
 *
 * The production wiring passes the real services; tests pass fakes. The alternative —
 * importing the services here and testing through a database — would make a wrong ack cost
 * a database round trip to discover, and these gates are exactly the kind of logic that
 * deserves a fast answer.
 */
export interface RealtimeHandlerDeps {
  getPublicPoll: (input: { slug: string; deviceId: string }) => Promise<{
    id: string;
    voted: boolean;
    tally: unknown;
  }>;
  getResultsForCreator: (userId: string, input: { pollId: string }) => Promise<unknown>;
  verifyUserToken: (token: string) => Promise<{ id: string }>;
}

const consumeSubscribe = createRateLimiter(RATE_LIMITS.public);

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;

    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }

  return cookies;
}

function errorOf(error: unknown): SubscribeError {
  if (error instanceof z.ZodError) return "invalid";

  // Service errors arrive already converted (see `typedService`): AppError kinds become
  // tRPC codes, so the mapping below reads the wire shape, not the service internals.
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  switch (code) {
    case "NOT_FOUND":
      return "not-found";
    case "FORBIDDEN":
      return "forbidden";
    case "UNAUTHORIZED":
      return "unauthorized";
    case "TOO_MANY_REQUESTS":
      return "rate-limited";
    default:
      return "invalid";
  }
}

export function handlePollSubscribe(
  socket: RealtimeSocket,
  input: unknown,
  ack: SubscribeAck,
  deps: RealtimeHandlerDeps,
): Promise<void> {
  return (async () => {
    const parsed = subscribeInputSchema.parse(input);
    await consumeSubscribe(socket.handshake.address);

    const poll = await deps.getPublicPoll(parsed);
    if (!poll.voted || !poll.tally) {
      ack({ ok: false, error: "not-voted" });
      return;
    }

    await socket.join(pollRoom(poll.id));
    ack({ ok: true, tally: poll.tally });
  })().catch((error: unknown) => {
    ack({ ok: false, error: errorOf(error) });
  });
}

export function handlePollWatch(
  socket: RealtimeSocket,
  input: unknown,
  ack: SubscribeAck,
  deps: RealtimeHandlerDeps,
): Promise<void> {
  return (async () => {
    const parsed = watchInputSchema.parse(input);
    await consumeSubscribe(socket.handshake.address);

    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = getAuthenticationCookie({ getCookie: (name: string) => cookies[name] });
    if (!token) {
      ack({ ok: false, error: "unauthorized" });
      return;
    }

    let userId: string;
    try {
      ({ id: userId } = await deps.verifyUserToken(token));
    } catch {
      // Invalid, expired, or forged — indistinguishable by design, and all denied alike.
      ack({ ok: false, error: "unauthorized" });
      return;
    }

    const tally = await deps.getResultsForCreator(userId, { pollId: parsed.pollId });
    await socket.join(pollRoom(parsed.pollId));
    ack({ ok: true, tally });
  })().catch((error: unknown) => {
    ack({ ok: false, error: errorOf(error) });
  });
}

const productionDeps: RealtimeHandlerDeps = {
  getPublicPoll: (input) => pollService.getPublicPoll(input),
  getResultsForCreator: (userId, input) => pollService.getResultsForCreator(userId, input),
  verifyUserToken: (token) => userService.verifyAndDecodeUserToken(token),
};

/**
 * Accept poll subscriptions on a Socket.IO server.
 *
 * `deps` defaults to the real services; tests pass fakes to `handlePollSubscribe` and
 * `handlePollWatch` directly instead of going through a socket.
 */
export function registerRealtimeHandlers(
  io: RealtimeServer,
  deps: RealtimeHandlerDeps = productionDeps,
): void {
  io.on("connection", (socket) => {
    socket.on("poll:subscribe", (input, ack) => {
      void handlePollSubscribe(socket, input, ack, deps);
    });
    socket.on("poll:watch", (input, ack) => {
      void handlePollWatch(socket, input, ack, deps);
    });
  });
}
