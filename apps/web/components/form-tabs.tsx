"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EyeIcon,
  LinkIcon,
  ListChecksIcon,
  Settings2Icon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useConsoleStore } from "~/stores/console-store";

/*
 * The four things you do *to* a form.
 *
 * Responses and analytics used to be here too, and left. Reading what came in is not an
 * operation on the form — it is something you do across all of them — so they are sections in
 * the sidebar with a form picker, at `/responses` and `/analytics`. The builder keeps a link
 * to both, so the one-step path from "I have just published" to "has anyone filled it in"
 * survives.
 */
const TABS = [
  { segment: "build", label: "Build", icon: ListChecksIcon },
  { segment: "settings", label: "Settings", icon: Settings2Icon },
  { segment: "share", label: "Share", icon: LinkIcon },
  { segment: "preview", label: "Preview", icon: EyeIcon },
] as const;

/**
 * Tab navigation for one form. Mounted by every `/forms/[formId]/*` page, so a
 * new tab is one entry here plus one page.
 *
 * `onBeforeNavigate` exists for the builder, where leaving the tab unmounts the store's
 * autosave. The autosave is debounced, and a request started while the page is unloading
 * is aborted by the browser, so a creator who typed a question and went straight to Share
 * used to lose it. Awaiting the write first is the difference between a tab and a trap.
 */
export function FormTabs({
  formId,
  onBeforeNavigate,
}: {
  formId: string;
  onBeforeNavigate?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);
  const base = `/forms/${formId}`;

  const rememberSection = useConsoleStore((state) => state.rememberSection);
  const activeSegment = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split("/")[0]
    : null;

  /*
   * Record the open section so `/forms` can link back here instead of always to Build.
   *
   * Every `/forms/[formId]/*` page mounts this, so one effect covers all four. `preview` is
   * filtered out inside `rememberSection` — it is read-only, and remembering it would drop
   * someone who glanced at their form into a view they cannot type in.
   */
  useEffect(() => {
    if (activeSegment) rememberSection(formId, activeSegment);
  }, [formId, activeSegment, rememberSection]);

  return (
    <nav
      aria-label="Form sections"
      className="flex gap-1 overflow-x-auto border-b px-6"
    >
      {TABS.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-busy={leaving === tab.segment || undefined}
            onClick={(event) => {
              if (!onBeforeNavigate) return;
              // Leave modified clicks alone, so open-in-new-tab and middle-click still
              // work the way a link is supposed to.
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }

              event.preventDefault();
              setLeaving(tab.segment);
              void onBeforeNavigate().finally(() => {
                router.push(href);
                setLeaving(null);
              });
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
