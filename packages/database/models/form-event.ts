import {
  bigserial,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { formsTable } from "./form";
import { formPagesTable } from "./form-page";
import { formSessionsTable } from "./form-session";
import { questionsTable } from "./question";

/**
 * Analytics events. Views and starts cannot be derived from responses — they only
 * exist if something recorded them, which is what this table is for.
 *
 * `bigserial` rather than uuid: this is the highest-volume table in the database
 * and its primary key is only ever used for ordering and deduplication.
 */
export const formEventTypeEnum = pgEnum("form_event_type_enum", [
  "VIEW",
  "UNLOCK",
  "START",
  "QUESTION_VIEW",
  "PAGE_VIEW",
  "SUBMIT",
  "ABANDON",
]);

export const formEventsTable = pgTable(
  "form_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    sessionId: uuid("session_id").references(() => formSessionsTable.id, { onDelete: "set null" }),

    type: formEventTypeEnum("type").notNull(),

    questionId: uuid("question_id").references(() => questionsTable.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => formPagesTable.id, { onDelete: "set null" }),

    formVersion: integer("form_version"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Covers both "trend for this form" and "funnel for this form between two dates".
    index("form_events_form_id_created_at_idx").on(table.formId, table.createdAt),
    index("form_events_form_id_type_created_at_idx").on(table.formId, table.type, table.createdAt),
    index("form_events_session_id_created_at_idx").on(table.sessionId, table.createdAt),
  ],
);

export type SelectFormEvent = typeof formEventsTable.$inferSelect;
export type InsertFormEvent = typeof formEventsTable.$inferInsert;
