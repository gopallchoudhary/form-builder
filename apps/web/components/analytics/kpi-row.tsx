"use client";

/**
 * The headline numbers, in the order a creator asks for them: how many finished, how many
 * looked, how well it converted, and how long it took.
 *
 * No chart here. These are four facts, and a number in a large face is read faster than a
 * bar in a chart.
 */

export interface Kpis {
  responses: number;
  views: number;
  completionRate: number;
  averageSeconds: number | null;
  medianSeconds?: number | null;
}

const percent = (rate: number) => `${rate >= 0 && rate < 0.005 ? "<1" : Math.round(rate * 100)}%`;

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function KpiRow({ kpis, caption }: { kpis: Kpis; caption?: string }) {
  const tiles = [
    { label: "Responses", value: String(kpis.responses) },
    { label: "Opened", value: String(kpis.views) },
    { label: "Completion rate", value: percent(kpis.completionRate) },
    { label: "Average time", value: formatDuration(kpis.averageSeconds) },
  ];

  return (
    <section aria-label="Summary">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-card p-4 ring-1 ring-border">
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {tile.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
      {caption && <p className="text-muted-foreground mt-2 text-xs">{caption}</p>}
    </section>
  );
}
