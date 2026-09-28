import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { formsTable } from "./form";
import { formSessionsTable } from "./form-session";
import { questionKindEnum, questionsTable } from "./question";

/**
 * One answered question within a session.
 *
 * The question's label, key and kind are copied onto the answer. Without that, renaming
 * a question tomorrow would silently rewrite what last month's export claims was asked.
 *
 * The value is spread across typed columns so it can be indexed, compared and
 * aggregated without JSON parsing: text for strings, numeric for numbers,
 * `date` for calendar dates, `jsonb` for multi-select arrays and address objects.
 */
export const formAnswersTable = pgTable(
  "form_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sessionId: uuid("session_id")
      .notNull()
      .references(() => formSessionsTable.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    /** `restrict` on purpose: deleting a question must not erase history. */
    questionId: uuid("question_id")
      .notNull()
      .references(() => questionsTable.id, { onDelete: "restrict" }),

    valueText: text("value_text"),
    valueNumber: numeric("value_number", { precision: 20, scale: 6 }),
    /** Calendar date as `YYYY-MM-DD`. Kept as a string so no timezone can shift it. */
    valueDate: date("value_date", { mode: "string" }),
    valueJson: jsonb("value_json").$type<unknown>(),

    questionLabel: varchar("question_label", { length: 200 }),
    questionLabelKey: varchar("question_label_key", { length: 50 }),
    questionKind: questionKindEnum("question_kind"),

    /** True while the response is still in progress; false once submitted. */
    isDraft: boolean("is_draft").notNull().default(true),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("form_answers_session_id_question_id_unique").on(table.sessionId, table.questionId),
    index("form_answers_form_id_idx").on(table.formId),
    index("form_answers_question_id_idx").on(table.questionId),
    index("form_answers_form_id_is_draft_idx").on(table.formId, table.isDraft),
  ],
);

export type SelectFormAnswer = typeof formAnswersTable.$inferSelect;
export type InsertFormAnswer = typeof formAnswersTable.$inferInsert;
