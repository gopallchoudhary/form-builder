import {
  and,
  count,
  db as defaultDb,
  desc,
  eq,
  gte,
  sql,
  type Database,
} from "@repo/database";
import { pollsTable, pollVotesTable } from "@repo/database/models/poll";

import { isUniqueViolation } from "../utils/db-errors";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { assertPollOwnership } from "../utils/ownership";
import { generateSlug } from "../utils/slug";
import {
  castVoteInput,
  type CastVoteInputType,
  createPollInput,
  type CreatePollInputType,
  getPollInsightsInput,
  type GetPollInsightsInputType,
  getPollResultsInput,
  type GetPollResultsInputType,
  getPublicPollInput,
  type GetPublicPollInputType,
  listPollsByUserIdInput,
  type ListPollsByUserIdInputType,
  pollIdInput,
  setPollStatusInput,
  type SetPollStatusInputType,
  updatePollInput,
  type UpdatePollInputType,
  type PollStatus,
} from "./model";
import type { PollOption } from "@repo/database/models/poll";

/** How many times to retry a colliding slug before giving up. */
const SLUG_ATTEMPTS = 5;

const POLL_COLUMNS = {
  id: pollsTable.id,
  slug: pollsTable.slug,
  title: pollsTable.title,
  description: pollsTable.description,
  status: pollsTable.status,
  options: pollsTable.options,
  createdAt: pollsTable.createdAt,
  updatedAt: pollsTable.updatedAt,
} as const;

/**
 * Transitions a poll may take. Deliberately not "anything to anything":
 *
 * - a draft becomes visible only by opening, never by closing a thing nobody saw;
 * - closing is reversible, because a badly timed close should not end a poll;
 * - reopening keeps the original options (they froze at first open), so the tally stays
 *   meaningful across the gap.
 */
const ALLOWED_TRANSITIONS: Record<PollStatus, PollStatus[]> = {
  DRAFT: ["DRAFT", "OPEN"],
  OPEN: ["OPEN", "CLOSED"],
  CLOSED: ["CLOSED", "OPEN"],
};

export interface PollTally {
  buckets: Array<{ optionId: string; label: string; count: number }>;
  total: number;
}

class PollService {
  constructor(private readonly db: Database = defaultDb) {}

  //. create poll
  public async createPoll(userId: string, payload: CreatePollInputType) {
    const { title, description, options } = await createPollInput.parseAsync(payload);

    // `polls.slug` is globally unique because it is the voter URL, so retry on the
    // (very unlikely) collision rather than surfacing a raw constraint error.
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = generateSlug(title, "poll");
      try {
        const inserted = await this.db
          .insert(pollsTable)
          .values({ title, description, options, createdBy: userId, slug })
          .returning({ id: pollsTable.id });

        if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
          throw new Error("Insert of the poll returned no rows");
        }

        return { id: inserted[0].id, slug };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === SLUG_ATTEMPTS - 1) throw error;
      }
    }

    throw new ConflictError("Could not allocate a unique link for this poll");
  }

  //. list polls by user id, most recently active first
  public async listPollsByUserId(payload: ListPollsByUserIdInputType) {
    const { userId } = await listPollsByUserIdInput.parseAsync(payload);

    // Recently voted-on polls surface first: for a live feature, "what moved" matters more
    // than "what was made". The latest vote timestamp decides, with quiet polls falling back
    // to creation order — `NULLS LAST` because Postgres sorts nulls first on DESC, which
    // would otherwise pin every voteless poll above every live one.
    const rows = await this.db
      .select({
        ...POLL_COLUMNS,
        totalVotes: count(pollVotesTable.id),
      })
      .from(pollsTable)
      .leftJoin(pollVotesTable, eq(pollVotesTable.pollId, pollsTable.id))
      .where(eq(pollsTable.createdBy, userId))
      .groupBy(pollsTable.id)
      .orderBy(
        sql`max(${pollVotesTable.createdAt}) DESC NULLS LAST`,
        desc(pollsTable.createdAt),
      );

    return rows;
  }

  //. get one poll, checking ownership
  public async getPollById(userId: string, pollId: string) {
    await assertPollOwnership(pollId, userId, this.db);

    const rows = await this.db
      .select(POLL_COLUMNS)
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId))
      .limit(1);

    const poll = rows[0];
    if (!poll) throw new NotFoundError("Poll does not exist");

    return poll;
  }

  //. update a poll's editable fields
  public async updatePoll(userId: string, payload: UpdatePollInputType) {
    const { pollId, title, description, options } = await updatePollInput.parseAsync(payload);

    const poll = await assertPollOwnership(pollId, userId, this.db);

    if (options !== undefined && poll.status !== "DRAFT") {
      // Options freeze at first open: a tally counting an option nobody can still see
      // answers a question that was not asked, and votes already cast would point at ids
      // that no longer exist.
      throw new BadRequestError("Options cannot be changed once a poll has opened");
    }

    if (poll.status === "OPEN" && (title !== undefined || description !== undefined)) {
      // Renaming a live poll mid-vote moves the target people are sharing. The poll can be
      // closed, edited and reopened instead, which keeps every edit deliberate.
      throw new BadRequestError("Close the poll before renaming it");
    }

    const patch: Partial<{ title: string; description: string | null; options: PollOption[] }> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (options !== undefined) patch.options = options;

    if (Object.keys(patch).length === 0) {
      return this.getPollById(userId, pollId);
    }

    await this.db.update(pollsTable).set(patch).where(eq(pollsTable.id, pollId));

    return this.getPollById(userId, pollId);
  }

  //. move a poll between DRAFT, OPEN and CLOSED
  public async setPollStatus(userId: string, payload: SetPollStatusInputType) {
    const { pollId, status } = await setPollStatusInput.parseAsync(payload);

    const poll = await assertPollOwnership(pollId, userId, this.db);

    if (!ALLOWED_TRANSITIONS[poll.status].includes(status)) {
      throw new BadRequestError(`A ${poll.status} poll cannot move to ${status}`);
    }

    await this.db.update(pollsTable).set({ status }).where(eq(pollsTable.id, pollId));

    return { pollId, status };
  }

  //. delete a poll and its votes
  public async deletePoll(userId: string, payload: { pollId: string }) {
    const { pollId } = await pollIdInput.parseAsync(payload);

    await assertPollOwnership(pollId, userId, this.db);

    // Votes cascade.
    await this.db.delete(pollsTable).where(eq(pollsTable.id, pollId));

    return { id: pollId };
  }

  //. cast or change a vote
  public async castVote(payload: CastVoteInputType) {
    const { pollId, deviceId, optionId } = await castVoteInput.parseAsync(payload);

    const rows = await this.db
      .select({
        id: pollsTable.id,
        status: pollsTable.status,
        options: pollsTable.options,
      })
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId))
      .limit(1);

    const poll = rows[0];
    // A draft is as good as missing: the public must not learn it exists.
    if (!poll || poll.status === "DRAFT") {
      throw new NotFoundError("Poll does not exist");
    }
    if (poll.status === "CLOSED") {
      throw new ForbiddenError("This poll is closed");
    }

    const options = (poll.options ?? []) as PollOption[];
    if (!options.some((option) => option.id === optionId)) {
      throw new BadRequestError("That option is not part of this poll");
    }

    /*
     * Insert, falling back to update on the one-vote-per-device constraint. Two requests
     * racing past each other cannot both insert — the unique index decides — so the loser
     * updates instead, and the tally counts one device exactly once either way.
     */
    try {
      await this.db.insert(pollVotesTable).values({ pollId, deviceId, optionId });
      return { pollId, optionId, changed: true, created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      await this.db
        .update(pollVotesTable)
        .set({ optionId })
        .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.deviceId, deviceId)));

      return { pollId, optionId, changed: true, created: false };
    }
  }

  //. tally a poll, resolving labels from its current options
  public async getResults(pollId: string): Promise<PollTally> {
    const rows = await this.db
      .select({ options: pollsTable.options })
      .from(pollsTable)
      .where(eq(pollsTable.id, pollId))
      .limit(1);

    const poll = rows[0];
    if (!poll) throw new NotFoundError("Poll does not exist");

    const options = (poll.options ?? []) as PollOption[];

    const counts = await this.db
      .select({
        optionId: pollVotesTable.optionId,
        count: count(pollVotesTable.id),
      })
      .from(pollVotesTable)
      .where(eq(pollVotesTable.pollId, pollId))
      .groupBy(pollVotesTable.optionId);

    const byId = new Map(counts.map((row) => [row.optionId, row.count]));

    // Every option appears, even with zero votes: a bar chart that drops empty options
    // reorders itself on every vote, which reads as flicker rather than movement.
    const buckets = options.map((option) => ({
      optionId: option.id,
      label: option.label,
      count: byId.get(option.id) ?? 0,
    }));

    return { buckets, total: buckets.reduce((sum, bucket) => sum + bucket.count, 0) };
  }

  //. tally for the owner
  public async getResultsForCreator(userId: string, payload: GetPollResultsInputType) {
    const { pollId } = await getPollResultsInput.parseAsync(payload);

    await assertPollOwnership(pollId, userId, this.db);

    return this.getResults(pollId);
  }

  //. tally for a voter, only once they have voted
  public async getResultsForVoter(pollId: string, deviceId: string) {
    const votes = await this.db
      .select({ optionId: pollVotesTable.optionId })
      .from(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.deviceId, deviceId)))
      .limit(1);

    const mine = votes[0];
    if (!mine) {
      // Without this, "results after voting" is client-side hiding: anyone with the link
      // could read the tally without voting, simply by asking.
      return { voted: false as const, optionId: null as string | null, tally: null };
    }

    return { voted: true as const, optionId: mine.optionId, tally: await this.getResults(pollId) };
  }

  //. votes over time and peak hours, for the owner
  public async getInsightsForCreator(
    userId: string,
    payload: GetPollInsightsInputType,
  ) {
    const { pollId, days } = await getPollInsightsInput.parseAsync(payload);

    await assertPollOwnership(pollId, userId, this.db);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Bucketed in UTC so the series is identical in every environment — PGlite in tests and
    // Postgres in production would otherwise disagree wherever the server timezone differs.
    // `::date` arrives as a string from node-pg but as a Date from some drivers —
    // PGlite in tests and Postgres in production must agree, so both are accepted.
    const series = await this.db
      .select({
        day: sql<string | Date>`date_trunc('day', ${pollVotesTable.createdAt} at time zone 'UTC')::date`,
        count: count(pollVotesTable.id),
      })
      .from(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), gte(pollVotesTable.createdAt, since)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const byDay = new Map(
      series.map((row) => [
        row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
        row.count,
      ]),
    );
    const filled: Array<{ day: string; count: number }> = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      filled.push({ day: key, count: byDay.get(key) ?? 0 });
    }

    // Hour of day in UTC, same reasoning as above. A changed vote keeps its original
    // `created_at`, so both views describe first votes, not edits — the alternative would
    // need a vote-event log this feature deliberately does not have.
    const hours = await this.db
      .select({
        hour: sql<number>`extract(hour from ${pollVotesTable.createdAt} at time zone 'UTC')::int`,
        count: count(pollVotesTable.id),
      })
      .from(pollVotesTable)
      .where(and(eq(pollVotesTable.pollId, pollId), gte(pollVotesTable.createdAt, since)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const peakHours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hours.find((row) => row.hour === hour)?.count ?? 0,
    }));

    return { series: filled, peakHours };
  }

  //. public view of a poll: meta for everyone, tally only for voters
  public async getPublicPoll(payload: GetPublicPollInputType) {
    const { slug, deviceId } = await getPublicPollInput.parseAsync(payload);

    const rows = await this.db
      .select({
        id: pollsTable.id,
        title: pollsTable.title,
        description: pollsTable.description,
        status: pollsTable.status,
        options: pollsTable.options,
      })
      .from(pollsTable)
      .where(eq(pollsTable.slug, slug))
      .limit(1);

    const poll = rows[0];
    // Drafts do not exist as far as the public is concerned.
    if (!poll || poll.status === "DRAFT") {
      throw new NotFoundError("Poll does not exist");
    }

    if (!deviceId) {
      return { ...poll, voted: false as const, optionId: null as string | null, tally: null };
    }

    const result = await this.getResultsForVoter(poll.id, deviceId);
    return { ...poll, ...result };
  }
}

export default PollService;
