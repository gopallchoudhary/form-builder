"use client";

import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import {
  LayersIcon,
  PaletteIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";

import { TrendChart } from "~/components/analytics/trend-chart";
import { CreateFormModal } from "~/components/console/create-form-modal";
import { DashboardKpis } from "~/components/console/dashboard-kpis";
import {
  DashboardOptimizationTip,
  DashboardQuickActions,
} from "~/components/console/dashboard-quick-actions";
import { TopFormsCard } from "~/components/console/top-forms-card";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetOverview } from "~/hooks/api/analytics";
import { useUser } from "~/hooks/api/auth";
import {
  RANGE_PRESETS,
  useAnalyticsStore,
  type RangePreset,
} from "~/stores/analytics-store";

/**
 * The executive overview dashboard.
 *
 * Provides a high-leverage workspace command center:
 * 1. Fleet summary KPIs (completions, views, conversion rate, published fleet health).
 * 2. Visual engagement trend over the chosen period.
 * 3. Top performing forms ranking with live metrics and instant shortcuts.
 * 4. Direct action shortcuts into builder, responses, and deep analytics.
 */
export default function OverviewPage() {
  const { user } = useUser();
  const { preset, setPreset, toQuery } = useAnalyticsStore(
    useShallow((state) => ({
      preset: state.preset,
      setPreset: state.setPreset,
      toQuery: state.toQuery,
    })),
  );

  const { data, isLoading } = useGetOverview(toQuery());

  const displayName =
    user?.fullName?.trim()?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const totalForms = data?.totals.forms ?? 0;
  const publishedForms = data?.totals.published ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLoading
              ? "Loading your workspace overview…"
              : totalForms === 0
                ? "Start building your first interactive form below."
                : `Managing ${totalForms} form${totalForms === 1 ? "" : "s"} (${publishedForms} active & collecting responses).`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range selector */}
          <div
            role="group"
            aria-label="Time range selector"
            className="flex rounded-lg border bg-muted/50 p-0.5"
          >
            {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={preset === option ? "default" : "ghost"}
                aria-pressed={preset === option}
                className="h-8 px-3 text-xs"
                onClick={() => setPreset(option)}
              >
                {RANGE_PRESETS[option]}d
              </Button>
            ))}
          </div>

          {/* Primary Create CTA */}
          <CreateFormModal triggerLabel="New Form" />
        </div>
      </div>

      {/* ── Loading Skeleton ──────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* ── Zero-State Onboarding ─────────────────────────────── */}
      {!isLoading && data && totalForms === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
            <div className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
              <SparklesIcon className="size-7" />
            </div>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Ready to create your first form?
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
              Build stunning, accessible multi-step forms in minutes. Gather answers, analyze drop-off, and automate responses.
            </p>

            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-primary mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <LayersIcon className="size-4" />
                </div>
                <p className="text-xs font-semibold">1. Choose Structure</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Pick between a high-converting stepper or a comprehensive multi-page layout.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="text-primary mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <PaletteIcon className="size-4" />
                </div>
                <p className="text-xs font-semibold">2. Style & Configure</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Select from 13 question blocks, customize themes, and apply password gates.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="text-primary mb-2 flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <Share2Icon className="size-4" />
                </div>
                <p className="text-xs font-semibold">3. Share & Collect</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Publish instantly, generate a QR code, and watch responses stream in live.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <CreateFormModal triggerLabel="Create Your First Form" triggerSize="lg" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Dashboard Content ──────────────────────────── */}
      {!isLoading && data && totalForms > 0 && (
        <div className="flex flex-col gap-6">
          {/* Fleet KPI Row */}
          <DashboardKpis totals={data.totals} />

          {/* Main 2-Column Section: Performance Trend + Top Forms */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <TrendChart series={data.series} granularity={data.granularity} />
            </div>
            <div className="min-w-0">
              <TopFormsCard forms={data.forms} />
            </div>
          </div>

          {/* Quick-Launch Shortcuts & Best Practice Tip */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Console Shortcuts</h2>
              <Button asChild variant="link" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                <Link href="/forms">View all forms</Link>
              </Button>
            </div>
            <DashboardQuickActions />
            <DashboardOptimizationTip />
          </div>
        </div>
      )}
    </div>
  );
}
