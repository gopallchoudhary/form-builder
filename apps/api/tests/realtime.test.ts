import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachRealtimeServer,
  detachRealtimeServer,
  emitPollResults,
  pollRoom,
} from "@repo/trpc/server";

/**
 * The realtime emitter.
 *
 * Everything socket-shaped here is a fake: the point under test is the routing (rooms,
 * payloads, unattached behaviour), not Socket.IO itself. A real socket would make this an
 * integration test with a port in it, for no additional coverage of our logic.
 */

const fakeBus = () => {
  const calls: Array<{ room: string; event: string; payload: unknown }> = [];
  return {
    calls,
    bus: {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          calls.push({ room, event, payload });
          return true;
        },
      }),
    },
  };
};

describe("pollRoom", () => {
  it("namespaces rooms per poll so tallies never cross", () => {
    expect(pollRoom("a")).toBe("poll:a");
    expect(pollRoom("a")).not.toBe(pollRoom("b"));
  });
});

describe("emitPollResults", () => {
  beforeEach(() => {
    detachRealtimeServer();
    vi.restoreAllMocks();
  });

  it("emits the tally to the poll's room with the poll id attached", () => {
    const { bus, calls } = fakeBus();
    attachRealtimeServer(bus);

    emitPollResults("poll-1", {
      counts: { red: 3, blue: 1 },
      total: 4,
      updatedAt: "2026-10-14T00:00:00.000Z",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      room: "poll:poll-1",
      event: "poll:results",
      payload: {
        pollId: "poll-1",
        counts: { red: 3, blue: 1 },
        total: 4,
        updatedAt: "2026-10-14T00:00:00.000Z",
      },
    });
  });

  it("drops the event with a warning when no server is attached", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() =>
      emitPollResults("poll-1", { counts: {}, total: 0, updatedAt: "now" }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
