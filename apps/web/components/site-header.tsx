import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

/**
 * The console's top bar: the sidebar toggle and nothing else.
 *
 * It used to say "Documents" — a heading for a section this product does not have — and
 * carry a link to the shadcn repository. A header that lies about where you are is worse
 * than no header, so the page's own heading is the only title.
 */
export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
      </div>
    </header>
  )
}
