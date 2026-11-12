import Link from "next/link";

import { BrandIcon } from "~/components/brand-icon";
import { cn } from "~/lib/utils";

/**
 * The wordmark, used on the two pages that have no navigation of their own.
 *
 * One component, so the product name is written once — it was `Acme Inc.` in three places
 * and a stale `href="#"` in two of them.
 */
export function ProductMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 self-center font-medium",
        "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <BrandIcon className="size-9" />
      Formora
    </Link>
  );
}
