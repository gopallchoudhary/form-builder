import { createDatabase, type Database } from "@repo/database";
import {
  databaseUrlForScope,
  hasTestDatabase,
  setupTestDatabase,
  TEST_DATABASE_URL,
  type ServerTestDatabase,
} from "@repo/database/tests/db-server";

import FormPageService from "../form-page";
import FormService from "../form";
import QuestionService from "../question";
import UserService from "../user";

/**
 * Wires the real services to a dedicated test database.
 *
 * Each test file gets its own database in its own vitest worker, and `reset()` empties
 * every table between tests, so there is no cross-test coupling.
 */

export interface ServiceHarness {
  db: Database;
  users: UserService;
  forms: FormService;
  pages: FormPageService;
  questions: QuestionService;
  reset: () => Promise<void>;
  close: () => Promise<void>;
  /** Raw SQL escape hatch, for asserting on things the ORM does not surface. */
  raw: <T extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
}

export const servicesAvailable = hasTestDatabase;

/**
 * `scope` names the database this file owns, so parallel test files do not drop the
 * schema out from under each other.
 */
export async function createServiceHarness(scope: string): Promise<ServiceHarness> {
  if (!TEST_DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST is not set");
  }

  const server: ServerTestDatabase = await setupTestDatabase(scope);
  const db = createDatabase(databaseUrlForScope(TEST_DATABASE_URL, scope));

  return {
    db,
    users: new UserService(db),
    forms: new FormService(db),
    pages: new FormPageService(db),
    questions: new QuestionService(db),

    reset: () => server.reset(),

    close: () => server.close(),

    async raw<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      const result = await server.client.query<T>(text, params as never[]);
      return result.rows;
    },
  };
}

/** A registered, signed-in user, for tests that need an owner. */
export async function createUser(
  harness: ServiceHarness,
  email = `owner-${Math.random().toString(36).slice(2)}@example.com`,
): Promise<{ id: string; email: string }> {
  const { id } = await harness.users.createUserWithEmailAndPassword({
    fullName: "Test Owner",
    email,
    password: "correct horse battery",
  });

  return { id, email };
}
