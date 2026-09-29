/**
 * Which navigation item owns a route.
 *
 * A parent link and a child link both "cover" a nested route, so a plain prefix test lights
 * up two items at once — `/forms` and `/dashboard` used to sit under one path, and every
 * page in the app highlighted both. The rule here is the one people already assume: the
 * closest match wins, and a parent stands down while one of its own children covers the
 * same route.
 */

/** Whether `url` is the pathname, or a directory above it. */
function covers(url: string, pathname: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function isNavItemActive(
  pathname: string,
  urls: readonly string[],
  url: string,
): boolean {
  if (!covers(url, pathname)) return false;

  /*
   * Only a *descendant* can displace this item. An ancestor cannot: `/forms` covers
   * `/forms/abc/build`, and testing against every other url would make Forms stand down
   * for the very page it owns, leaving nothing highlighted at all.
   */
  return !urls.some(
    (other) => other !== url && other.startsWith(`${url}/`) && covers(other, pathname),
  );
}
