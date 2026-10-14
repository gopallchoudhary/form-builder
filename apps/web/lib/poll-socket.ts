"use client";

import { io, type Socket } from "socket.io-client";

import { env } from "~/env.js";

/**
 * The single Socket.IO connection for poll live-updates.
 *
 * Lazy and shared: the first subscriber creates it, and it lives for the session. One socket
 * per tab is the whole point — every poll watcher multiplexes over rooms on this connection
 * rather than opening their own.
 *
 * The URL is the API *origin*, not the tRPC endpoint. `NEXT_PUBLIC_API_URL` points at
 * `…/trpc` for the query client, and handing that path to `io()` would make the handshake
 * miss the server's Socket.IO handler. Stripping to the origin keeps one env var serving
 * both transports.
 *
 * Broadcast-only by design (see `packages/trpc/server/realtime.ts`): nothing here emits a
 * vote. Votes travel over tRPC mutations; this socket only carries `poll:results` payloads
 * that tell the UI fresh tallies exist.
 */

let socket: Socket | null = null;

function apiOrigin(): string {
  const trpcUrl = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc";
  try {
    const parsed = new URL(trpcUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "http://localhost:8000";
  }
}

export function getPollSocket(): Socket {
  if (!socket) {
    socket = io(apiOrigin(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });
  }
  return socket;
}

/** For tests: drop the singleton so cases cannot leak a connection through each other. */
export function resetPollSocket(): void {
  socket?.disconnect();
  socket = null;
}
