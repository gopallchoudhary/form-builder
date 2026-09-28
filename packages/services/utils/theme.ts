import { z } from "zod";

/**
 * The curated form themes. Every value is taken from `DESIGN.md`, which is the source
 * of truth for the visual language.
 *
 * These are deliberately fixed rather than free-form. `DESIGN.md` reserves lime
 * (`#9fe870`) as the single CTA accent and forbids a green CTA on a green surface,
 * so `pale` switches its action colour to ink instead of introducing a second accent.
 * Adding a theme is a code change on purpose — that is what keeps it on-brand.
 */
export const formThemeKeySchema = z.enum(["sage", "ink", "pale", "peach"]);

export type FormThemeKey = z.infer<typeof formThemeKeySchema>;

/**
 * The CSS custom properties a theme sets. Semantic names rather than raw palette
 * slots, so swapping a theme never has to know which token backs which surface.
 */
export interface FormThemeTokens {
  /** Page background behind the form. */
  "--form-bg": string;
  /**
   * Text drawn directly on the page background, outside a card — the form title and
   * any progress furniture. Separate from `--form-text` because a dark page needs a
   * light heading, while the white card on that same page still needs dark text.
   */
  "--form-heading": string;
  /** Card and input surface. */
  "--form-surface": string;
  /** Border and hairline dividers. */
  "--form-border": string;
  /** Text on the card surface. */
  "--form-text": string;
  /** Secondary text. */
  "--form-muted": string;
  /** The single action colour: buttons, focus rings, the progress rail. */
  "--form-accent": string;
  /** Text drawn on top of the accent. */
  "--form-accent-fg": string;
}

export interface FormTheme {
  key: FormThemeKey;
  /** Shown in the builder's theme picker. */
  label: string;
  /** One line on what this theme is for, in the product's own voice. */
  description: string;
  tokens: FormThemeTokens;
}

/** Palette values referenced below, named so their DESIGN.md provenance is obvious. */
const CANVAS = "#ffffff";
const CANVAS_SOFT = "#e8ebe6"; // sage-tinted page background
const INK = "#0e0f0c"; // near-black, the default text colour
const MUTE = "#868685";
const LIME = "#9fe870"; // the one accent
const INK_DEEP = "#163300"; // lime darkened, used as a hairline on a pale page
const PRIMARY_PALE = "#e2f6d5";
const ACCENT_ORANGE = "#ffc091";

export const FORM_THEMES = {
  sage: {
    key: "sage",
    label: "Sage",
    description: "Soft green page, white cards, lime action. The house style.",
    tokens: {
      "--form-bg": CANVAS_SOFT,
      "--form-heading": INK,
      "--form-surface": CANVAS,
      "--form-border": MUTE,
      "--form-text": INK,
      "--form-muted": MUTE,
      "--form-accent": LIME,
      "--form-accent-fg": INK,
    },
  },

  ink: {
    key: "ink",
    label: "Ink",
    description: "Near-black page, white cards, lime headline. Reads like a poster.",
    tokens: {
      "--form-bg": INK,
      // Lime headline on near-black, per the DESIGN.md dark hero band.
      "--form-heading": LIME,
      "--form-surface": CANVAS,
      // A dark hairline would vanish on a dark page, so the muted grey carries it.
      "--form-border": MUTE,
      "--form-text": INK,
      "--form-muted": MUTE,
      "--form-accent": LIME,
      "--form-accent-fg": INK,
    },
  },

  pale: {
    key: "pale",
    label: "Pale",
    description: "Pale green page, white cards, ink action. Quiet and high-contrast.",
    tokens: {
      "--form-bg": PRIMARY_PALE,
      "--form-heading": INK,
      "--form-surface": CANVAS,
      "--form-border": INK_DEEP,
      "--form-text": INK,
      "--form-muted": MUTE,
      // A lime button on a pale green page would put the action colour on a page of
      // the same hue, which DESIGN.md forbids — so the action is ink.
      "--form-accent": INK,
      "--form-accent-fg": CANVAS,
    },
  },

  peach: {
    key: "peach",
    label: "Peach",
    description: "Warm peach page with white cards. Lime action stays on brand.",
    tokens: {
      "--form-bg": ACCENT_ORANGE,
      "--form-heading": INK,
      "--form-surface": CANVAS,
      "--form-border": INK,
      "--form-text": INK,
      "--form-muted": MUTE,
      "--form-accent": LIME,
      "--form-accent-fg": INK,
    },
  },
} as const satisfies Record<FormThemeKey, FormTheme>;

export const DEFAULT_FORM_THEME: FormThemeKey = "sage";

/** Every token name a theme must define. */
export const FORM_THEME_TOKENS = [
  "--form-bg",
  "--form-heading",
  "--form-surface",
  "--form-border",
  "--form-text",
  "--form-muted",
  "--form-accent",
  "--form-accent-fg",
] as const;

export function getFormTheme(key: string | null | undefined): FormTheme {
  const parsed = formThemeKeySchema.safeParse(key);
  return FORM_THEMES[parsed.success ? parsed.data : DEFAULT_FORM_THEME];
}

/** The CSS text a renderer injects to apply a theme without a stylesheet build. */
export function themeToCssVariables(theme: FormTheme): string {
  return Object.entries(theme.tokens)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}

export const FORM_THEME_KEYS = formThemeKeySchema.options;
