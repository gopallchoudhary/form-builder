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

/** The builder a creator was last in, as far as a link is concerned. */
export interface RememberedBuilder {
  formId: string | null;
  section: unknown;
}

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
 * Forms resumes the builder rather than opening the list. A hardcoded `/forms` threw that
 * away: clicking Forms from the middle of editing a form dumped them on the list and lost the
 * section they had open, so the only way back to it was a card click and a guess about which.
 *
 * Two sources, in order. The live URL wins when the creator is already inside a builder,
 * because it is where they are right now and it covers segments like `preview` that are
 * deliberately never remembered. Failing that, the remembered form answers — which is what
 * makes the link work from Responses and Analytics too, where the URL says nothing about
 * which form was being edited.
 *
 * Every other item navigates to itself. With no builder to resume, `/forms` still resolves to
 * the list, and the builder header carries a back button for leaving a builder deliberately.
 */
export const navHref = (url: string, pathname: string, remembered?: RememberedBuilder): string => {
  if (url !== "/forms") return url;

  // Already inside a builder: the URL is the truth, including a section like `preview` that
  // is never remembered. This is the common case and needs no store at all.
  const here = builderLocation(pathname);
  if (here) return `/forms/${here.formId}/${here.segment}`;

  // Stepped away from the builder entirely, by way of Responses or Analytics. The remembered
  // form is the only thing left saying where they were, and reading the section the same way
  // is what keeps this consistent with the forms list.
  if (remembered?.formId) return resolveBuilderHref(remembered.formId, remembered.section);

  return url;
};
