import { describe, expect, it } from "vitest";

import {
  createUserWithEmailAndPasswordInput,
  signInUserWithEmailAndPasswordInput,
} from "../user/model";

describe("user input models", () => {
  it("normalises the email so lookups are case-insensitive", async () => {
    const parsed = await createUserWithEmailAndPasswordInput.parseAsync({
      fullName: "Gopal",
      email: "  Gopal@Example.COM ",
      password: "longenoughpassword",
    });

    expect(parsed.email).toBe("gopal@example.com");
    expect(parsed.fullName).toBe("Gopal");
  });

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      createUserWithEmailAndPasswordInput.parseAsync({
        fullName: "Gopal",
        email: "gopal@example.com",
        password: "short",
      }),
    ).rejects.toThrow();
  });

  it("rejects a malformed email", async () => {
    await expect(
      createUserWithEmailAndPasswordInput.parseAsync({
        fullName: "Gopal",
        email: "not-an-email",
        password: "longenoughpassword",
      }),
    ).rejects.toThrow();
  });

  it("allows any non-empty password on sign in so the server can answer uniformly", async () => {
    await expect(
      signInUserWithEmailAndPasswordInput.parseAsync({ email: "gopal@example.com", password: "x" }),
    ).resolves.toMatchObject({ password: "x" });

    await expect(
      signInUserWithEmailAndPasswordInput.parseAsync({ email: "gopal@example.com", password: "" }),
    ).rejects.toThrow();
  });
});
