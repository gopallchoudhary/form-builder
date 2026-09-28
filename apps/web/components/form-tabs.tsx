"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  EyeIcon,
  InboxIcon,
  LinkIcon,
  ListChecksIcon,
  Settings2Icon,
} from "lucide-react";

import { cn } from "~/lib/utils";

const TABS = [
  { segment: "build", label: "Build", icon: ListChecksIcon },
  { segment: "settings", label: "Settings", icon: Settings2Icon },
  { segment: "share", label: "Share", icon: LinkIcon },
  { segment: "preview", label: "Preview", icon: EyeIcon },
  { segment: "responses", label: "Responses", icon: InboxIcon },
  { segment: "analytics", label: "Analytics", icon: BarChart3Icon },
] as const;

/**
 * Tab navigation for one form. Mounted by every `/dashboard/forms/[formId]/*` page, so a
 * new tab is one entry here plus one page.
 */
export function FormTabs({ formId }: { formId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/forms/${formId}`;

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
