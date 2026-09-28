import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { Client } from "pg";

/**
 * Harness for service integration tests that need a real PostgreSQL server.
 *
 * Point `DATABASE_URL_TEST` at a *dedicated* database — never your dev one. The
 * harness creates it if it is missing, applies every migration, and truncates all
 * tables between tests.
 *
 * Tests are skipped when the variable is absent, so `pnpm test` still works with no
 * server running.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), "packages", "database", "drizzle");

export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

/** The database name embedded in DATABASE_URL_TEST, used as the base for a per-file db. */
function baseDatabaseName(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name) throw new Error("DATABASE_URL_TEST must include a database name");

  // These harnesses drop and recreate the database, so refuse to touch anything that is
  // not obviously a test database.
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run tests against "${name}" — DATABASE_URL_TEST must point at a ` +
        'throwaway database whose name contains "test".',
    );
  }

  return name;
}

/**
 * The database one test file owns.
 *
 * Vitest runs test files in parallel, and each one drops and recreates its database, so
 * they cannot share one — a second file would pull the schema out from under the first.
 * `scope` is the caller's label, e.g. "integration".
 */
export function databaseUrlForScope(url: string, scope: string): string {
  const scoped = new URL(url);
  scoped.pathname = `/${baseDatabaseName(url)}_${scope}`;
  return scoped.toString();
}

export async function applyMigrations(client: Client): Promise<void> {
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
      await client.query(statement);
    }
  }
}

export interface ServerTestDatabase {
  /** A connected client against the freshly migrated test database. */
  client: Client;
  /** The database name this harness owns. */
  name: string;
  /** Empties every table, leaving the schema in place. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Recreates the scoped test database from scratch and migrates it.
 *
 * Recreating rather than migrating in place keeps every run deterministic: a migration
 * added since the last run, or a half-applied one from a crashed run, cannot leave the
 * schema out of step with the models.
 */
export async function setupTestDatabase(scope = "default"): Promise<ServerTestDatabase> {
  if (!TEST_DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST is not set");
  }

  const database = baseDatabaseName(TEST_DATABASE_URL);
  const scopedUrl = databaseUrlForScope(TEST_DATABASE_URL, scope);
  const name = new URL(scopedUrl).pathname.replace(/^\//, "");

  // Connect to the maintenance database to recreate the target. The database is swapped
  // in the URL rather than passed as an option, because node-postgres lets the
  // connection string win over an explicit `database`.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  // FORCE disconnects any other session still attached, which is what makes re-running
  // after a crash reliable.
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const client = new Client({ connectionString: scopedUrl });
  await client.connect();
  await applyMigrations(client);

  const TRUNCATE_ORDER = [
    "form_events",
    "form_answers",
    "form_sessions",
    "questions",
    "form_pages",
    "forms",
    "users",
  ];

  return {
    client,
    name: database,

    async reset() {
      // RESTART IDENTITY so bigserial sequences are deterministic between tests.
      await client.query(`TRUNCATE ${TRUNCATE_ORDER.join(", ")} RESTART IDENTITY CASCADE`);
    },

    close: () => client.end(),
  };
}
