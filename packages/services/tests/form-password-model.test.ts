import { describe, expect, it } from "vitest";

import { setFormPasswordInput } from "../form/model";

/**
 * The form password's contract.
 *
 * Two rules here are load-bearing rather than cosmetic, and both were wrong at some point in
 * this feature's short life.
 *
 * `null` is the only way to clear a password. The builder's switch used to send an empty
 * string, which failed validation and left the form protected with no explanation — so
 * "remove the password" simply did not work.
 *
 * The floor is 8, matching the account password and the hint the builder's dialog shows. It
 * was 4, which the UI never mentioned, so a creator following the visible guidance could be
 * refused by the server.
 */
describe("setFormPasswordInput", () => {
  it("accepts a password at the minimum length", async () => {
    const parsed = await setFormPasswordInput.parseAsync({
      formId: "form-1",
      password: "12345678",
    });

    expect(parsed.password).toBe("12345678");
  });

  it("rejects a password shorter than eight characters", async () => {
    await expect(
      setFormPasswordInput.parseAsync({ formId: "form-1", password: "1234567" }),
    ).rejects.toThrow();
  });

  it("accepts null, which is how a password is removed", async () => {
    const parsed = await setFormPasswordInput.parseAsync({
      formId: "form-1",
      password: null,
    });

    expect(parsed.password).toBeNull();
  });

  it("rejects an empty string rather than treating it as 'clear'", async () => {
    // The two are easy to confuse at a call site, and silently unprotecting a form by accident
    // exposes the responses behind it.
    await expect(
      setFormPasswordInput.parseAsync({ formId: "form-1", password: "" }),
    ).rejects.toThrow();
  });

  it("rejects a password beyond the maximum length", async () => {
    await expect(
      setFormPasswordInput.parseAsync({ formId: "form-1", password: "x".repeat(129) }),
    ).rejects.toThrow();
  });

  it("requires a form id", async () => {
    await expect(setFormPasswordInput.parseAsync({ formId: "", password: null })).rejects.toThrow();
  });
});