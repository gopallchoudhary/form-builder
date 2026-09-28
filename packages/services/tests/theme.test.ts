import { describe, expect, it } from "vitest";

import {
  DEFAULT_FORM_THEME,
  FORM_THEMES,
  FORM_THEME_KEYS,
  FORM_THEME_TOKENS,
  getFormTheme,
  themeToCssVariables,
} from "../utils/theme";

describe("form themes", () => {
  it("offers exactly the four curated presets", () => {
    expect(FORM_THEME_KEYS).toEqual(["sage", "ink", "pale", "peach"]);
  });

  it("defines every token in every theme", () => {
    for (const theme of Object.values(FORM_THEMES)) {
      for (const token of FORM_THEME_TOKENS) {
        expect(theme.tokens[token], `${theme.key} is missing ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("introduces no second brand accent", () => {
    // DESIGN.md reserves lime as the single accent. Any other action colour has to be
    // ink, which is a neutral, not a second hue.
    const allowed = new Set(["#9fe870", "#0e0f0c"]);

    for (const theme of Object.values(FORM_THEMES)) {
      expect(allowed, `${theme.key} uses an unexpected accent`).toContain(
        theme.tokens["--form-accent"],
      );
    }
  });

  it("never puts the action colour on a page of the same hue", () => {
    // The pale theme is the one that has to think about this.
    const pale = FORM_THEMES.pale;
    expect(pale.tokens["--form-bg"]).toBe("#e2f6d5");
    expect(pale.tokens["--form-accent"]).not.toBe(pale.tokens["--form-bg"]);
    expect(pale.tokens["--form-accent"]).toBe("#0e0f0c");
  });

  it("keeps heading text legible on its own page background", () => {
    const luminance = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      const r = (value >> 16) & 0xff;
      const g = (value >> 8) & 0xff;
      const b = value & 0xff;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };

    for (const theme of Object.values(FORM_THEMES)) {
      const page = luminance(theme.tokens["--form-bg"]);
      const heading = luminance(theme.tokens["--form-heading"]);

      // A light page takes dark text and a dark page takes light text.
      expect(
        Math.abs(page - heading) > 0.3,
        `${theme.key}: heading #${theme.tokens["--form-heading"]} on page #${theme.tokens["--form-bg"]} has too little contrast`,
      ).toBe(true);
    }
  });

  it("keeps a visible border against both the page and the card", () => {
    const luminance = (hex: string) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return ((value >> 16) & 0xff) / 255;
    };

    for (const theme of Object.values(FORM_THEMES)) {
      const border = luminance(theme.tokens["--form-border"]);
      for (const surface of ["--form-bg", "--form-surface"] as const) {
        expect(
          Math.abs(border - luminance(theme.tokens[surface])) > 0.05,
          `${theme.key}: border is invisible on ${surface}`,
        ).toBe(true);
      }
    }
  });

  it("falls back to sage for an unknown or missing key", () => {
    const sage = FORM_THEMES[DEFAULT_FORM_THEME];

    expect(getFormTheme("nope").key).toBe("sage");
    expect(getFormTheme(null).key).toBe("sage");
    expect(getFormTheme(undefined)).toBe(sage);
  });

  it("returns the requested theme for a valid key", () => {
    expect(getFormTheme("peach")).toBe(FORM_THEMES.peach);
  });

  it("serialises to CSS custom properties", () => {
    const css = themeToCssVariables(FORM_THEMES.sage);

    expect(css).toContain("--form-bg: #e8ebe6;");
    expect(css).toContain("--form-accent: #9fe870;");
    expect(css.split(";").filter(Boolean)).toHaveLength(FORM_THEME_TOKENS.length);
  });

  it("has a label and a description for the picker", () => {
    for (const theme of Object.values(FORM_THEMES)) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(10);
      expect(theme.key).toBeTruthy();
    }
  });
});
