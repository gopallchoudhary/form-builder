import { describe, expect, it } from "vitest";

import {
  UNLOCK_TTL_MS,
  issueUnlockToken,
  passwordFingerprint,
  verifyUnlockToken,
} from "../utils/signed-token";

/**
 * The form-unlock token.
 *
 * The binding to the password is the part worth pinning. The token is held by the respondent
 * in a cookie and in client state for 30 days, and it used to prove only "the right password
 * was given for this form, before some point in time" — nothing about *which* password. So
 * rotating a password, which is what you do precisely because the old one was seen by someone
 * who should not have had it, changed nothing for anyone already holding a token.
 *
 * The hash is already a per-version identifier, because scrypt salts randomly. These tests use
 * fixed strings standing in for that, which is all the comparison ever sees.
 */

const FORM = "00000000-0000-4000-8000-000000000001";
const OTHER_FORM = "00000000-0000-4000-8000-000000000002";

const HASH_V1 = "scrypt$16384$8$1$c2FsdHNhbHQ$a2V5";
const HASH_V2 = "scrypt$16384$8$1$b3RoZXJzYWx0$a2V5Mg";

describe("verifyUnlockToken", () => {
  it("accepts a token issued for this form and this password", () => {
    const token = issueUnlockToken(FORM, HASH_V1);

    expect(verifyUnlockToken(token, FORM, HASH_V1)).toBe(true);
  });

  it("rejects a token once the password changes", () => {
    // The behaviour this whole change exists for. A rotated password must revoke every token
    // issued under the old one, not just stop issuing new ones.
    const token = issueUnlockToken(FORM, HASH_V1);

    expect(verifyUnlockToken(token, FORM, HASH_V2)).toBe(false);
  });

  it("rejects a token issued before the form gained a password", () => {
    // Unlocking an open form issues a token, and that must not survive the form being closed
    // off — otherwise the one token everybody has quietly keeps working.
    const token = issueUnlockToken(FORM, null);

    expect(verifyUnlockToken(token, FORM, null)).toBe(true);
    expect(verifyUnlockToken(token, FORM, HASH_V1)).toBe(false);
  });

  it("rejects a token issued after the form's password was removed", () => {
    const token = issueUnlockToken(FORM, HASH_V1);

    expect(verifyUnlockToken(token, FORM, null)).toBe(false);
  });

  it("rejects a token for a different form", () => {
    const token = issueUnlockToken(FORM, HASH_V1);

    expect(verifyUnlockToken(token, OTHER_FORM, HASH_V1)).toBe(false);
  });

  it("rejects a token once it has expired", () => {
    const issuedAt = 1_000_000;
    const token = issueUnlockToken(FORM, HASH_V1, issuedAt);

    expect(verifyUnlockToken(token, FORM, HASH_V1, issuedAt + UNLOCK_TTL_MS)).toBe(false);
    // The instant before expiry still stands.
    expect(verifyUnlockToken(token, FORM, HASH_V1, issuedAt + UNLOCK_TTL_MS - 1)).toBe(true);
  });

  it("rejects a missing or empty token", () => {
    expect(verifyUnlockToken(undefined, FORM, HASH_V1)).toBe(false);
    expect(verifyUnlockToken("", FORM, HASH_V1)).toBe(false);
  });

  it("rejects a token whose payload has been edited", () => {
    // The signature covers the payload, so pointing it at another form invalidates it.
    const token = issueUnlockToken(FORM, HASH_V1);
    const [payload, signature] = token.split(".");
    const tampered = `${payload!.replace(FORM, OTHER_FORM)}.${signature}`;

    expect(verifyUnlockToken(tampered, OTHER_FORM, HASH_V1)).toBe(false);
  });

  it("rejects a token carrying an older three-part payload", () => {
    /*
     * Pinned deliberately.
     *
     * The payload grew a field, so every token already in the wild fails this regex and its
     * respondents are asked once more. That is the correct outcome and it is a one-off, but it
     * is exactly the kind of thing someone would "fix" later by tolerating the old shape —
     * which would silently give back the very behaviour this change removes.
     */
    const legacyPayload = `1000000:${FORM}:${1000000 + UNLOCK_TTL_MS}`;

    expect(verifyUnlockToken(legacyPayload, FORM, HASH_V1)).toBe(false);
  });
});

describe("passwordFingerprint", () => {
  it("is stable for the same hash", () => {
    // Verified against the same stored value on every request, so it cannot vary.
    expect(passwordFingerprint(HASH_V1)).toBe(passwordFingerprint(HASH_V1));
  });

  it("differs when the hash differs", () => {
    expect(passwordFingerprint(HASH_V1)).not.toBe(passwordFingerprint(HASH_V2));
  });

  it("gives an unprotected form its own value rather than a shared sentinel", () => {
    // Otherwise every open form would fingerprint identically and a token from one could be
    // presented against another.
    expect(passwordFingerprint(null)).not.toBe(passwordFingerprint(HASH_V1));
    expect(passwordFingerprint(null)).toBe(passwordFingerprint(null));
  });

  it("reveals nothing about the hash it came from", () => {
    // The cookie is readable by the client (`httpOnly: false`), so this value is on show. It
    // must not be usable to test a guess against the real hash.
    const fingerprint = passwordFingerprint(HASH_V1);

    expect(fingerprint).not.toContain(HASH_V1);
    expect(fingerprint).not.toContain("$");
    expect(fingerprint).toHaveLength(16);
  });
});