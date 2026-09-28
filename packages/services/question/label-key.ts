/**
 * Turns a human-readable label into the stable slug stored in `labelKey`.
 *
 * `labelKey` is write-once: it is derived when a field is created and never
 * updated afterwards, so existing responses keep resolving to the same key even
 * after the label is reworded. That is why it must be deterministic and why the
 * service must never regenerate it on update.
 */
export function toLabelKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric characters
    .replace(/\s+/g, "-") // whitespace runs → single hyphen
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, "") // trim leading/trailing hyphens
    .slice(0, 50); // respect the DB column length
}
