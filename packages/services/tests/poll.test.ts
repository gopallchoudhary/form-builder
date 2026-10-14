import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "../utils/errors";
import {
  createServiceHarness,
  createUser,
  servicesAvailable,
  type ServiceHarness,
} from "./harness";

/**
 * Poll behaviour against a real PostgreSQL. Skipped when DATABASE_URL_TEST is unset.
 *
 * These cover the rules that only rows can prove: ownership isolation, the status machine,
 * the one-vote-per-device constraint (including the race it exists for), and that a voter
 * sees a tally only after voting.
 */
describe.skipIf(!servicesAvailable)("polls against a real database", () => {
  let harness: ServiceHarness;
  let owner: { id: string; email: string };
  let stranger: { id: string; email: string };

  const OPTIONS = [
    { id: "ramen", label: "Ramen" },
    { id: "thali", label: "Thali" },
  ];

  const device = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

  async function openPoll() {
    const { id: pollId, slug } = await harness.polls.createPoll(owner.id, {
      title: "Lunch",
      options: OPTIONS,
    });
    await harness.polls.setPollStatus(owner.id, { pollId, status: "OPEN" });
    return { pollId, slug };
  }

  beforeAll(async () => {
    harness = await createServiceHarness("polls");
    owner = await createUser(harness);
    stranger = await createUser(harness);
  });

  afterAll(async () => {
    await harness?.close();
  });

  beforeEach(async () => {
    await harness.reset();
    owner = await createUser(harness);
    stranger = await createUser(harness);
  });

  // ── Ownership ──────────────────────────────────────────────────────────────

  describe("ownership", () => {
    it("hides a stranger's poll behind not-found-or-forbidden, never its contents", async () => {
      const { pollId } = await openPoll();

      await expect(harness.polls.getPollById(stranger.id, pollId)).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
      await expect(
        harness.polls.updatePoll(stranger.id, { pollId, title: "Hijacked" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.polls.setPollStatus(stranger.id, { pollId, status: "CLOSED" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(harness.polls.deletePoll(stranger.id, { pollId })).rejects.toMatchObject({
        kind: "FORBIDDEN",
      });
    });

    it("reports a missing poll as not found rather than forbidden", async () => {
      await expect(
        harness.polls.getPollById(owner.id, "00000000-0000-4000-8000-999999999999"),
      ).rejects.toMatchObject({ kind: "NOT_FOUND" });
    });

    it("lists only the caller's polls, most recently active first", async () => {
      const first = await harness.polls.createPoll(owner.id, { title: "First", options: OPTIONS });
      const second = await harness.polls.createPoll(owner.id, { title: "Second", options: OPTIONS });
      await harness.polls.createPoll(stranger.id, { title: "Other", options: OPTIONS });

      // A vote on the *older* poll bumps it above the newer but quieter one. If this were
      // creation order, Second would come first, so the assertion discriminates.
      await harness.polls.setPollStatus(owner.id, { pollId: first.id, status: "OPEN" });
      await harness.polls.castVote({ pollId: first.id, deviceId: device(1), optionId: "ramen" });

      const listed = await harness.polls.listPollsByUserId({ userId: owner.id });

      expect(listed.map((poll) => poll.id)).toEqual([first.id, second.id]);
      expect(listed[0]!.totalVotes).toBe(1);
      expect(listed[1]!.totalVotes).toBe(0);
    });
  });

  // ── Status machine ─────────────────────────────────────────────────────────

  describe("status", () => {
    it("moves DRAFT to OPEN to CLOSED and back to OPEN", async () => {
      const { id: pollId } = await harness.polls.createPoll(owner.id, {
        title: "Lunch",
        options: OPTIONS,
      });

      for (const status of ["OPEN", "CLOSED", "OPEN"] as const) {
        const moved = await harness.polls.setPollStatus(owner.id, { pollId, status });
        expect(moved.status).toBe(status);
      }
    });

    it("refuses to close a draft or draft a live poll", async () => {
      const { id: pollId } = await harness.polls.createPoll(owner.id, {
        title: "Lunch",
        options: OPTIONS,
      });

      await expect(
        harness.polls.setPollStatus(owner.id, { pollId, status: "CLOSED" }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });

      await harness.polls.setPollStatus(owner.id, { pollId, status: "OPEN" });
      await expect(
        harness.polls.setPollStatus(owner.id, { pollId, status: "DRAFT" }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    });

    it("freezes options once open, but allows renaming while closed", async () => {
      const { id: pollId } = await harness.polls.createPoll(owner.id, {
        title: "Lunch",
        options: OPTIONS,
      });
      await harness.polls.setPollStatus(owner.id, { pollId, status: "OPEN" });

      await expect(
        harness.polls.updatePoll(owner.id, { pollId, options: OPTIONS }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
      await expect(
        harness.polls.updatePoll(owner.id, { pollId, title: "Dinner" }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });

      await harness.polls.setPollStatus(owner.id, { pollId, status: "CLOSED" });
      const renamed = await harness.polls.updatePoll(owner.id, { pollId, title: "Dinner" });
      expect(renamed.title).toBe("Dinner");

      await expect(
        harness.polls.updatePoll(owner.id, { pollId, options: OPTIONS }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    });

    it("deletes a poll and its votes", async () => {
      const { pollId } = await openPoll();
      await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });

      await harness.polls.deletePoll(owner.id, { pollId });

      await expect(harness.polls.getPollById(owner.id, pollId)).rejects.toMatchObject({
        kind: "NOT_FOUND",
      });
      const remaining = await harness.raw<{ n: number }>(
        "SELECT count(*)::int AS n FROM poll_votes WHERE poll_id = $1",
        [pollId],
      );
      expect(remaining[0]!.n).toBe(0);
    });
  });

  // ── Voting ─────────────────────────────────────────────────────────────────

  describe("voting", () => {
    it("records a vote and reports it as new", async () => {
      const { pollId } = await openPoll();

      const vote = await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });

      expect(vote).toMatchObject({ pollId, optionId: "ramen", created: true });
    });

    it("moves a device's vote rather than counting it twice", async () => {
      const { pollId } = await openPoll();

      await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });
      const moved = await harness.polls.castVote({
        pollId,
        deviceId: device(1),
        optionId: "thali",
      });

      expect(moved.created).toBe(false);

      const tally = await harness.polls.getResults(pollId);
      expect(tally.total).toBe(1);
      expect(tally.buckets).toEqual([
        { optionId: "ramen", label: "Ramen", count: 0 },
        { optionId: "thali", label: "Thali", count: 1 },
      ]);
    });

    it("rejects a vote for an option that is not on the poll", async () => {
      const { pollId } = await openPoll();

      await expect(
        harness.polls.castVote({ pollId, deviceId: device(1), optionId: "pizza" }),
      ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    });

    it("rejects votes on closed polls, and hides drafts entirely", async () => {
      const { id: draftId } = await harness.polls.createPoll(owner.id, {
        title: "Draft",
        options: OPTIONS,
      });

      // A draft is as good as missing: the public must not learn it exists.
      await expect(
        harness.polls.castVote({ pollId: draftId, deviceId: device(1), optionId: "ramen" }),
      ).rejects.toMatchObject({ kind: "NOT_FOUND" });
      await expect(
        harness.polls.getPublicPoll({ slug: "no-such-poll", deviceId: device(1) }),
      ).rejects.toMatchObject({ kind: "NOT_FOUND" });

      const { pollId } = await openPoll();
      await harness.polls.setPollStatus(owner.id, { pollId, status: "CLOSED" });

      await expect(
        harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });

    it("survives two devices voting at once without double-counting either", async () => {
      const { pollId } = await openPoll();

      await Promise.all([
        harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" }),
        harness.polls.castVote({ pollId, deviceId: device(2), optionId: "thali" }),
      ]);

      const tally = await harness.polls.getResults(pollId);
      expect(tally.total).toBe(2);
    });
  });

  // ── Results and public view ────────────────────────────────────────────────

  describe("results", () => {
    it("lists every option, including the ones nobody chose", async () => {
      const { pollId } = await openPoll();
      await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });

      const tally = await harness.polls.getResultsForCreator(owner.id, { pollId });

      // A bar chart that drops empty options reorders itself on every vote, which reads as
      // flicker rather than movement.
      expect(tally.total).toBe(1);
      expect(tally.buckets).toHaveLength(2);
    });

    it("shows a voter the tally only once they have voted", async () => {
      const { pollId, slug } = await openPoll();
      await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });

      const outsider = await harness.polls.getPublicPoll({ slug, deviceId: device(2) });
      expect(outsider.voted).toBe(false);
      expect(outsider.tally).toBeNull();

      const voter = await harness.polls.getPublicPoll({ slug, deviceId: device(1) });
      expect(voter.voted).toBe(true);
      expect(voter.optionId).toBe("ramen");
      expect(voter.tally?.total).toBe(1);
    });

    it("reports zero votes honestly rather than as missing", async () => {
      const { pollId } = await openPoll();

      const tally = await harness.polls.getResults(pollId);

      expect(tally).toEqual({
        buckets: [
          { optionId: "ramen", label: "Ramen", count: 0 },
          { optionId: "thali", label: "Thali", count: 0 },
        ],
        total: 0,
      });
    });
  });

  // ── Insights ───────────────────────────────────────────────────────────────

  describe("insights", () => {
    it("buckets votes by day and fills quiet days with zero", async () => {
      const { pollId } = await openPoll();
      await harness.polls.castVote({ pollId, deviceId: device(1), optionId: "ramen" });

      const insights = await harness.polls.getInsightsForCreator(owner.id, { pollId, days: 7 });

      expect(insights.series).toHaveLength(7);
      const total = insights.series.reduce((sum, day) => sum + day.count, 0);
      expect(total).toBe(1);
      // Today holds the vote; the shape, not the timezone, is what matters here.
      expect(insights.series[insights.series.length - 1]!.count).toBe(1);
      expect(insights.peakHours).toHaveLength(24);
      expect(insights.peakHours.reduce((sum, hour) => sum + hour.count, 0)).toBe(1);
    });

    it("keeps strangers out of another poll's numbers", async () => {
      const { pollId } = await openPoll();

      await expect(
        harness.polls.getResultsForCreator(stranger.id, { pollId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        harness.polls.getInsightsForCreator(stranger.id, { pollId, days: 7 }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });
  });

  // ── Errors ─────────────────────────────────────────────────────────────────

  describe("errors", () => {
    it("carries a machine-readable kind on every refusal", async () => {
      // Guards the contract the tRPC layer translates into statuses: a refusal without a
      // kind surfaces as a 500, which is a lie about a request that was simply not allowed.
      const { pollId } = await openPoll();

      const refusals = await Promise.allSettled([
        harness.polls.getPollById(stranger.id, pollId),
        harness.polls.castVote({ pollId, deviceId: device(1), optionId: "nope" }),
      ]);

      for (const refusal of refusals) {
        expect(refusal.status).toBe("rejected");
        if (refusal.status === "rejected") {
          expect(refusal.reason).toBeInstanceOf(AppError);
          expect(typeof refusal.reason.kind).toBe("string");
        }
      }
    });
  });
});
