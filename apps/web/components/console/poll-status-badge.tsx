import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type PollStatus = "DRAFT" | "OPEN" | "CLOSED";

const STYLES: Record<PollStatus, { label: string; className: string }> = {
  // Draft is muted because it is invisible: nothing about it is live yet.
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  OPEN: { label: "Open", className: "bg-positive-subtle text-positive-foreground" },
  CLOSED: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

/**
 * Which lifecycle state a poll is in.
 *
 * Open reads as live (the positive tint), everything else as quiet. Closed is deliberately
 * not red: closing is a normal, reversible end to voting, not a failure.
 */
export function PollStatusBadge({ status, className }: { status: PollStatus; className?: string }) {
  const style = STYLES[status];

  return (
    <Badge variant="outline" className={cn("gap-1.5", style.className, className)}>
      {status === "OPEN" && <span aria-hidden className="bg-positive size-1.5 rounded-full" />}
      {style.label}
    </Badge>
  );
}
