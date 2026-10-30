import { ArrowUpRightIcon, ChartNoAxesColumnIncreasingIcon, CircleHelpIcon, LayoutDashboardIcon } from "lucide-react";

import { cn } from "~/lib/utils";

import styles from "./landing-motion.module.css";

const ACTIVITY = [34, 49, 42, 63, 52, 76, 68, 88, 73, 96, 82, 100];

/**
 * A responsive, code-built dashboard preview for the marketing page.
 *
 * This is deliberately marked as sample data and rendered from UI primitives instead of
 * embedded as a screenshot: it stays crisp at every viewport and can never accidentally
 * expose a real creator's forms or responses. The little live-poll card crossing the
 * dashboard frame is the page's one visual risk — forms and polls, together, in one glance.
 */
export function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[690px] pb-7 sm:pb-9">
      <div
        aria-label="Illustrative Formora dashboard showing sample response and poll data"
        className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-2xl shadow-foreground/10"
      >
        {/* A quiet browser frame, not a decorative fake browser toolbar. */}
        <div className="flex h-11 items-center justify-between border-b border-border/70 bg-background/80 px-4">
          <div aria-hidden className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </div>
          <div className="text-muted-foreground hidden rounded-md bg-muted px-3 py-1 text-[10px] font-medium sm:block">
            app.formora.com/dashboard
          </div>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-1 text-[9px] font-bold tracking-wide">
            SAMPLE
          </span>
        </div>

        <div className="grid min-h-[300px] grid-cols-[54px_1fr] sm:grid-cols-[132px_1fr]">
          <aside aria-hidden className="border-r border-border/70 bg-background/70 p-2 sm:p-3">
            <div className="mb-5 flex items-center justify-center gap-2 sm:justify-start">
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black">
                F
              </span>
              <span className="hidden text-xs font-bold sm:inline">Formora</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="bg-secondary text-secondary-foreground flex items-center justify-center gap-2 rounded-lg px-2 py-2 sm:justify-start">
                <LayoutDashboardIcon className="size-3.5 shrink-0" />
                <span className="hidden text-[10px] font-semibold sm:inline">Overview</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-center gap-2 px-2 py-2 sm:justify-start">
                <ChartNoAxesColumnIncreasingIcon className="size-3.5 shrink-0" />
                <span className="hidden text-[10px] font-medium sm:inline">Forms & polls</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-center gap-2 px-2 py-2 sm:justify-start">
                <CircleHelpIcon className="size-3.5 shrink-0" />
                <span className="hidden text-[10px] font-medium sm:inline">Responses</span>
              </div>
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase sm:text-[10px]">
                  Your workspace
                </p>
                <p className="mt-1 text-sm font-bold tracking-tight sm:text-base">Good morning, Maya</p>
              </div>
              <div className="hidden rounded-lg border border-border px-2.5 py-1.5 text-[9px] font-semibold text-muted-foreground sm:block">
                Last 30 days
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <PreviewMetric label="Responses" value="1,284" change="+18%" />
              <PreviewMetric label="Forms" value="08" change="Active" />
              <PreviewMetric label="Polls" value="02" change="Live now" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl bg-muted/70 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold sm:text-xs">Response activity</p>
                    <p className="text-muted-foreground mt-0.5 text-[9px] sm:text-[10px]">
                      Across your forms
                    </p>
                  </div>
                  <span className="text-positive text-[9px] font-bold sm:text-[10px]">+18%</span>
                </div>
                <div
                  role="img"
                  aria-label="Sample response activity trending upward over twelve weeks"
                  className="mt-4 flex h-[84px] items-end gap-1 sm:h-[104px] sm:gap-1.5"
                >
                  {ACTIVITY.map((height, index) => (
                    <span
                      key={index}
                      className={cn(
                        styles.bar,
                        "min-w-0 flex-1 rounded-t-sm",
                        index === ACTIVITY.length - 1 ? "bg-primary" : "bg-chart-2/60",
                      )}
                      style={{
                        height: `${height}%`,
                        animationDelay: `${240 + index * 20}ms`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-muted-foreground mt-1 flex justify-between text-[8px] sm:text-[9px]">
                  <span>Mar 1</span>
                  <span>Mar 30</span>
                </div>
              </div>

              <div className="rounded-xl bg-card p-3 ring-1 ring-border/70 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold sm:text-xs">Top form</p>
                  <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />
                </div>
                <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-snug sm:text-xs">
                  What should we build next?
                </p>
                <p className="text-muted-foreground mt-1 text-[9px] sm:text-[10px]">
                  Product feedback
                </p>
                <div className="mt-3 flex items-end gap-1.5">
                  <span className="text-lg font-black tracking-tight sm:text-xl">248</span>
                  <span className="text-muted-foreground pb-0.5 text-[9px]">responses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
       * The signature overlap: a real-time poll living beside the form dashboard. It is
       * sample data, but the composition makes the product's two halves visible at once.
       */}
      <div className="relative mx-3 -mt-2 rounded-2xl border border-border/70 bg-card p-4 shadow-xl shadow-foreground/10 sm:absolute sm:right-0 sm:-bottom-1 sm:mx-0 sm:mt-0 sm:w-[265px] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Sample live poll
          </span>
          <span className="bg-positive-subtle text-positive-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold">
            <span className="bg-positive size-1.5 rounded-full motion-safe:animate-pulse" />
            LIVE
          </span>
        </div>
        <p className="mt-2 text-xs font-bold sm:text-sm">Where should we meet?</p>
        <div className="mt-3 flex flex-col gap-2">
          <PreviewPollOption label="Ramen House" count="67%" width="67%" active />
          <PreviewPollOption label="Garden Café" count="33%" width="33%" />
        </div>
        <p className="text-muted-foreground mt-3 text-[9px]">42 sample votes · results update live</p>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-card p-2.5 ring-1 ring-border/70 sm:p-3">
      <p className="text-muted-foreground truncate text-[8px] font-semibold sm:text-[10px]">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-1 gap-y-0.5">
        <span className="text-sm font-black tracking-tight sm:text-lg">{value}</span>
        <span className="text-[8px] font-bold text-positive sm:text-[9px]">{change}</span>
      </div>
    </div>
  );
}

function PreviewPollOption({
  label,
  count,
  width,
  active = false,
}: {
  label: string;
  count: string;
  width: string;
  active?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px]">
        <span className="truncate font-semibold">{label}</span>
        <span className="shrink-0 font-bold tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={active ? "bg-primary h-full rounded-full" : "bg-chart-2 h-full rounded-full"}
          style={{ width }}
        />
      </div>
    </div>
  );
}
