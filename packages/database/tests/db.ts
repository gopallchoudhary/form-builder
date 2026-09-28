import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "../schema";

/**
 * Integration tests run against PGlite — real PostgreSQL compiled to WebAssembly — so
 * schema, constraints, partial indexes and foreign keys behave exactly as they do in
 * production without needing a database server.
 *
 * Migrations are applied in order, so a broken migration fails the suite.
 */

/** Vitest always runs from the workspace root (see `vitest.config.mts`). */
const MIGRATIONS_DIR = resolve(process.cwd(), "packages", "database", "drizzle");

export interface TestDatabase {
  /** Drizzle handle, for ORM-level assertions. */
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** Raw client, for asserting on constraints Drizzle cannot express. */
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  exec: (sql: string) => Promise<unknown>;
  close: () => Promise<void>;
}

/** Applies every `NNNN_*.sql` file in order, splitting on drizzle's statement markers. */
export async function applyMigrations(client: PGlite): Promise<void> {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }
  }
}

/** A fresh, fully migrated database. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  await applyMigrations(client);

  return {
    db: drizzle(client, { schema }),

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.query<T>(sql, params as never[]);
      return result.rows;
    },

    exec: (sql: string) => client.exec(sql),
    close: () => client.close(),
  };
}

export { schema };
