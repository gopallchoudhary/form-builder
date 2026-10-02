import { describe, expect, it } from "vitest";

import {
  PASSWORD_MIN_LENGTH,
  passwordProblemMessage,
  validatePasswordPair,
} from "~/lib/password-rules";

/**
 * Choosing a form password.
 *
 * The confirmation rule is not a formality. There is no way to recover a forgotten form
 * password — the hash is never returned by any query and nothing resets it — so a typo locks a
 * creator out of the responses on their own form, with deleting and rebuilding the form as the
 * only way out. These tests pin the rules that prevent that.
 */

describe("validatePasswordPair", () => {
  it("accepts a matching pair at the minimum length", () => {
    expect(validatePasswordPair("12345678", "12345678")).toBeNull();
  });

  it("rejects a password below the minimum", () => {
    expect(validatePasswordPair("1234567", "1234567")).toBe("too_short");
  });

  it("rejects a mismatch, even at a valid length", () => {
    expect(validatePasswordPair("correcthorse", "correcthors")).toBe("mismatch");
  });

  it("rejects a mismatch that is also short, reporting the length first", () => {
    // The length is the thing that has to be fixed before a mismatch can even be judged, and
    // reporting both at once reads as two problems when there is one.
    expect(validatePasswordPair("abc", "xyz")).toBe("too_short");
  });

  it("rejects two empty fields", () => {
    expect(validatePasswordPair("", "")).toBe("too_short");
  });

  it("is case sensitive, as the hash comparison is", () => {
    // `verifyPassword` compares digests, so `Password` and `password` are different passwords.
    // Catching it here is cheaper than finding out at the respondent's end.
    expect(validatePasswordPair("Passw0rd!", "passw0rd!")).toBe("mismatch");
  });

  it("does not trim, because whitespace can be part of a deliberate password", () => {
    expect(validatePasswordPair(" pass1234", " pass1234")).toBeNull();
  });

  it("keeps the minimum in step with the service schema", () => {
    // `setFormPasswordInput` enforces `.min(8)`. If these drift, the dialog would accept a
    // password the server then rejects, which reads as the save button not working.
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});

describe("passwordProblemMessage", () => {
  it("names the actual requirement rather than saying 'invalid'", () => {
    expect(passwordProblemMessage("too_short")).toContain(String(PASSWORD_MIN_LENGTH));
    expect(passwordProblemMessage("mismatch")).toMatch(/do not match/i);
  });

  it("has a message for every problem the validator can return", () => {
    // Otherwise a new problem type renders as an empty alert.
    expect(passwordProblemMessage("too_short").length).toBeGreaterThan(0);
    expect(passwordProblemMessage("mismatch").length).toBeGreaterThan(0);
  });
});