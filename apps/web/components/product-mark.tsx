import Link from "next/link";

/**
 * The wordmark, used on the two pages that have no navigation of their own.
 *
 * One component, so the product name is written once — it was `Acme Inc.` in three places
 * and a stale `href="#"` in two of them.
 */
export function ProductMark({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={[
        "flex items-center gap-2 self-center font-medium",
        "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none",
        className ?? "",
      ].join(" ")}
    >
      <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-pill text-xs font-bold">
        S
      </span>
      Streamyst
    </Link>
  )
}
