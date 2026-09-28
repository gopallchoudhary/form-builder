import type { CSSProperties } from "react";
import type { FormTheme } from "@repo/services/utils/theme";

/**
 * The shared chrome for a rendered form.
 *
 * Every colour the renderer uses comes from the `--form-*` custom properties, set here
 * from the form's theme. That is what lets the same component tree render a sage form on
 * the public URL and a peach one inside the builder's preview, with no theming code in the
 * components themselves.
 */
export function FormThemeProvider({
  theme,
  children,
  className,
}: {
  theme: FormTheme;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-form-theme={theme.key}
      style={theme.tokens as CSSProperties}
      className={[
        "min-h-full w-full",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
