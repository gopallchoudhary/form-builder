import { isBuilderSection, type BuilderSection } from "~/stores/console-store";

/**
 * Where to send someone who has just clicked a link into a form's builder.
 *
 * The section is a route segment (`/forms/[formId]/[segment]`), so the URL is the single
 * source of truth for where the builder is — this only decides what a link should *point*
 * at. That is why nothing here reads a router or a path: a link has to be computable at
 * render time on the forms list, which has no notion of the builder at all.
 *
 * The two callers are the card on `/forms` and the back-to-form link in the Responses and
 * Analytics headers. Both are places where the URL is silent about the section, which is the
 * only situation this is allowed to decide. Anywhere a URL is explicit — a direct link, a
 * refresh, a pasted address, the tab strip itself — the URL wins, because the route is what
 * actually renders.
 */

export const DEFAULT_SECTION: BuilderSection = "build";

/**
 * Resolve the href for opening a form, preferring the section the creator last had open.
 *
 * Guarded rather than cast, because `lastSectionByForm` is read back out of localStorage and
 * a hand-edited or stale entry can hold anything. An unrecognised section falls back to
 * `build` rather than producing a link to a route that does not exist.
 */
export const resolveBuilderHref = (formId: string, remembered: unknown): string =>
  `/forms/${formId}/${isBuilderSection(remembered) ? remembered : DEFAULT_SECTION}`;

/** A pathname that is one form's builder, split into the parts a link needs. */
export interface BuilderLocation {
  formId: string;
  /**
   * The section actually on screen, which may be `preview`.
   *
   * Distinct from the remembered section on purpose: this comes from the URL the creator is
   * looking at right now, so it is the more recent of the two by definition.
   */
  segment: string;
}

const BUILDER_PATH = /^\/forms\/([^/]+)\/([^/]+)/;

/**
 * Which form's builder `pathname` is, if it is one.
 *
 * Used to make the sidebar's Forms link point back at the builder rather than the list. A
 * creator who is part-way through editing a form and clicks Forms does not want the list —
 * they want to be where they were, and the list is one click further away than it was.
 */
export const builderLocation = (pathname: string): BuilderLocation | null => {
  const match = BUILDER_PATH.exec(pathname);
  if (!match) return null;
  const [, formId, segment] = match;
  if (!formId || !segment) return null;
  return { formId, segment };
};

/**
 * Where a sidebar nav item should point, which is not always its own url.
 *
 * Forms goes back to the builder when the creator is already inside one. A hardcoded `/forms`
 * threw that away: clicking Forms from the middle of editing a form dumped them on the list,
 * and the section they had open was lost, so the only way back to it was a card click and a
 * guess about which one.
 *
 * The segment comes from the URL rather than from the remembered section, because the URL is
 * where the creator is right now and so is the better record of it — and it keeps `preview`
 * working as a destination without teaching it to the remembered-section store.
 *
 * Every other item navigates to itself, and `/forms` on its own still resolves to the list,
 * so the list stays reachable from anywhere outside a builder.
 */
export const navHref = (url: string, pathname: string): string => {
  if (url !== "/forms") return url;

  const here = builderLocation(pathname);
  return here ? `/forms/${here.formId}/${here.segment}` : url;
};
