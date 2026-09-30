/**
 * Which theme a click on the sidebar toggle leads to.
 *
 * A module of its own, with no React in it, because this repo's Vitest runs in a node
 * environment with no Testing Library — and because the interesting part is not the component
 * but the decision it makes. Keeping `nextThemeFor` here means the behaviour is testable and
 * the toggle file is left with only rendering in it.
 */
export const nextThemeFor = (resolvedTheme: string | undefined): "light" | "dark" =>
  resolvedTheme === "dark" ? "light" : "dark";