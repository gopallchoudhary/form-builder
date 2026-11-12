import Image from "next/image";

import logo from "~/app/formora.svg";
import { cn } from "~/lib/utils";

/**
 * The square Formora brand mark.
 *
 * The wordmark beside it already names the product, so the image is decorative and
 * intentionally has empty alt text.
 */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("shrink-0 rounded-md object-cover", className)}
    />
  );
}
