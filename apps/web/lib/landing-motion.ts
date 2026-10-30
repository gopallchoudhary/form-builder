export interface ScrollRevealSupport {
  prefersReducedMotion: boolean;
  supportsIntersectionObserver: boolean;
}

export function shouldEnableScrollReveal({
  prefersReducedMotion,
  supportsIntersectionObserver,
}: ScrollRevealSupport): boolean {
  return supportsIntersectionObserver && !prefersReducedMotion;
}

type RevealIntersectionEntry = Pick<IntersectionObserverEntry, "isIntersecting">;

/** Calls the reveal callback at most once, when an observed element enters the viewport. */
export function createOnceRevealHandler(onReveal: () => void) {
  let hasRevealed = false;

  return (entries: readonly RevealIntersectionEntry[]) => {
    if (hasRevealed || !entries.some((entry) => entry.isIntersecting)) return;

    hasRevealed = true;
    onReveal();
  };
}
