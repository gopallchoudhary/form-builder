import { describe, expect, it } from "vitest";

import { isEmptyAnswer, validateAnswer } from "../utils/answer-validation";

const options = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "maybe", label: "Maybe" },
];

describe("validateAnswer", () => {
  describe("text", () => {
    it("stores a trimmed value in valueText", () => {
      const result = validateAnswer("SHORT_TEXT", {}, "  Gopal  ");

      expect(result).toEqual({
        success: true,
        answer: {
          valueText: "Gopal",
          valueNumber: null,
          valueDate: null,
          valueJson: null,
        },
      });
    });

    it("enforces minLength and maxLength", () => {
      const settings = { minLength: 3, maxLength: 5 };

      expect(validateAnswer("SHORT_TEXT", settings, "ab").success).toBe(false);
      expect(validateAnswer("SHORT_TEXT", settings, "abcdef").success).toBe(false);
      expect(validateAnswer("SHORT_TEXT", settings, "abcd").success).toBe(true);
    });

    it("anchors the pattern, so a partial match cannot slip through", () => {
      const settings = { pattern: "[0-9]{5}" };

      expect(validateAnswer("SHORT_TEXT", settings, "12345").success).toBe(true);
      expect(validateAnswer("SHORT_TEXT", settings, "123456").success).toBe(false);
      expect(validateAnswer("SHORT_TEXT", settings, "abcde").success).toBe(false);
    });

    it("rejects a non-string", () => {
      expect(validateAnswer("SHORT_TEXT", {}, 42).success).toBe(false);
      expect(validateAnswer("LONG_TEXT", {}, null).success).toBe(false);
    });

    it("treats a password like any other text question", () => {
      const result = validateAnswer("PASSWORD", { minLength: 4 }, "hunter2");
      expect(result.success).toBe(true);
    });
  });

  describe("email", () => {
    it("accepts a valid address and trims it", () => {
      const result = validateAnswer("EMAIL", {}, " gopal@example.com ");

      expect(result.success).toBe(true);
      if (result.success) expect(result.answer.valueText).toBe("gopal@example.com");
    });

    it("rejects a malformed address", () => {
      expect(validateAnswer("EMAIL", {}, "not-an-email").success).toBe(false);
    });

    it("enforces an allow list of domains, case-insensitively", () => {
      const settings = { allowedDomains: ["example.com"] };

      expect(validateAnswer("EMAIL", settings, "g@example.com").success).toBe(true);
      expect(validateAnswer("EMAIL", settings, "g@EXAMPLE.COM").success).toBe(true);
      expect(validateAnswer("EMAIL", settings, "g@other.com").success).toBe(false);
    });

    it("requires an exact domain match, not a subdomain", () => {
      const settings = { allowedDomains: ["example.com"] };

      expect(validateAnswer("EMAIL", settings, "g@mail.example.com").success).toBe(false);
    });
  });

  describe("phone", () => {
    it("accepts common formats", () => {
      for (const value of ["+91 99999 99999", "(020) 7946-0958", "9999999999"]) {
        expect(validateAnswer("PHONE", {}, value).success, value).toBe(true);
      }
    });

    it("rejects letters and absurd lengths", () => {
      expect(validateAnswer("PHONE", {}, "call-me").success).toBe(false);
      expect(validateAnswer("PHONE", {}, "12345").success).toBe(false);
      expect(validateAnswer("PHONE", {}, "1".repeat(30)).success).toBe(false);
    });
  });

  describe("number", () => {
    it("coerces a numeric string, since form inputs send strings", () => {
      const result = validateAnswer("NUMBER", {}, "42");

      expect(result.success).toBe(true);
      if (result.success) expect(result.answer.valueNumber).toBe("42");
    });

    it("enforces min and max", () => {
      expect(validateAnswer("NUMBER", { min: 1, max: 10 }, 0).success).toBe(false);
      expect(validateAnswer("NUMBER", { min: 1, max: 10 }, 11).success).toBe(false);
      expect(validateAnswer("NUMBER", { min: 1, max: 10 }, 5).success).toBe(true);
    });

    it("enforces the integer flag", () => {
      expect(validateAnswer("NUMBER", { integer: true }, 1.5).success).toBe(false);
      expect(validateAnswer("NUMBER", { integer: true }, 2).success).toBe(true);
      expect(validateAnswer("NUMBER", {}, 1.5).success).toBe(true);
    });

    it("rejects non-numeric input", () => {
      expect(validateAnswer("NUMBER", {}, "abc").success).toBe(false);
    });
  });

  describe("rating", () => {
    it("accepts a value within the scale", () => {
      const result = validateAnswer("RATING", { scale: 5 }, 4);

      expect(result.success).toBe(true);
      if (result.success) expect(result.answer.valueNumber).toBe("4");
    });

    it("rejects 0 and values above the scale", () => {
      expect(validateAnswer("RATING", { scale: 5 }, 0).success).toBe(false);
      expect(validateAnswer("RATING", { scale: 5 }, 6).success).toBe(false);
    });

    it("rejects a fractional rating", () => {
      expect(validateAnswer("RATING", { scale: 5 }, 2.5).success).toBe(false);
    });
  });

  describe("date", () => {
    it("stores a YYYY-MM-DD string, never a Date, so no timezone shifts the day", () => {
      const result = validateAnswer("DATE", {}, "1990-05-17");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.answer.valueDate).toBe("1990-05-17");
        expect(result.answer.valueText).toBeNull();
      }
    });

    it("rejects a format that is not ISO", () => {
      expect(validateAnswer("DATE", {}, "17/05/1990").success).toBe(false);
      expect(validateAnswer("DATE", {}, "1990-5-7").success).toBe(false);
    });

    it("rejects a date that matches the pattern but does not exist", () => {
      expect(validateAnswer("DATE", {}, "2026-02-31").success).toBe(false);
    });

    it("enforces min and max inclusively", () => {
      const settings = { min: "2020-01-01", max: "2020-12-31" };

      expect(validateAnswer("DATE", settings, "2020-01-01").success).toBe(true);
      expect(validateAnswer("DATE", settings, "2020-12-31").success).toBe(true);
      expect(validateAnswer("DATE", settings, "2019-12-31").success).toBe(false);
      expect(validateAnswer("DATE", settings, "2021-01-01").success).toBe(false);
    });
  });

  describe("yes/no", () => {
    it("stores a boolean as text so a plain GROUP BY counts it", () => {
      const yes = validateAnswer("YES_NO", {}, true);
      const no = validateAnswer("YES_NO", {}, false);

      expect(yes.success && yes.answer.valueText).toBe("true");
      expect(no.success && no.answer.valueText).toBe("false");
    });

    it("rejects anything that is not a real boolean", () => {
      // A string "true" would silently become the string answer, not a yes.
      expect(validateAnswer("YES_NO", {}, "true").success).toBe(false);
      expect(validateAnswer("YES_NO", {}, 1).success).toBe(false);
    });
  });

  describe("single choice", () => {
    it("accepts a configured option id", () => {
      const result = validateAnswer("SINGLE_CHOICE", { options }, "maybe");

      expect(result.success).toBe(true);
      if (result.success) expect(result.answer.valueText).toBe("maybe");
    });

    it("rejects an option that is not configured", () => {
      expect(validateAnswer("SINGLE_CHOICE", { options }, "perhaps").success).toBe(false);
      expect(validateAnswer("SINGLE_CHOICE", { options }, "").success).toBe(false);
    });

    it("rejects an array, which is a multi-choice answer", () => {
      expect(validateAnswer("SINGLE_CHOICE", { options }, ["yes"]).success).toBe(false);
    });

    it("behaves the same for DROPDOWN", () => {
      expect(validateAnswer("DROPDOWN", { options }, "yes").success).toBe(true);
      expect(validateAnswer("DROPDOWN", { options }, "nope").success).toBe(false);
    });
  });

  describe("multi choice", () => {
    it("stores the selection as JSON", () => {
      const result = validateAnswer("MULTI_CHOICE", { options }, ["yes", "maybe"]);

      expect(result.success).toBe(true);
      if (result.success) expect(result.answer.valueJson).toEqual(["yes", "maybe"]);
    });

    it("rejects unconfigured options and duplicates", () => {
      expect(validateAnswer("MULTI_CHOICE", { options }, ["yes", "nope"]).success).toBe(false);
      expect(validateAnswer("MULTI_CHOICE", { options }, ["yes", "yes"]).success).toBe(false);
    });

    it("rejects a non-array", () => {
      expect(validateAnswer("MULTI_CHOICE", { options }, "yes").success).toBe(false);
    });

    it("enforces minSelected and maxSelected", () => {
      const settings = { options, minSelected: 1, maxSelected: 2 };

      expect(validateAnswer("MULTI_CHOICE", settings, []).success).toBe(false);
      expect(validateAnswer("MULTI_CHOICE", settings, ["yes"]).success).toBe(true);
      expect(validateAnswer("MULTI_CHOICE", settings, ["yes", "no"]).success).toBe(true);
      expect(validateAnswer("MULTI_CHOICE", settings, ["yes", "no", "maybe"]).success).toBe(false);
    });
  });

  describe("address", () => {
    it("stores only the parts that were filled in", () => {
      const result = validateAnswer("ADDRESS", {}, {
        line1: "12 Baker Street",
        city: "",
        country: "United Kingdom",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.answer.valueJson).toEqual({
          line1: "12 Baker Street",
          country: "United Kingdom",
        });
      }
    });

    it("requires every configured field", () => {
      const settings = { fields: ["line1", "city", "postalCode", "country"] as const };

      const missing = validateAnswer("ADDRESS", { fields: [...settings.fields] }, {
        line1: "12 Baker Street",
        city: "London",
      });
      expect(missing.success).toBe(false);
      if (!missing.success) expect(missing.message).toContain("postalCode");

      const complete = validateAnswer("ADDRESS", { fields: [...settings.fields] }, {
        line1: "12 Baker Street",
        city: "London",
        postalCode: "NW1 6XE",
        country: "United Kingdom",
      });
      expect(complete.success).toBe(true);
    });

    it("rejects a non-object", () => {
      expect(validateAnswer("ADDRESS", {}, "12 Baker Street").success).toBe(false);
    });

    it("rejects a part that is not a string", () => {
      expect(validateAnswer("ADDRESS", {}, { line1: { street: "x" } }).success).toBe(false);
    });
  });

  it("refuses to answer a question whose settings do not match its kind", () => {
    // A YES_NO question cannot have choice options; storing them would let the
    // renderer disagree with the validator.
    const result = validateAnswer("YES_NO", { options }, true);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toContain("misconfigured");
  });
});

describe("isEmptyAnswer", () => {
  it.each([
    [undefined, true],
    [null, true],
    ["", true],
    ["   ", true],
    [[], true],
    [{}, true],
    ["a", false],
    [[1], false],
    [{ a: 1 }, false],
    [0, false],
    [false, false],
  ])("treats %o as empty=%s", (value, expected) => {
    expect(isEmptyAnswer(value)).toBe(expected);
  });
});
