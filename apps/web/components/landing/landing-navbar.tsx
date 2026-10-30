"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, MenuIcon, XIcon } from "lucide-react";

import { ProductMark } from "~/components/product-mark";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

/**
 * Public-site navigation. The mobile menu is a real button with an explicit expanded state,
 * not a hover-only popover: keyboard and touch users can open it, follow a link, and it closes.
 */
export function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <ProductMark className="self-auto shrink-0 text-base sm:text-lg" />

        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="h-10 rounded-xl px-4 sm:h-12 sm:px-5">
            <Link href="/signup">
              Create account
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {menuOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-menu"
        hidden={!menuOpen}
        className={cn(
          "border-t border-border/60 bg-card px-4 py-4 md:hidden",
          menuOpen && "animate-in fade-in slide-in-from-top-1 duration-150",
        )}
      >
        <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col gap-1">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={closeMenu}
            className="rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          >
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}
