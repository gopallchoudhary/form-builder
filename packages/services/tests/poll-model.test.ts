import { describe, expect, it } from "vitest";

import {
  castVoteInput,
  createPollInput,
  getPollInsightsInput,
  pollOptionsSchema,
  setPollStatusInput,
  updatePollInput,
} from "../poll/model";

/**
 * Poll input validation, without a database.
 *
 * These pin the rules a creator meets in the dialog: how many options a poll holds, what an
 * option id may look like, and which fields an update may carry. Behaviour — who may vote,
 * when an option freezes — needs rows and lives in `poll.test.ts`.
 */

const OPTIONS = [
  { id: "ramen", label: "Ramen" },
  { id: "thali", label: "Thali" },
];

describe("createPollInput", () => {
  it("accepts a title with two options", async () => {
    const parsed = await createPollInput.parseAsync({ title: "Lunch", options: OPTIONS });

    expect(parsed.title).toBe("Lunch");
    expect(parsed.description).toBeUndefined();
  });

  it("trims the title and rejects an empty one", async () => {
    await expect(createPollInput.parseAsync({ title: "   ", options: OPTIONS })).rejects.toThrow();

    const parsed = await createPollInput.parseAsync({ title: "  Lunch  ", options: OPTIONS });
    expect(parsed.title).toBe("Lunch");
  });

  it("rejects a title beyond the column", async () => {
    await expect(
      createPollInput.parseAsync({ title: "x".repeat(121), options: OPTIONS }),
    ).rejects.toThrow();
  });
});

describe("pollOptionsSchema", () => {
  it("rejects a single option, which is not a choice", async () => {
    await expect(
      pollOptionsSchema.parseAsync([{ id: "only", label: "Only" }]),
    ).rejects.toThrow();
  });

  it("rejects more than ten options", async () => {
    const many = Array.from({ length: 11 }, (_, index) => ({
      id: `opt-${index}`,
      label: `Option ${index}`,
    }));

    await expect(pollOptionsSchema.parseAsync(many)).rejects.toThrow();
  });

  it("rejects duplicate option ids", async () => {
    await expect(
      pollOptionsSchema.parseAsync([
        { id: "same", label: "First" },
        { id: "same", label: "Second" },
      ]),
    ).rejects.toThrow();
  });

  it("rejects ids outside the slug alphabet, which the tally keys on", async () => {
    await expect(
      pollOptionsSchema.parseAsync([
        { id: "Ramen!", label: "Ramen" },
        { id: "thali", label: "Thali" },
      ]),
    ).rejects.toThrow();
  });

  it("rejects an empty label", async () => {
    await expect(
      pollOptionsSchema.parseAsync([
        { id: "ramen", label: "" },
        { id: "thali", label: "Thali" },
      ]),
    ).rejects.toThrow();
  });
});

describe("updatePollInput", () => {
  it("accepts a partial patch, since the dialog edits one field at a time", async () => {
    const parsed = await updatePollInput.parseAsync({ pollId: "p1", title: "Dinner" });

    expect(parsed.title).toBe("Dinner");
    expect(parsed.options).toBeUndefined();
  });

  it("accepts null to clear the description", async () => {
    const parsed = await updatePollInput.parseAsync({ pollId: "p1", description: null });

    expect(parsed.description).toBeNull();
  });
});

describe("setPollStatusInput", () => {
  it("accepts each lifecycle state and nothing else", async () => {
    for (const status of ["DRAFT", "OPEN", "CLOSED"] as const) {
      const parsed = await setPollStatusInput.parseAsync({ pollId: "p1", status });
      expect(parsed.status).toBe(status);
    }

    await expect(
      setPollStatusInput.parseAsync({ pollId: "p1", status: "LIVE" }),
    ).rejects.toThrow();
  });
});

describe("castVoteInput", () => {
  it("requires a device uuid, never an identity", async () => {
    const deviceId = "22222222-2222-4222-8222-222222222222";
    const parsed = await castVoteInput.parseAsync({ pollId: "p1", deviceId, optionId: "ramen" });

    expect(parsed.deviceId).toBe(deviceId);

    await expect(
      castVoteInput.parseAsync({ pollId: "p1", deviceId: "not-a-uuid", optionId: "ramen" }),
    ).rejects.toThrow();
  });
});

describe("getPollInsightsInput", () => {
  it("defaults to thirty days and caps at ninety", async () => {
    const parsed = await getPollInsightsInput.parseAsync({ pollId: "p1" });
    expect(parsed.days).toBe(30);

    await expect(getPollInsightsInput.parseAsync({ pollId: "p1", days: 0 })).rejects.toThrow();
    await expect(getPollInsightsInput.parseAsync({ pollId: "p1", days: 91 })).rejects.toThrow();
  });
});
