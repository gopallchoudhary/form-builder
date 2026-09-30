"use client";

import { EyeIcon, FileCheckIcon, LayersIcon, TrendingUpIcon } from "lucide-react";
import { Progress } from "~/components/ui/progress";

export interface DashboardTotals {
  forms: number;
  published: number;
  views: number;
  completions: number;
  completionRate: number;
}

export function DashboardKpis({ totals }: { totals: DashboardTotals }) {
  const percent = Math.round(totals.completionRate * 100);
  const drafts = Math.max(totals.forms - totals.published, 0);

  const tiles = [
    {
      label: "Total Responses",
      value: totals.completions.toLocaleString(),
      subtext: "Completed submissions",
      icon: FileCheckIcon,
      color: "text-positive",
      bgColor: "bg-positive-subtle",
    },
    {
      label: "Form Views",
      value: totals.views.toLocaleString(),
      subtext: "Unique visits in range",
      icon: EyeIcon,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Completion Rate",
      value: `${percent}%`,
      subtext: "Conversion efficiency",
      icon: TrendingUpIcon,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      progress: percent,
    },
    {
      label: "Active Forms",
      value: `${totals.published} Live`,
      subtext: `${drafts} draft${drafts === 1 ? "" : "s"} · ${totals.forms} total`,
      icon: LayersIcon,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <section aria-label="Overview KPI summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="flex flex-col justify-between rounded-xl border bg-card p-4.5 shadow-xs transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {tile.label}
              </span>
              <div className={`flex size-8 items-center justify-center rounded-lg ${tile.bgColor}`}>
                <Icon className={`size-4 ${tile.color}`} />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                {tile.value}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {tile.subtext}
              </p>
            </div>

            {tile.progress !== undefined && (
              <div className="mt-3">
                <Progress value={tile.progress} className="h-1.5" />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
