import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { env } from "./env";

import * as schema from "./schema";

/**
 * The database handle type. Services accept one of these as an optional constructor
 * argument so integration tests can point a service at a dedicated test database
 * instead of the ambient `DATABASE_URL`.
 */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Builds a handle. Exported so tests can point the services at a dedicated test
 * database without depending on `drizzle-orm` themselves.
 */
export function createDatabase(url: string): Database {
  return drizzle(url, { schema });
}

export const db = createDatabase(env.DATABASE_URL);

export * from "drizzle-orm";
export { schema };
export default db;
