import { describe, expect, it } from "vitest";

import { generateSlug, slugify } from "../utils/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Customer Feedback")).toBe("customer-feedback");
  });

  it("strips punctuation and accents", () => {
    expect(slugify("What's your email?")).toBe("whats-your-email");
    expect(slugify("Café Feedback")).toBe("cafe-feedback");
  });

  it("collapses whitespace and hyphen runs", () => {
    expect(slugify("a   b")).toBe("a-b");
    expect(slugify("a---b")).toBe("a-b");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("generateSlug", () => {
  it("appends a random suffix so two forms with the same title differ", () => {
    const a = generateSlug("Customer Feedback");
    const b = generateSlug("Customer Feedback");

    expect(a).not.toBe(b);
    expect(a.startsWith("customer-feedback-")).toBe(true);
  });

  it("stays within the 64 character column limit", () => {
    for (const title of ["a".repeat(200), "Customer feedback survey for new users", "🎉🎉🎉"]) {
      expect(generateSlug(title).length).toBeLessThanOrEqual(64);
    }
  });

  it("falls back to a random slug when the title has no usable characters", () => {
    const slug = generateSlug("🎉🎉🎉");

    expect(slug).toMatch(/^form-[a-z0-9]{6}$/);
  });

  it("only produces characters that are safe in a URL path", () => {
    const slug = generateSlug("Café / Réservation? 50% off");

    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("never leaves a trailing hyphen before the suffix", () => {
    expect(generateSlug("a".repeat(57))).toMatch(/^[a-z0-9]+-[a-z0-9]{6}$/);
  });
});
