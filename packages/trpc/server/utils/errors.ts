import { TRPCError } from "@trpc/server";
import { isAppError, type AppErrorKind } from "@repo/services/utils/errors";

const TRPC_ERROR_CODES: Record<AppErrorKind, TRPCError["code"]> = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
};

/** Same mapping for the REST surface, which Express reports with status codes. */
const HTTP_STATUS: Record<AppErrorKind, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/** Returns null when the error is unexpected, i.e. a bug that must not be detailed. */
export function appErrorToHttpStatus(error: unknown): number | null {
  return isAppError(error) ? HTTP_STATUS[error.kind] : null;
}

/**
 * Services raise `AppError`; this is the one place that decides what a client
 * sees. Anything that is not an `AppError` or a `TRPCError` is a bug and is
 * deliberately left as an `Error` so the `errorFormatter` in `trpc.ts` scrubs
 * its message.
 */
export function toTRPCError(error: unknown): Error {
  if (error instanceof TRPCError) return error;

  if (isAppError(error)) {
    return new TRPCError({
      code: TRPC_ERROR_CODES[error.kind],
      message: error.message,
      cause: error,
    });
  }

  return error instanceof Error ? error : new Error("Non-error thrown", { cause: error });
}
