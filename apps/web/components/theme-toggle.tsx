"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { nextThemeFor } from "~/lib/theme";

/*
 * Keyed on `resolvedTheme` rather than `theme`, which `nextThemeFor` takes deliberately:
 * `theme` holds whatever the creator chose and may be `"system"`, a value with no opposite,
 * so flipping off it either does nothing or lands on a pairing nobody asked for.
 * `resolvedTheme` is always the theme actually in effect — the only thing a toggle can
 * reason about — and anything unrecognised resolves to dark, because the app's default is
 * dark and the button must always have somewhere to go.
 */

/**
 * Light/dark toggle, sitting above sign-out in the sidebar footer.
 *
 * The icon shows where a click *goes* rather than where you are: a moon in light mode, a sun
 * in dark. The alternative — showing the current theme — means reading the tooltip to know
 * what the button does, which is a poor trade for a control that only ever has two outcomes.
 *
 * A `SidebarMenuButton` with a tooltip, for the reason the sign-out button is one: the
 * collapsed sidebar is a 32px rail with no room for a word, and without the tooltip the label
 * is simply gone, leaving an unlabelled icon next to the one above it.
 *
 * Renders nothing until mounted. The server cannot know the theme, so whichever icon it
 * guessed would mismatch on hydration — and React is right to complain, because the icon is
 * genuinely different content depending on a value only the client has.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const target = nextThemeFor(resolvedTheme);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={target === "dark" ? "Dark mode" : "Light mode"}
          className="text-muted-foreground"
          onClick={() => setTheme(target)}
        >
          {target === "dark" ? <IconMoon /> : <IconSun />}
          <span>{target === "dark" ? "Dark mode" : "Light mode"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}