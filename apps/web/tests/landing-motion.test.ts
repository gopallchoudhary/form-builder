import { describe, expect, it, vi } from "vitest";

import { createOnceRevealHandler, shouldEnableScrollReveal } from "~/lib/landing-motion";

describe("scroll reveal motion", () => {
  it("uses viewport reveals only when motion is allowed and observers are supported", () => {
    expect(
      shouldEnableScrollReveal({
        prefersReducedMotion: false,
        supportsIntersectionObserver: true,
      }),
    ).toBe(true);
  });

  it("leaves content static when reduced motion is requested", () => {
    expect(
      shouldEnableScrollReveal({
        prefersReducedMotion: true,
        supportsIntersectionObserver: true,
      }),
    ).toBe(false);
  });

  it("leaves content static when IntersectionObserver is unavailable", () => {
    expect(
      shouldEnableScrollReveal({
        prefersReducedMotion: false,
        supportsIntersectionObserver: false,
      }),
    ).toBe(false);
  });

  it("waits for an intersecting entry and reveals only once", () => {
    const reveal = vi.fn();
    const handleIntersection = createOnceRevealHandler(reveal);

    handleIntersection([{ isIntersecting: false }]);
    expect(reveal).not.toHaveBeenCalled();

    handleIntersection([{ isIntersecting: true }]);
    handleIntersection([{ isIntersecting: true }]);
    expect(reveal).toHaveBeenCalledTimes(1);
  });
});
