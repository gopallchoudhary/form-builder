import { describe, expect, it } from "vitest";

import {
  SettingsError,
  defaultSettingsFor,
  parseSettingsFor,
  questionConfigSchema,
} from "../question/settings";
import type { QuestionKind } from "../question/model";

const ALL_KINDS: QuestionKind[] = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "PASSWORD",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DROPDOWN",
  "RATING",
  "DATE",
  "ADDRESS",
];

const choiceOptions = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

/** Kinds whose settings cannot be empty: a question with these missing is unusable. */
const KINDS_REQUIRING_SETTINGS = new Set<QuestionKind>([
  "RATING",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DROPDOWN",
]);

describe("parseSettingsFor", () => {
  it("accepts an empty object for every kind that does not require configuration", () => {
    for (const kind of ALL_KINDS) {
      if (KINDS_REQUIRING_SETTINGS.has(kind)) continue;
      expect(() => parseSettingsFor(kind, {}), kind).not.toThrow();
    }
  });

  it("rejects an empty object where the settings carry the question's meaning", () => {
    // A rating without a scale, or a choice without options, cannot be rendered or
    // answered — so these must fail rather than be stored as `{}`.
    for (const kind of KINDS_REQUIRING_SETTINGS) {
      expect(() => parseSettingsFor(kind, {}), kind).toThrow(SettingsError);
    }
  });

  it("treats undefined and null as an empty object", () => {
    expect(parseSettingsFor("SHORT_TEXT", undefined)).toEqual({});
    expect(parseSettingsFor("SHORT_TEXT", null)).toEqual({});
  });

  describe("text", () => {
    it("accepts length bounds and a pattern", () => {
      const settings = parseSettingsFor("SHORT_TEXT", {
        minLength: 2,
        maxLength: 40,
        pattern: "[a-z]+",
      });

      expect(settings).toEqual({ minLength: 2, maxLength: 40, pattern: "[a-z]+" });
    });

    it("rejects minLength greater than maxLength", () => {
      expect(() => parseSettingsFor("SHORT_TEXT", { minLength: 10, maxLength: 2 })).toThrow(
        SettingsError,
      );
    });

    it("rejects an invalid regular expression", () => {
      expect(() => parseSettingsFor("SHORT_TEXT", { pattern: "([unclosed" })).toThrow(
        SettingsError,
      );
    });

    it("rejects unknown keys, so a typo cannot be silently stored", () => {
      expect(() => parseSettingsFor("SHORT_TEXT", { minLenght: 3 })).toThrow(SettingsError);
    });
  });

  describe("number", () => {
    it("accepts bounds and an integer flag", () => {
      expect(parseSettingsFor("NUMBER", { min: 1, max: 10, integer: true })).toEqual({
        min: 1,
        max: 10,
        integer: true,
      });
    });

    it("rejects min greater than max", () => {
      expect(() => parseSettingsFor("NUMBER", { min: 10, max: 1 })).toThrow(SettingsError);
    });
  });

  describe("email", () => {
    it("accepts an allow list of domains", () => {
      expect(parseSettingsFor("EMAIL", { allowedDomains: ["example.com"] })).toEqual({
        allowedDomains: ["example.com"],
      });
    });

    it("rejects something that is not a domain name", () => {
      expect(() => parseSettingsFor("EMAIL", { allowedDomains: ["example"] })).toThrow(
        SettingsError,
      );
      expect(() => parseSettingsFor("EMAIL", { allowedDomains: ["g@example.com"] })).toThrow(
        SettingsError,
      );
    });
  });

  describe("choice", () => {
    it("accepts options", () => {
      expect(parseSettingsFor("SINGLE_CHOICE", { options: choiceOptions })).toEqual({
        options: choiceOptions,
      });
    });

    it("needs at least two options, or the question cannot be answered", () => {
      expect(() => parseSettingsFor("SINGLE_CHOICE", { options: [choiceOptions[0]!] })).toThrow(
        SettingsError,
      );
      expect(() => parseSettingsFor("SINGLE_CHOICE", { options: [] })).toThrow(SettingsError);
    });

    it("rejects duplicate option ids", () => {
      expect(() =>
        parseSettingsFor("SINGLE_CHOICE", {
          options: [
            { id: "yes", label: "Yes" },
            { id: "yes", label: "Also yes" },
          ],
        }),
      ).toThrow(SettingsError);
    });

    it("rejects an option id with unsafe characters", () => {
      expect(() =>
        parseSettingsFor("SINGLE_CHOICE", {
          options: [
            { id: "a b", label: "A" },
            { id: "c", label: "C" },
          ],
        }),
      ).toThrow(SettingsError);
    });

    it("rejects minSelected greater than maxSelected", () => {
      expect(() =>
        parseSettingsFor("MULTI_CHOICE", { options: choiceOptions, minSelected: 3, maxSelected: 1 }),
      ).toThrow(SettingsError);
    });

    it("rejects maxSelected above the number of options", () => {
      expect(() =>
        parseSettingsFor("MULTI_CHOICE", { options: choiceOptions, maxSelected: 5 }),
      ).toThrow(SettingsError);
    });
  });

  describe("rating", () => {
    it("requires a scale", () => {
      expect(() => parseSettingsFor("RATING", {})).toThrow(SettingsError);
    });

    it.each([3, 5, 7, 10])("accepts a scale of %i", (scale) => {
      expect(parseSettingsFor("RATING", { scale })).toMatchObject({ scale });
    });

    it("rejects a scale that is not a supported size", () => {
      expect(() => parseSettingsFor("RATING", { scale: 4 })).toThrow(SettingsError);
    });

    it("defaults the style to STAR", () => {
      expect(parseSettingsFor("RATING", { scale: 5 })).toEqual({ scale: 5, style: "STAR" });
    });
  });

  describe("date", () => {
    it("accepts ISO bounds", () => {
      expect(parseSettingsFor("DATE", { min: "2000-01-01", max: "2030-01-01" })).toEqual({
        min: "2000-01-01",
        max: "2030-01-01",
      });
    });

    it("rejects a non-ISO bound", () => {
      expect(() => parseSettingsFor("DATE", { min: "01/01/2000" })).toThrow(SettingsError);
    });

    it("rejects min after max", () => {
      expect(() => parseSettingsFor("DATE", { min: "2030-01-01", max: "2000-01-01" })).toThrow(
        SettingsError,
      );
    });
  });

  describe("address", () => {
    it("accepts a subset of fields", () => {
      expect(parseSettingsFor("ADDRESS", { fields: ["line1", "city", "country"] })).toEqual({
        fields: ["line1", "city", "country"],
      });
    });

    it("rejects an unknown field name", () => {
      expect(() => parseSettingsFor("ADDRESS", { fields: ["street"] })).toThrow(SettingsError);
    });

    it("rejects an empty field list", () => {
      expect(() => parseSettingsFor("ADDRESS", { fields: [] })).toThrow(SettingsError);
    });
  });
});

describe("questionConfigSchema", () => {
  it("narrows the settings when the kind is known", () => {
    const parsed = questionConfigSchema.parse({
      kind: "RATING",
      settings: { scale: 7, style: "NUMBER" },
    });

    expect(parsed.kind).toBe("RATING");
    if (parsed.kind === "RATING") {
      expect(parsed.settings.scale).toBe(7);
    }
  });

  it("rejects a kind paired with the wrong settings shape", () => {
    expect(() =>
      questionConfigSchema.parse({ kind: "YES_NO", settings: { options: choiceOptions } }),
    ).toThrow();
  });
});

describe("defaultSettingsFor", () => {
  it("returns valid settings for every kind", () => {
    for (const kind of ALL_KINDS) {
      expect(() => parseSettingsFor(kind, defaultSettingsFor(kind)), `${kind}`).not.toThrow();
    }
  });

  it("gives choice questions two placeholder options so they are answerable", () => {
    const settings = defaultSettingsFor("SINGLE_CHOICE") as { options: unknown[] };
    expect(settings.options).toHaveLength(2);
  });

  it("gives rating a usable default", () => {
    expect(defaultSettingsFor("RATING")).toEqual({ scale: 5, style: "STAR" });
  });
});
