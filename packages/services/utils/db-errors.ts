/**
 * Drizzle wraps driver errors in its own `DrizzleError`, which carries the original on
 * `cause` but not the Postgres fields. So a `unique_violation` check has to look at
 * least one level down, or it silently never matches and every constraint violation
 * surfaces to the caller as an opaque 500.
 */

const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 5;

interface DriverErrorFields {
  code?: string;
  constraint?: string;
  name?: string;
}

/** Walks the `cause` chain and returns the first error that looks like a driver error. */
export function findDriverError(error: unknown): DriverErrorFields | null {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) return null;

    const candidate = current as DriverErrorFields & { cause?: unknown };
    if (typeof candidate.code === "string") {
      return { code: candidate.code, constraint: candidate.constraint, name: candidate.name };
    }

    current = candidate.cause;
  }

  return null;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const driver = findDriverError(error);
  if (!driver || driver.code !== UNIQUE_VIOLATION) return false;
  if (constraint === undefined) return true;
  return (driver.constraint ?? "").includes(constraint);
}
