import { env } from "~/env.js";

/**
 * The link a creator copies for a poll, and the voter URL it points at.
 *
 * Mirrors `publicFormUrl` (`/f/[slug]`) with the poll's own prefix (`/p/[slug]`), kept
 * separate rather than parameterised: the two URLs are different products with different
 * pages behind them, and a shared builder would let one drift into the other's shape.
 *
 * Same contract as its sibling — `""` means "no link", so the copy button can disable on
 * exactly that — and the same `NEXT_PUBLIC_APP_URL` fallback with its warning.
 */

function baseUrl(): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");

  if (configured) return configured;

  if (typeof window !== "undefined") {
    console.warn(
      "[share] NEXT_PUBLIC_APP_URL is not set; falling back to window.location.origin.",
      "Set it in .env — the link will be wrong on any other host.",
    );
    return window.location.origin;
  }

  return "";
}

/** The absolute URL for a poll's public voting page. */
export function publicPollUrl(slug: string): string {
  const base = baseUrl();
  if (!base || !slug) return "";
  return `${base}/p/${slug}`;
}
