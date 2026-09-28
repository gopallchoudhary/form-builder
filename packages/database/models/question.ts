import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { formsTable } from "./form";
import { formPagesTable } from "./form-page";

export const questionKindEnum = pgEnum("question_kind_enum", [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "PASSWORD",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DROPDOWN",
  "RATING",
  "DATE",
  "ADDRESS",
]);

export const questionsTable = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    /** Null in `STEP` layout, where every question is its own step. */
    pageId: uuid("page_id").references(() => formPagesTable.id, { onDelete: "set null" }),

    /** Fractional index within the page, or within the form in `STEP` layout. */
    position: numeric("position", { precision: 8, scale: 2 }).notNull().default("1.00"),

    kind: questionKindEnum("kind").notNull(),

    label: varchar("label", { length: 200 }).notNull(),
    /**
     * Write-once slug derived from `label` at creation time. It is the stable handle
     * for a question inside a response payload, so it must never be regenerated.
     */
    labelKey: varchar("label_key", { length: 50 }).notNull(),

    description: text("description"),
    placeholder: text("placeholder"),

    isRequired: boolean("is_required").notNull().default(false),

    /**
     * Per-kind configuration and validation, shaped by the discriminated union in
     * `packages/services/question-settings.ts` — choice options, rating scale,
     * min/max bounds, and so on. Always validate server-side; this is just storage.
     */
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),

    /**
     * Soft delete. Once a form has responses, removing a question must not cascade
     * and destroy the history of what was actually asked.
     */
    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    // Postgres treats NULLs as distinct, so a single (form_id, page_id, position)
    // index would enforce nothing for STEP-layout questions where page_id is null.
    // Two partial indexes cover both cases instead.
    uniqueIndex("questions_form_page_position_unique")
      .on(table.formId, table.pageId, table.position)
      .where(sql`${table.deletedAt} is null and ${table.pageId} is not null`),
    uniqueIndex("questions_form_position_unique")
      .on(table.formId, table.position)
      .where(sql`${table.deletedAt} is null and ${table.pageId} is null`),
    uniqueIndex("questions_form_label_key_unique")
      .on(table.formId, table.labelKey)
      .where(sql`${table.deletedAt} is null`),
    index("questions_form_id_idx").on(table.formId),
    index("questions_page_id_idx").on(table.pageId),
  ],
);

export type SelectQuestion = typeof questionsTable.$inferSelect;
export type InsertQuestion = typeof questionsTable.$inferInsert;
