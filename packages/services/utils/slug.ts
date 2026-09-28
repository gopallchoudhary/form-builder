import { randomBytes } from "node:crypto";

/**
 * Slugs appear in the public share URL (`/f/[slug]`), so they need to be
 * URL-safe, readable and short. Anything unrecognisable collapses to a hyphen,
 * and a short random suffix keeps two forms with the same title apart without
 * making the creator click "retry".
 */
const MAX_SLUG_LENGTH = 64;
const SUFFIX_LENGTH = 6;
const RANDOM_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789"; // no l/1/0/o, which are easy to misread

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomSuffix(length = SUFFIX_LENGTH): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) {
    out += RANDOM_ALPHABET[byte % RANDOM_ALPHABET.length];
  }
  return out;
}

/**
 * Derives a candidate slug from a form title. Always returns something usable —
 * a title made entirely of punctuation or emoji falls back to a random slug.
 */
export function generateSlug(title: string): string {
  const base = slugify(title);
  const suffix = randomSuffix();
  const maxBaseLength = MAX_SLUG_LENGTH - suffix.length - 1;

  if (!base) return `form-${suffix}`;

  const trimmed = base.slice(0, maxBaseLength).replace(/-$/, "");
  return `${trimmed}-${suffix}`;
}
