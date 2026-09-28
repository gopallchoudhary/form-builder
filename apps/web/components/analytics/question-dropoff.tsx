"use client";

import { TrendingDownIcon } from "lucide-react";
import type { RouterOutputs } from "@repo/trpc/client";

/**
 * Reached versus answered, per question.
 *
 * The gap between the two bars is the interesting part: "reached but did not answer" is a
 * question people saw and walked past, which usually means the label is unclear or the
 * requirement is unwelcome. The largest such gap is called out, because it is the one worth
 * a creator's time — a sorted list of eight similar bars would make them find it themselves.
 */

export type DropOffRow = RouterOutputs["analytics"]["getQuestionDropOff"][number];

export function QuestionDropOff({ rows }: { rows: DropOffRow[] }) {
  if (rows.length === 0) {
    return (
      <Panel title="Question drop-off">
        <p className="text-muted-foreground text-sm">No questions to show yet.</p>
      </Panel>
    );
  }

  // Only completed responses count towards a question's totals, so an unfinished response
  // cannot make a question look abandoned.
  const total = rows[0]?.reached ?? 0;
  const worst = rows.reduce<DropOffRow | null>((lowest, row) => {
    const lost = row.reached - row.answered;
    if (lost <= 0) return lowest;
    if (!lowest) return row;
    const lowestLost = lowest.reached - lowest.answered;
    return lost > lowestLost ? row : lowest;
  }, null);

  return (
    <Panel
      title="Question drop-off"
      caption={
        worst && worst.reached > worst.answered
          ? `"${worst.label}" was reached ${worst.reached - worst.answered} time${
              worst.reached - worst.answered === 1 ? "" : "s"
            } more often than it was answered.`
          : undefined
      }
    >
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const lost = row.reached - row.answered;
          const isWorst = worst?.questionId === row.questionId && lost > 0;

          return (
            <li key={row.questionId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm">{row.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {row.answered} of {row.reached}
                </span>
              </div>

              <div className="mt-1 flex flex-col gap-1">
                <Bar
                  value={row.reached}
                  max={total}
                  className="bg-[#38c8ff]"
                  title={`Reached by ${row.reached}`}
                />
                <Bar
                  value={row.answered}
                  max={total}
                  className="bg-primary"
                  title={`Answered by ${row.answered}`}
                />
              </div>

              {isWorst && (
                <p className="mt-1 flex items-center gap-1 text-xs text-[#b86700]">
                  <TrendingDownIcon className="size-3" />
                  {lost} reached it without answering
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground mt-4 text-xs">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="bg-[#38c8ff] inline-block size-2 rounded-pill" />
          reached
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary inline-block size-2 rounded-pill" />
          answered
        </span>
      </p>
    </Panel>
  );
}

function Bar({
  value,
  max,
  className,
  title,
}: {
  value: number;
  max: number;
  className: string;
  title: string;
}) {
  const width = max === 0 ? 0 : Math.max(1, Math.round((value / max) * 100));

  return (
    <div className="h-2 w-full overflow-hidden rounded-pill bg-muted" title={title}>
      <div
        className={`h-full rounded-pill transition-[width] duration-500 motion-reduce:transition-none ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-sm font-medium">{title}</h2>
      {caption && <p className="mt-1 text-xs text-[#b86700]">{caption}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
