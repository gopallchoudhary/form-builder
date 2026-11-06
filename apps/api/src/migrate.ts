import path from "node:path";

import { db, migrate } from "@repo/database";

/**
 * Applies every pending Drizzle migration, then exits.
 *
 * This runs as a one-off compose service before the API is recreated. Doing it as a separate
 * process means a failed migration stops the deploy while the previous API container is still
 * serving, rather than half-starting an API against a schema it does not understand.
 */
async function main() {
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "migrations");

  await migrate(db, { migrationsFolder });
  console.log(`Applied migrations from ${migrationsFolder}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Migration failed", error);
    process.exit(1);
  });
