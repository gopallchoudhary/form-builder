import { withPercentages, type TallyBucket } from "~/lib/poll-tally";
import { cn } from "~/lib/utils";

/**
 * One horizontal bar per option, with counts and percentages.
 *
 * Order is the poll's option order, never re-sorted by count: with a live tally, sorting
 * would make bars jump past each other on every vote, which reads as flicker rather than
 * movement. The longest bar is the scale, so a race that tightens still shows at full
 * width instead of shrinking into a corner.
 */
export function PollResultsBars({
  buckets,
  total,
  highlightOptionId,
  className,
}: {
  buckets: readonly TallyBucket[];
  total: number;
  /** The voter's own choice, outlined so they can find it in the tally. */
  highlightOptionId?: string | null;
  className?: string;
}) {
  const rows = withPercentages(buckets, total);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {rows.map((row) => (
        <div key={row.optionId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {row.count} · {row.percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={row.count}
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-label={`${row.label}: ${row.count} votes, ${row.percent} percent`}
            className={cn(
              "mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted",
              highlightOptionId === row.optionId && "ring-1 ring-primary ring-offset-1 ring-offset-background",
            )}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
