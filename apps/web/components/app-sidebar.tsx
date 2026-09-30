"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartBar,
  IconForms,
  IconInbox,
  IconLayoutDashboard,
  IconLogout,
  type Icon,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { useSignOut, useUser } from "~/hooks/api/auth";
import { isNavItemActive } from "~/lib/nav";
import { navHref } from "~/lib/builder-href";
import { useConsoleStore } from "~/stores/console-store";

/**
 * The creator console's navigation.
 *
 * Only real destinations. The template this replaced carried three sections of links
 * pointing at `#` — "Active Proposals", "Archived", "Get Help" — which is worse than no
 * navigation: it advertises features that do not exist and teaches people that dead links
 * are normal here.
 *
 * Four sections, in the order they are actually worked in. Responses and Analytics take a
 * form in `?form=`, so these two links land on a real page whether or not a form was chosen
 * — which is also why they can sit beside Dashboard rather than inside a form's tabs.
 */

interface NavItem {
  title: string;
  url: string;
  icon: Icon;
}

const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Forms", url: "/forms", icon: IconForms },
  { title: "Responses", url: "/responses", icon: IconInbox },
  { title: "Analytics", url: "/analytics", icon: IconChartBar },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user, status } = useUser();
  const { signOutUser } = useSignOut();

  const displayName = user?.fullName?.trim() || user?.email || "You";
  const initials = initialsOf(displayName);

  /*
   * The builder to resume, for the Forms link. Two narrow reads rather than the whole map,
   * so switching sections in some *other* form does not re-render the sidebar.
   */
  const builderFormId = useConsoleStore((state) => state.lastBuilderFormId);
  const builderSection = useConsoleStore((state) =>
    builderFormId ? state.lastSectionByForm[builderFormId] : undefined,
  );
  /*
   * Whether Forms should resume the builder at all. A stated decision rather than an inference:
   * the back button clears this, and without it a creator who left a builder was pulled back
   * into it by the next click on Forms.
   */
  const resumeBuilder = useConsoleStore((state) => state.resumeBuilder);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/dashboard">
                <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-pill text-[10px] font-bold">
                  S
                </span>
                <span className="text-base font-semibold">Streamyst</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {NAV_MAIN.map((item) => {
            const isActive = isNavItemActive(
              pathname,
              NAV_MAIN.map((entry) => entry.url),
              item.url,
            );
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link
                    href={navHref(
                      item.url,
                      pathname,
                      { formId: builderFormId, section: builderSection },
                      resumeBuilder,
                    )}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="size-8 rounded-pill">
            <AvatarFallback className="rounded-pill text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {status === "loading" ? "…" : displayName}
            </p>
            {user?.email && <p className="text-muted-foreground truncate text-xs">{user.email}</p>}
          </div>
        </div>

        {/*
          A `SidebarMenuButton` rather than a plain button, so it collapses the same way the
          navigation above it does: icon only, and a tooltip carrying the label that the
          collapsed width has no room for. Without the tooltip the text would just be gone,
          which leaves an unlabelled icon in the footer.
        */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="text-muted-foreground"
              onClick={() => signOutUser()}
            >
              <IconLogout />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/** Two letters, from whatever the person gave us — a name, or the front of an email. */
function initialsOf(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}
