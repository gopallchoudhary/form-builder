import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../utils/password";

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("Correct horse battery staple", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("never stores the plaintext", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
  });

  it("salts each hash independently", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);

    expect(a).not.toBe(b);
    await expect(verifyPassword("same-password", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password", b)).resolves.toBe(true);
  });

  it("records its own algorithm and cost parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const [algorithm, N, r, p, salt, key] = hash.split("$");

    expect(algorithm).toBe("scrypt");
    expect(Number(N)).toBe(16384);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(salt!, "base64url")).toHaveLength(16);
    expect(Buffer.from(key!, "base64url")).toHaveLength(64);
  });

  it("rejects malformed or hostile stored hashes without throwing", async () => {
    for (const stored of [
      "",
      "not-a-hash",
      "scrypt$16384$8$1$only-four-parts",
      // Excessive cost factor must not be honoured — that is a DoS vector.
      `scrypt$${1 << 21}$8$1$c2FsdA$a2V5`,
      "bcrypt$16384$8$1$c2FsdA$a2V5",
      "scrypt$abc$8$1$c2FsdA$a2V5",
      `scrypt$16384$8$1$$a2V5`,
    ]) {
      await expect(verifyPassword("whatever", stored)).resolves.toBe(false);
    }
  });

  it("does not accept a hash whose key was swapped for a different length", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const [algorithm, N, r, p, salt] = hash.split("$");
    const forged = [algorithm, N, r, p, salt, Buffer.alloc(16).toString("base64url")].join("$");

    await expect(verifyPassword("correct horse battery staple", forged)).resolves.toBe(false);
  });
});
