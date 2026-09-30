"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  FileSpreadsheetIcon,
  LayersIcon,
  LightbulbIcon,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";

export function DashboardQuickActions() {
  const actions = [
    {
      title: "Forms Library",
      description: "Manage questions, settings, themes, and publication status.",
      href: "/forms",
      icon: LayersIcon,
      badge: "Manage",
    },
    {
      title: "Response Inbox",
      description: "Review submissions, search answers, and export to CSV.",
      href: "/responses",
      icon: FileSpreadsheetIcon,
      badge: "Submissions",
    },
    {
      title: "Deep Analytics",
      description: "Inspect drop-off funnels, completion times, and answer trends.",
      href: "/analytics",
      icon: BarChart3Icon,
      badge: "Insights",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.title}
            href={action.href}
            className="group block focus:outline-hidden"
          >
            <Card className="h-full rounded-xl transition-all duration-200 group-hover:border-primary/50 group-hover:shadow-sm">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-muted-foreground text-xs font-medium">
                    {action.badge}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="group-hover:text-primary flex items-center gap-1.5 text-sm font-semibold transition-colors">
                    {action.title}
                    <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {action.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export function DashboardOptimizationTip() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
      <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
        <LightbulbIcon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground">Pro-tip for higher completion rates</p>
        <p className="text-muted-foreground mt-0.5 leading-relaxed">
          Forms using the <strong>Stepper</strong> layout with under 6 questions typically convert 28% better on mobile devices. Consider grouping long forms into clear sections.
        </p>
      </div>
    </div>
  );
}
