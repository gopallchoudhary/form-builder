import { TRPCError } from "@trpc/server";
import { isAppError, type AppError, type AppErrorKind } from "@repo/services/utils/errors";

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

function fromAppError(error: AppError): TRPCError {
  return new TRPCError({
    code: TRPC_ERROR_CODES[error.kind],
    message: error.message,
    cause: error,
  });
}

/**
 * Services raise `AppError`; this is the one place that decides what a client sees.
 *
 * The unwrap branch matters: tRPC converts anything thrown by the resolver into an
 * INTERNAL_SERVER_ERROR *inside* the middleware chain, keeping the original on `cause`.
 * So by the time an outer middleware catches it, the error is already a TRPCError
 * carrying an AppError — without unwrapping, every typed service error would reach the
 * client as an opaque 500.
 */
export function toTRPCError(error: unknown): Error {
  if (isAppError(error)) return fromAppError(error);

  if (error instanceof TRPCError) {
    if (error.code === "INTERNAL_SERVER_ERROR" && isAppError(error.cause)) {
      return fromAppError(error.cause);
    }
    return error;
  }

  return error instanceof Error ? error : new Error("Non-error thrown", { cause: error });
}

/** Returns null when the error is unexpected, i.e. a bug that must not be detailed. */
export function appErrorToHttpStatus(error: unknown): number | null {
  return isAppError(error) ? HTTP_STATUS[error.kind] : null;
}
