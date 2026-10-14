import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePollSubscribe,
  handlePollWatch,
  type RealtimeHandlerDeps,
  type RealtimeSocket,
  type SubscribeAck,
} from "../server/realtime-handlers";
import { resetRateLimits } from "../server/utils/rate-limit";

/**
 * Who may listen to a poll's live tally.
 *
 * Fakes throughout: a fake socket that records joins, and injected service doubles instead
 * of a database. The gates are pure decisions over those two inputs — admitted or denied,
 * joined or not — so nothing here needs a row to prove it. What needs rows (ownership,
 * vote existence) is already covered where the rows live, in the service tests.
 */

const TALLY = {
  buckets: [
    { optionId: "ramen", label: "Ramen", count: 3 },
    { optionId: "thali", label: "Thali", count: 1 },
  ],
  total: 4,
};

function socket(cookie?: string): RealtimeSocket & { joined: string[] } {
  const joined: string[] = [];
  return {
    joined,
    handshake: {
      headers: cookie ? { cookie } : {},
      address: "127.0.0.1",
    },
    join: (room: string) => {
      joined.push(room);
    },
    on: () => undefined,
  };
}

function deps(): RealtimeHandlerDeps & {
  getPublicPoll: ReturnType<typeof vi.fn>;
  getResultsForCreator: ReturnType<typeof vi.fn>;
  verifyUserToken: ReturnType<typeof vi.fn>;
} {
  return {
    getPublicPoll: vi.fn(),
    getResultsForCreator: vi.fn(),
    verifyUserToken: vi.fn(),
  };
}

function ackRecorder() {
  const responses: Parameters<SubscribeAck>[0][] = [];
  const ack: SubscribeAck = (response) => {
    responses.push(response);
  };
  return { responses, ack };
}

const coded = (code: string) =>
  Object.assign(new Error(code), { code });

describe("poll:subscribe", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("joins the poll's room and hands over the tally once the device voted", async () => {
    const fake = socket();
    const services = deps();
    services.getPublicPoll.mockResolvedValue({ id: "poll-1", voted: true, tally: TALLY });
    const { responses, ack } = ackRecorder();

    await handlePollSubscribe(
      fake,
      { slug: "lunch", deviceId: "22222222-2222-4222-8222-222222222222" },
      ack,
      services,
    );

    expect(fake.joined).toEqual(["poll:poll-1"]);
    expect(responses).toEqual([{ ok: true, tally: TALLY }]);
  });

  it("denies a device that has not voted, without joining", async () => {
    const fake = socket();
    const services = deps();
    services.getPublicPoll.mockResolvedValue({ id: "poll-1", voted: false, tally: null });
    const { responses, ack } = ackRecorder();

    await handlePollSubscribe(
      fake,
      { slug: "lunch", deviceId: "22222222-2222-4222-8222-222222222222" },
      ack,
      services,
    );

    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "not-voted" }]);
  });

  it("answers an unknown slug the same as a missing poll, without joining", async () => {
    const fake = socket();
    const services = deps();
    services.getPublicPoll.mockRejectedValue(coded("NOT_FOUND"));
    const { responses, ack } = ackRecorder();

    await handlePollSubscribe(
      fake,
      { slug: "nope", deviceId: "22222222-2222-4222-8222-222222222222" },
      ack,
      services,
    );

    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "not-found" }]);
  });

  it("rejects malformed input before touching any service", async () => {
    const fake = socket();
    const services = deps();
    const { responses, ack } = ackRecorder();

    await handlePollSubscribe(fake, { slug: "lunch", deviceId: "not-a-uuid" }, ack, services);

    expect(services.getPublicPoll).not.toHaveBeenCalled();
    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "invalid" }]);
  });

  it("rate-limits a client spinning subscribes", async () => {
    const services = deps();
    services.getPublicPoll.mockResolvedValue({ id: "poll-1", voted: true, tally: TALLY });

    // The public policy allows 120 per window; the 121st is the first refusal.
    let last: Parameters<SubscribeAck>[0] | undefined;
    for (let attempt = 0; attempt < 121; attempt += 1) {
      const { responses, ack } = ackRecorder();
      await handlePollSubscribe(
        socket(),
        { slug: "lunch", deviceId: "22222222-2222-4222-8222-222222222222" },
        ack,
        services,
      );
      last = responses[0];
    }

    expect(last).toEqual({ ok: false, error: "rate-limited" });
  });
});

describe("poll:watch", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("joins the owner to the poll's room with the tally", async () => {
    const fake = socket("authentication-token=good-token");
    const services = deps();
    services.verifyUserToken.mockResolvedValue({ id: "user-1" });
    services.getResultsForCreator.mockResolvedValue(TALLY);
    const { responses, ack } = ackRecorder();

    await handlePollWatch(fake, { pollId: "poll-1" }, ack, services);

    expect(services.verifyUserToken).toHaveBeenCalledWith("good-token");
    expect(services.getResultsForCreator).toHaveBeenCalledWith("user-1", { pollId: "poll-1" });
    expect(fake.joined).toEqual(["poll:poll-1"]);
    expect(responses).toEqual([{ ok: true, tally: TALLY }]);
  });

  it("denies a connection with no auth cookie before asking anyone anything", async () => {
    const fake = socket();
    const services = deps();
    const { responses, ack } = ackRecorder();

    await handlePollWatch(fake, { pollId: "poll-1" }, ack, services);

    expect(services.verifyUserToken).not.toHaveBeenCalled();
    expect(services.getResultsForCreator).not.toHaveBeenCalled();
    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "unauthorized" }]);
  });

  it("denies a forged or expired token exactly like a missing one", async () => {
    const fake = socket("authentication-token=forged");
    const services = deps();
    services.verifyUserToken.mockRejectedValue(coded("UNAUTHORIZED"));
    const { responses, ack } = ackRecorder();

    await handlePollWatch(fake, { pollId: "poll-1" }, ack, services);

    expect(services.getResultsForCreator).not.toHaveBeenCalled();
    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "unauthorized" }]);
  });

  it("denies a stranger to someone else's poll without joining", async () => {
    const fake = socket("authentication-token=stranger-token");
    const services = deps();
    services.verifyUserToken.mockResolvedValue({ id: "stranger" });
    services.getResultsForCreator.mockRejectedValue(coded("FORBIDDEN"));
    const { responses, ack } = ackRecorder();

    await handlePollWatch(fake, { pollId: "poll-1" }, ack, services);

    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "forbidden" }]);
  });

  it("denies a missing poll without leaking which ids exist", async () => {
    const fake = socket("authentication-token=good-token");
    const services = deps();
    services.verifyUserToken.mockResolvedValue({ id: "user-1" });
    services.getResultsForCreator.mockRejectedValue(coded("NOT_FOUND"));
    const { responses, ack } = ackRecorder();

    await handlePollWatch(fake, { pollId: "poll-9" }, ack, services);

    expect(fake.joined).toEqual([]);
    expect(responses).toEqual([{ ok: false, error: "not-found" }]);
  });
});
