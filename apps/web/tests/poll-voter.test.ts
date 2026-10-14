import { describe, expect, it } from "vitest";

import { resolveVoterView } from "~/lib/poll-voter";

describe("resolveVoterView", () => {
  it("loads before anything else", () => {
    expect(resolveVoterView({ isLoading: true, isError: false, poll: undefined })).toEqual({
      kind: "loading",
    });
  });

  it("treats errors and absent polls as missing", () => {
    expect(resolveVoterView({ isLoading: false, isError: true, poll: undefined })).toEqual({
      kind: "missing",
    });
    expect(resolveVoterView({ isLoading: false, isError: false, poll: undefined })).toEqual({
      kind: "missing",
    });
  });

  it("asks an unvoted visitor to an open poll to vote", () => {
    expect(
      resolveVoterView({
        isLoading: false,
        isError: false,
        poll: { status: "OPEN", voted: false },
      }),
    ).toEqual({ kind: "vote" });
  });

  it("shows results to anyone who voted, even after the close", () => {
    // The close freezes voting, not viewing: someone who voted before it still gets the
    // final tally, while a stranger only gets told it is over.
    for (const status of ["OPEN", "CLOSED"] as const) {
      expect(
        resolveVoterView({ isLoading: false, isError: false, poll: { status, voted: true } }),
      ).toEqual({ kind: "results" });
    }
  });

  it("shows only the closed notice to a stranger of a closed poll", () => {
    expect(
      resolveVoterView({
        isLoading: false,
        isError: false,
        poll: { status: "CLOSED", voted: false },
      }),
    ).toEqual({ kind: "closed" });
  });
});
