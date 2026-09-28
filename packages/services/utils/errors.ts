/**
 * Transport-agnostic error hierarchy for the service layer.
 *
 * Services must not depend on `@trpc/server`; they raise these instead. The tRPC
 * layer maps them onto `TRPCError` codes in a single middleware
 * (`packages/trpc/server/trpc.ts`), and the Express error handler maps them onto
 * HTTP status codes for the REST surface.
 *
 * Anything thrown that is *not* an `AppError` is treated as a bug: it is reported
 * as `INTERNAL_SERVER_ERROR` and its message is scrubbed before it reaches a client.
 */
export type AppErrorKind =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT";

/**
 * A global symbol, used to brand instances rather than relying on `instanceof`.
 *
 * `packages/services` and `@repo/services` can resolve as two separate module
 * instances — in a test runner, and under a bundler that inlines a workspace package —
 * and then `error instanceof AppError` is false across the boundary, silently turning
 * every typed error into an opaque 500. `Symbol.for` returns the same symbol in every
 * realm and in every copy of this module, so the brand survives duplication.
 */
const APP_ERROR = Symbol.for("streamyst.AppError");

export interface AppErrorOptions {
  cause?: unknown;
  /** Structured payload attached to the error, safe to expose to the caller. */
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly details?: Record<string, unknown>;
  /** Brand, so `isAppError` works even across duplicated module instances. */
  readonly [APP_ERROR] = true;

  constructor(kind: AppErrorKind, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.kind = kind;
    this.details = options.details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super("BAD_REQUEST", message, options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You are not signed in", options?: AppErrorOptions) {
    super("UNAUTHORIZED", message, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource", options?: AppErrorOptions) {
    super("FORBIDDEN", message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super("NOT_FOUND", message, options);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super("CONFLICT", message, options);
  }
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Record<symbol, unknown>)[APP_ERROR] === true &&
    typeof (error as AppError).kind === "string"
  );
}
