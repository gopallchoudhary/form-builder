import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { formsTable } from "./form";
import { formPagesTable } from "./form-page";
import { questionsTable } from "./question";

export const formSessionStatusEnum = pgEnum("form_session_status_enum", [
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);

/**
 * One respondent's run through a form. It backs resumable drafts, completion
 * counting, and the funnel in analytics.
 */
export const formSessionsTable = pgTable(
  "form_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    /** Random id from a first-party cookie; the only respondent identifier we keep. */
    deviceId: uuid("device_id").notNull(),

    /** The form version this run started against. */
    formVersion: integer("form_version").notNull().default(1),

    status: formSessionStatusEnum("status").notNull().default("IN_PROGRESS"),

    startedAt: timestamp("started_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),

    currentPageId: uuid("current_page_id").references(() => formPagesTable.id, {
      onDelete: "set null",
    }),
    currentQuestionId: uuid("current_question_id").references(() => questionsTable.id, {
      onDelete: "set null",
    }),

    userAgent: text("user_agent"),
    /** Hashed IP for coarse abuse detection. The raw address is never stored. */
    ipHash: text("ip_hash"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    // One completed response per device, per form. Partial so that an abandoned
    // draft never blocks the respondent from starting over.
    uniqueIndex("form_sessions_form_id_device_id_completed_unique")
      .on(table.formId, table.deviceId)
      .where(sql`${table.status} = 'COMPLETED'`),
    index("form_sessions_form_id_completed_at_idx").on(table.formId, table.completedAt),
    index("form_sessions_form_id_started_at_idx").on(table.formId, table.startedAt),
    index("form_sessions_form_id_status_idx").on(table.formId, table.status),
  ],
);

export type SelectFormSession = typeof formSessionsTable.$inferSelect;
export type InsertFormSession = typeof formSessionsTable.$inferInsert;
