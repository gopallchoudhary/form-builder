import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "trpc-to-openapi";

import { serverRouter } from "@repo/trpc/server";

describe("openapi", () => {
  it("generates a document containing the new routers", () => {
    const doc = generateOpenApiDocument(serverRouter, {
      title: "Streamyst API",
      version: "1.0.0",
      baseUrl: "http://localhost:3000/api",
    });

    const paths = Object.keys(doc.paths ?? {});
    for (const expected of [
      "/form/getForm",
      "/form/setFormStatus",
      "/form/question/createQuestion",
      "/form/page/reorderPages",
      "/public/form/getFormBySlug",
      "/public/form/submitForm",
      "/form/response/exportCsv",
      "/form/analytics/getOverview",
    ]) {
      expect(paths).toContain(expected);
    }
  });
});
