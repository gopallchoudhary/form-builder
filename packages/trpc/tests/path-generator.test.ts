import { describe, expect, it } from "vitest";

import { generatePath } from "../server/utils/path-generator";
describe("generatePath", () => {
  it("joins a base and a path", () => {
    const getPath = generatePath("/form");

    expect(getPath("/listForms")).toBe("/form/listForms");
  });

  it("normalises duplicated, leading and trailing slashes", () => {
    const getPath = generatePath("/form/");

    expect(getPath("/listForms")).toBe("/form/listForms");
    expect(getPath("listForms")).toBe("/form/listForms");
    expect(getPath("//listForms//")).toBe("/form/listForms");
  });

  it("collapses slashes inside the base", () => {
    expect(generatePath("//form//")( "/listForms")).toBe("/form/listForms");
  });

  it("keeps an empty segment out of the result", () => {
    expect(generatePath("/form")("/")).toBe("/form");
    expect(generatePath("/")("/listForms")).toBe("/listForms");
  });

  it("returns a value usable as a literal OpenAPI path", () => {
    const getPath: (path: string) => `/${string}` = generatePath("/form");

    expect(getPath("/listForms")).toMatch(/^\/form\/listForms$/);
  });
});
