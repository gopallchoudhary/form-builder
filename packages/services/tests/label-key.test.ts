import { describe, expect, it } from "vitest";

import { toLabelKey } from "../form-field/label-key";

describe("toLabelKey", () => {
  it("lowercases and hyphenates", () => {
    expect(toLabelKey("Full Name")).toBe("full-name");
  });

  it("strips punctuation and symbols", () => {
    expect(toLabelKey("What's your email?")).toBe("whats-your-email");
    expect(toLabelKey("Phone # (mobile)")).toBe("phone-mobile");
  });

  it("collapses whitespace and hyphen runs", () => {
    expect(toLabelKey("Mobile   No.")).toBe("mobile-no");
    expect(toLabelKey("Address - line 1")).toBe("address-line-1");
  });

  it("trims leading and trailing hyphens", () => {
    expect(toLabelKey("  *Required*  ")).toBe("required");
  });

  it("respects the 50 character column limit", () => {
    expect(toLabelKey("a".repeat(80))).toHaveLength(50);
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(toLabelKey("!!!")).toBe("");
    expect(toLabelKey("   ")).toBe("");
  });

  it("is deterministic, which is what makes labelKey write-once safe", () => {
    expect(toLabelKey("Date Of Birth")).toBe(toLabelKey("date of birth"));
  });
});
