import {
  boolean,
  index,
  integer,
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
 * `STEP`   — one question per screen, Next/Back between them.
 * `PAGED` — questions grouped into pages; a one-page form is PAGED with a single page.
 */
export const layoutModeEnum = pgEnum("layout_mode_enum", ["STEP", "PAGED"]);

export const formStatusEnum = pgEnum("form_status_enum", ["DRAFT", "PUBLISHED", "CLOSED"]);

/**
 * `theme_key` is a plain varchar, not an enum, so that adding a curated preset
 * (see `packages/services/utils/theme.ts`) does not need a migration. The allowed
 * values are still validated by zod at the edge.
 */
export const formsTable = pgTable(
  "forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Public share slug. Global, because the public URL is /f/[slug]. */
    slug: varchar("slug", { length: 64 }).notNull(),

    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),

    // `STEP` rather than `PAGED`, because a stepper form needs no pages: a new form is
    // coherent the moment it is created. `PAGED` would leave every new form with
    // questions that belong to no page, which renders as an empty form.
    layoutMode: layoutModeEnum("layout_mode").notNull().default("STEP"),
    themeKey: varchar("theme_key", { length: 32 }).notNull().default("sage"),
    status: formStatusEnum("status").notNull().default("DRAFT"),

    /**
     * scrypt hash in the same self-describing form as a user password
     * (`scrypt$N$r$p$salt$key`). Null means the form is open to anyone with the link.
     */
    passwordHash: text("password_hash"),

    showProgress: boolean("show_progress").notNull().default(true),
    allowBack: boolean("allow_back").notNull().default(true),
    oneResponsePerDevice: boolean("one_response_per_device").notNull().default(true),
    maxResponses: integer("max_responses"),
    closesAt: timestamp("closes_at"),

    thankYouTitle: varchar("thank_you_title", { length: 120 }),
    thankYouMessage: text("thank_you_message"),
    thankYouRedirectUrl: text("thank_you_redirect_url"),

    /**
     * Bumped on every publish. A session records the version it started against so a
     * response submitted against a since-edited form can still be validated and
     * reported honestly.
     */
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("forms_slug_unique").on(table.slug),
    index("forms_created_by_idx").on(table.createdBy),
    index("forms_status_idx").on(table.status),
  ],
);

export type SelectForm = typeof formsTable.$inferSelect;
export type InsertForm = typeof formsTable.$inferInsert;
