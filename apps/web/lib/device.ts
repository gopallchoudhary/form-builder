/**
 * A stable per-browser id.
 *
 * Not an identity — only a key for resuming a draft, casting one vote per device, and
 * similar device-scoped rules. Shared by forms and polls on purpose: one browser is one
 * device everywhere, so a vote limit and a response limit mean the same thing.
 */
export function readDeviceId(): string {
  const KEY = "streamyst:device";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(KEY, created);
  return created;
}
