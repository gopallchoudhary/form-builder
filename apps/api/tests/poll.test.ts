import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import {
  databaseUrlForScope,
  hasTestDatabase,
  setupTestDatabase,
  TEST_DATABASE_URL,
  type ServerTestDatabase,
} from "@repo/database/tests/db-server";

/**
 * The poll HTTP surface, end to end: routing, auth, ownership, validation and the vote
 * broadcast.
 *
 * Same setup contract as `api.test.ts`: own database for this file, `DATABASE_URL`
 * repointed before the app is imported, rate limits reset between tests.
 *
 * The broadcast assertions use a fake bus attached through the same module the route
 * imports. The app runs in-process under supertest, so the route's module state is shared
 * and the fake observes exactly what a Socket.IO server would be handed.
 */

const SCOPE = "poll-api";
const PASSWORD = "correct horse battery";

type App = { handle: (req: never, res: never) => void } | Express;

let app: App;
let server: ServerTestDatabase;
let resetRateLimits: () => void;
let attachRealtimeServer: (bus: {
  to: (room: string) => { emit: (event: string, payload: unknown) => unknown };
}) => void;
let detachRealtimeServer: () => void;

const available = hasTestDatabase;

describe.skipIf(!available)("the poll HTTP API", () => {
  let counter = 0;
  const uniqueEmail = () => `poll-api-${++counter}-${Date.now()}@example.com`;

  // What the route handed the bus, in order. Cleared between tests.
  const broadcasts: Array<{ room: string; event: string; payload: unknown }> = [];

  beforeAll(async () => {
    server = await setupTestDatabase(SCOPE);
    process.env.DATABASE_URL = databaseUrlForScope(TEST_DATABASE_URL!, SCOPE);

    const imported = await import("../src/server");
    app = imported.app as unknown as App;

    const trpcServer = await import("@repo/trpc/server");
    resetRateLimits = trpcServer.resetRateLimits;
    attachRealtimeServer = trpcServer.attachRealtimeServer;
    detachRealtimeServer = trpcServer.detachRealtimeServer;

    attachRealtimeServer({
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          broadcasts.push({ room, event, payload });
          return true;
        },
      }),
    });
  });

  afterAll(async () => {
    detachRealtimeServer();
    await server?.close();
  });

  beforeEach(async () => {
    await server.reset();
    broadcasts.length = 0;
    resetRateLimits();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function signUp(email = uniqueEmail()) {
    const response = await request(app as never)
      .post("/api/authentication/createUserWithEmailAndPassword")
      .send({ fullName: "Test User", email, password: PASSWORD });

    expect(response.status).toBe(200);

    const cookie = response.headers["set-cookie"]?.[0];
    expect(cookie).toBeDefined();

    return { id: response.body.id as string, email, cookie: cookie!.split(";")[0]! };
  }

  const auth = (cookie: string) => ({ Cookie: cookie });

  const OPTIONS = [
    { id: "ramen", label: "Ramen" },
    { id: "thali", label: "Thali" },
  ];

  async function createPoll(cookie: string, title = "Lunch") {
    const created = await request(app as never)
      .post("/api/poll/createPoll")
      .set(auth(cookie))
      .send({ title, options: OPTIONS });

    expect(created.status).toBe(200);
    return { pollId: created.body.id as string, slug: created.body.slug as string };
  }

  async function openPoll(cookie: string) {
    const { pollId, slug } = await createPoll(cookie);
    const opened = await request(app as never)
      .post("/api/poll/setPollStatus")
      .set(auth(cookie))
      .send({ pollId, status: "OPEN" });

    expect(opened.status).toBe(200);
    return { pollId, slug };
  }

  const device = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

  // ── Creator ──────────────────────────────────────────────────────────────────

  describe("creator", () => {
    it("creates a poll and reads it back with its options", async () => {
      const user = await signUp();
      const { pollId } = await createPoll(user.cookie);

      const fetched = await request(app as never)
        .get(`/api/poll/getPoll?pollId=${pollId}`)
        .set(auth(user.cookie));

      expect(fetched.status).toBe(200);
      expect(fetched.body).toMatchObject({
        id: pollId,
        title: "Lunch",
        status: "DRAFT",
        options: OPTIONS,
      });
    });

    it("lists polls with vote totals", async () => {
      const user = await signUp();
      const { pollId } = await openPoll(user.cookie);

      await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(1),
        optionId: "ramen",
      });

      const listed = await request(app as never)
        .get(`/api/poll/listPolls`)
        .set(auth(user.cookie));

      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toMatchObject({ id: pollId, totalVotes: 1 });
    });

    it("refuses a stranger's reads and writes with 403", async () => {
      const user = await signUp();
      const stranger = await signUp();
      const { pollId } = await createPoll(user.cookie);

      const read = await request(app as never)
        .get(`/api/poll/getPoll?pollId=${pollId}`)
        .set(auth(stranger.cookie));
      expect(read.status).toBe(403);

      const renamed = await request(app as never)
        .post("/api/poll/updatePoll")
        .set(auth(stranger.cookie))
        .send({ pollId, title: "Hijacked" });
      expect(renamed.status).toBe(403);
    });

    it("rejects an invalid transition with 400", async () => {
      const user = await signUp();
      const { pollId } = await createPoll(user.cookie);

      const closed = await request(app as never)
        .post("/api/poll/setPollStatus")
        .set(auth(user.cookie))
        .send({ pollId, status: "CLOSED" });
      expect(closed.status).toBe(400);
    });

    it("serves results and insights to the owner", async () => {
      const user = await signUp();
      const { pollId } = await openPoll(user.cookie);

      await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(1),
        optionId: "ramen",
      });

      const results = await request(app as never)
        .get(`/api/poll/getPollResults?pollId=${pollId}`)
        .set(auth(user.cookie));
      expect(results.status).toBe(200);
      expect(results.body.total).toBe(1);

      const insights = await request(app as never)
        .get(`/api/poll/getPollInsights?pollId=${pollId}&days=7`)
        .set(auth(user.cookie));
      expect(insights.status).toBe(200);
      expect(insights.body.series).toHaveLength(7);
      expect(insights.body.peakHours).toHaveLength(24);
    });
  });

  // ── Public ───────────────────────────────────────────────────────────────────

  describe("public", () => {
    it("hides drafts behind 404", async () => {
      const user = await signUp();
      const { slug } = await createPoll(user.cookie);

      const response = await request(app as never).get(`/api/poll/getPollBySlug?slug=${slug}`);

      expect(response.status).toBe(404);
    });

    it("shows an open poll without its tally until this device votes", async () => {
      const user = await signUp();
      const { slug } = await openPoll(user.cookie);

      const response = await request(app as never).get(
        `/api/poll/getPollBySlug?slug=${slug}&deviceId=${device(1)}`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ voted: false, tally: null });
      expect(response.body.options).toEqual(OPTIONS);
    });

    it("broadcasts the tally to the poll's room on every vote", async () => {
      const user = await signUp();
      const { pollId } = await openPoll(user.cookie);

      const vote = await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(1),
        optionId: "ramen",
      });
      expect(vote.status).toBe(200);

      // One event, to this poll's room, carrying the fresh tally — this is the entire
      // realtime contract, and it is asserted here rather than against a live socket.
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0]!.room).toBe(`poll:${pollId}`);
      expect(broadcasts[0]!.event).toBe("poll:results");
      expect(broadcasts[0]!.payload).toMatchObject({
        pollId,
        counts: { ramen: 1, thali: 0 },
        total: 1,
      });

      // A changed vote moves the tally and broadcasts again.
      await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(1),
        optionId: "thali",
      });

      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[1]!.payload).toMatchObject({
        counts: { ramen: 0, thali: 1 },
        total: 1,
      });
    });

    it("rejects votes on closed polls and unknown options", async () => {
      const user = await signUp();
      const { pollId } = await openPoll(user.cookie);

      const unknown = await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(1),
        optionId: "pizza",
      });
      expect(unknown.status).toBe(400);

      await request(app as never)
        .post("/api/poll/setPollStatus")
        .set(auth(user.cookie))
        .send({ pollId, status: "CLOSED" });

      const closed = await request(app as never).post("/api/poll/castVote").send({
        pollId,
        deviceId: device(2),
        optionId: "ramen",
      });
      expect(closed.status).toBe(403);

      // Refusals broadcast nothing: watchers must never see a tally the database rejected.
      expect(broadcasts).toHaveLength(0);
    });
  });
});
