/**
 * Create the databases named in the environment, if they are not there yet.
 *
 * `drizzle-kit migrate` creates tables but not the database itself, so a fresh machine —
 * and every CI run — fails at the first migration with a confusing "does not exist" for a
 * database nobody has heard of. The test database matters most: the suite clones it per
 * test file, so it has to exist before the first test rather than being created by one.
 */
import { Client } from "pg";

const urls = [process.env.DATABASE_URL, process.env.DATABASE_URL_TEST].filter(Boolean);

if (urls.length === 0) {
  console.error("DATABASE_URL or DATABASE_URL_TEST is not set; nothing to create.");
  process.exit(1);
}

const names = new Set();
for (const url of urls) {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (name) names.add(name);
}

const admin = new Client({ connectionString: urls[0] });
await admin.connect();

try {
  const existing = await admin.query("select datname from pg_database");
  const present = new Set(existing.rows.map((row) => row.datname));

  for (const name of names) {
    if (present.has(name)) {
      console.log(`database ${name} already exists`);
      continue;
    }

    // CREATE DATABASE cannot be parameterised, so the name is quoted instead. It comes
    // from this project's own environment file, not from user input.
    await admin.query(`create database "${name.replace(/"/g, '""')}"`);
    console.log(`created database ${name}`);
  }
} finally {
  await admin.end();
}
