import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { formsTable } from "./form";

/**
 * A page groups questions in `PAGED` layout. In `STEP` layout every question is its
 * own step, so `questions.pageId` is null and pages are unused.
 */
export const formPagesTable = pgTable(
  "form_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .notNull()
      .references(() => formsTable.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 120 }),
    description: text("description"),

    /** Fractional index, so a page can be inserted between two others. */
    position: numeric("position", { precision: 8, scale: 2 }).notNull().default("1.00"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("form_pages_form_id_position_unique").on(table.formId, table.position),
    index("form_pages_form_id_idx").on(table.formId),
  ],
);

export type SelectFormPage = typeof formPagesTable.$inferSelect;
export type InsertFormPage = typeof formPagesTable.$inferInsert;
