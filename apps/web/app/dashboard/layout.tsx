import { AppSidebar } from "~/components/app-sidebar";
import { SiteHeader } from "~/components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "~/components/ui/sidebar";
import { requireUser } from "~/lib/auth";

/**
 * The one guard for the whole dashboard.
 *
 * It lives here rather than in each page because the layout wraps every dashboard route,
 * so a new page cannot ship unguarded. `requireUser` redirects server-side, so a
 * signed-out visitor never sees protected content flash before the client navigates away.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
