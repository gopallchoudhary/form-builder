import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  isAppError,
} from "@repo/services/utils/errors";

import { appErrorToHttpStatus, toTRPCError } from "../server/utils/errors";

describe("toTRPCError", () => {
  it.each([
    [new BadRequestError("bad"), "BAD_REQUEST"],
    [new UnauthorizedError(), "UNAUTHORIZED"],
    [new ForbiddenError(), "FORBIDDEN"],
    [new NotFoundError("missing"), "NOT_FOUND"],
    [new ConflictError("duplicate"), "CONFLICT"],
  ])("maps %s onto the matching tRPC code", (error, code) => {
    const mapped = toTRPCError(error);

    expect(mapped).toBeInstanceOf(TRPCError);
    expect(mapped.code).toBe(code);
  });

  it("preserves the AppError message so the UI can show it", () => {
    expect(toTRPCError(new NotFoundError("Form does not exist")).message).toBe("Form does not exist");
  });

  it("passes an existing TRPCError through untouched", () => {
    const original = new TRPCError({ code: "FORBIDDEN", message: "nope" });

    expect(toTRPCError(original)).toBe(original);
  });

  it("leaves unexpected errors as plain Errors so the errorFormatter scrubs them", () => {
    const bug = new Error("connection string postgres://user:hunter2@host/db");

    const mapped = toTRPCError(bug);

    expect(mapped).toBe(bug);
    expect(mapped).not.toBeInstanceOf(TRPCError);
  });

  it("wraps a thrown non-error rather than losing it", () => {
    const mapped = toTRPCError("something odd");

    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.cause).toBe("something odd");
  });

  it("keeps the original error as the cause for logging", () => {
    const original = new ConflictError("duplicate");

    expect(toTRPCError(original).cause).toBe(original);
  });
});

describe("appErrorToHttpStatus", () => {
  it.each([
    [new BadRequestError("bad"), 400],
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError("missing"), 404],
    [new ConflictError("duplicate"), 409],
  ])("maps %s to HTTP %i", (error, status) => {
    expect(appErrorToHttpStatus(error)).toBe(status);
  });

  it("returns null for unexpected errors so the handler can treat them as 500", () => {
    expect(appErrorToHttpStatus(new Error("boom"))).toBeNull();
    expect(appErrorToHttpStatus(undefined)).toBeNull();
  });
});

describe("isAppError", () => {
  it("recognises every subclass but not a plain Error", () => {
    expect(isAppError(new ConflictError("x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });

  it("gives each subclass a distinct name for logs", () => {
    expect(new NotFoundError("x").name).toBe("NotFoundError");
    expect(new ConflictError("x").name).toBe("ConflictError");
  });
});
