import { env } from "~/env.js";

/**
 * The link a creator copies, and the one a QR code encodes.
 *
 * It lives here rather than in the share tab because two places now need it: the share
 * workspace, and the share button on each card in the forms grid. The fallback logic in
 * particular is not something to write twice — a second copy of "what is the base URL" is
 * how the app ended up serving bare `/f/my-form` paths that nobody could open.
 */

/** A trailing slash in the base would produce `//f/…`, which some servers treat differently. */
function baseUrl(): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");

  if (configured) return configured;

  /*
   * The share link is the product's main artefact, so it should not be the one thing that
   * stops working on a machine that has not set the variable. Falling back to the origin
   * being viewed gives a link that is correct for whoever is looking at it.
   *
   * The warn matters: this fallback is only correct for a single-domain deploy, and a
   * production instance missing this would otherwise hand out links silently pointing at
   * wherever it happens to be running. It is a safety net, not a substitute for configuring
   * `NEXT_PUBLIC_APP_URL`.
   */
  if (typeof window !== "undefined") {
    console.warn(
      "[share] NEXT_PUBLIC_APP_URL is not set; falling back to window.location.origin.",
      "Set it in .env — the link will be wrong on any other host.",
    );
    return window.location.origin;
  }

  return "";
}

/**
 * The absolute URL for a form's public page.
 *
 * Returns `""` when there is no base to build on, so a caller can tell "no link" from "a
 * link that happens to be short" — the copy button disables on the first and not the second.
 */
export function publicFormUrl(slug: string): string {
  const base = baseUrl();
  if (!base || !slug) return "";
  return `${base}/f/${slug}`;
}
