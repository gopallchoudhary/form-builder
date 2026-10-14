import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { usersTable } from "./user";

/**
 * A poll's lifecycle, independent of any form.
 *
 * `DRAFT` is invisible on the public URL — same no-existence-leak rule as unpublished
 * forms. `OPEN` accepts votes. `CLOSED` freezes the tally: votes are kept and shown, but
 * no new ones (and no changes) are accepted.
 *
 * A fresh enum rather than a reused one, so a future status is a new value here and not an
 * `ALTER TYPE` against a type something else depends on.
 */
export const pollStatusEnum = pgEnum("poll_status_enum", ["DRAFT", "OPEN", "CLOSED"]);

/** One votable option. Ids are slugs, unique within the poll, like question options. */
export interface PollOption {
  id: string;
  label: string;
}

export const pollsTable = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Public share slug. Global, because the voter URL is /p/[slug]. */
    slug: varchar("slug", { length: 64 }).notNull(),

    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),

    status: pollStatusEnum("status").notNull().default("DRAFT"),

    /**
     * Frozen once the poll opens. Editing options under live votes would orphan them —
     * a tally counting an option that no longer exists answers a question nobody asked —
     * so the service refuses option edits outside `DRAFT`, and the column carries no
     * history of its own.
     */
    options: jsonb("options").$type<PollOption[]>().notNull(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("polls_slug_unique").on(table.slug),
    index("polls_created_by_idx").on(table.createdBy),
    index("polls_status_idx").on(table.status),
  ],
);

/**
 * One device's vote on one poll.
 *
 * The `(poll_id, device_id)` unique index *is* the one-vote-per-device rule: a second vote
 * from the same device updates this row rather than inserting another, which is also what
 * makes changing a vote an upsert instead of a delete-plus-insert. `deviceId` carries no
 * foreign key on purpose — same posture as sessions, where it is a presented identifier
 * rather than a registered identity, and spoofing it is best-effort detectable at most.
 */
export const pollVotesTable = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    pollId: uuid("poll_id")
      .notNull()
      .references(() => pollsTable.id, { onDelete: "cascade" }),

    deviceId: uuid("device_id").notNull(),

    /** The option id as voted, not the label: labels may be edited while closed. */
    optionId: text("option_id").notNull(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("poll_votes_poll_id_device_id_unique").on(table.pollId, table.deviceId),
    index("poll_votes_poll_id_idx").on(table.pollId),
  ],
);

export type SelectPoll = typeof pollsTable.$inferSelect;
export type InsertPoll = typeof pollsTable.$inferInsert;
export type SelectPollVote = typeof pollVotesTable.$inferSelect;
export type InsertPollVote = typeof pollVotesTable.$inferInsert;
