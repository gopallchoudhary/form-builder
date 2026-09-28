import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from `node:crypto`.
 *
 * The salt, the cost parameters and the derived key all live in a single
 * self-describing string, so the database only needs one `password_hash` column
 * and hashes stay verifiable across parameter changes:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<key base64url>
 *
 * `verifyPassword` re-derives using the parameters recorded in the stored hash,
 * so raising the cost later does not invalidate existing users.
 */
const ALGORITHM = "scrypt";

const SALT_BYTES = 16;
const KEY_BYTES = 64;

// OWASP's recommended scrypt floor: N = 2^14, r = 8, p = 1 (16 MB of memory).
const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 } satisfies ScryptOptions;

// scrypt needs roughly 128 * N * r bytes; give it headroom above Node's 32 MB default.
const MAX_MEMORY = 64 * 1024 * 1024;

// Refuse to honour a stored N large enough to turn verification into a DoS vector.
const MAX_ACCEPTED_N = 1 << 20;

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await deriveKey(password, salt, KEY_BYTES, {
    ...DEFAULT_PARAMS,
    maxmem: MAX_MEMORY,
  });

  return [
    ALGORITHM,
    DEFAULT_PARAMS.N,
    DEFAULT_PARAMS.r,
    DEFAULT_PARAMS.p,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6) return false;

  const [algorithm, rawN, rawR, rawP, rawSalt, rawKey] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (algorithm !== ALGORITHM) return false;

  const N = Number.parseInt(rawN, 10);
  const r = Number.parseInt(rawR, 10);
  const p = Number.parseInt(rawP, 10);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) {
    return false;
  }
  if (N <= 1 || r <= 0 || p <= 0 || N > MAX_ACCEPTED_N) return false;

  const salt = Buffer.from(rawSalt, "base64url");
  const expectedKey = Buffer.from(rawKey, "base64url");
  if (salt.length === 0 || expectedKey.length === 0) return false;

  const actualKey = await deriveKey(password, salt, expectedKey.length, {
    N,
    r,
    p,
    maxmem: MAX_MEMORY,
  });

  return timingSafeEqual(actualKey, expectedKey);
}
