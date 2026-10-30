"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import { createOnceRevealHandler, shouldEnableScrollReveal } from "~/lib/landing-motion";

import styles from "./landing-motion.module.css";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

type RevealStyle = CSSProperties & {
  "--landing-reveal-delay": string;
};

/**
 * Progressively enhances its children with a one-time entrance when they reach the viewport.
 * The server-rendered markup stays visible unless the browser supports the observer and allows
 * motion, so missing JavaScript or browser APIs can never strand content in a hidden state.
 */
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const supportsIntersectionObserver = typeof window.IntersectionObserver === "function";

    if (!shouldEnableScrollReveal({ prefersReducedMotion, supportsIntersectionObserver })) return;

    // If the visitor restored a scrolled position, don't hide content they've already passed.
    // Items near the first viewport can animate directly without a pending/visible flash.
    if (element.getBoundingClientRect().top <= window.innerHeight * 0.9) {
      element.dataset.reveal = "visible";
      return;
    }

    let isActive = true;
    const observerRef: { current: IntersectionObserver | null } = { current: null };
    element.dataset.reveal = "pending";

    const handleIntersection = createOnceRevealHandler(() => {
      if (!isActive) return;

      element.dataset.reveal = "visible";
      observerRef.current?.unobserve(element);
    });

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.1,
    });
    observerRef.current = observer;
    observer.observe(element);

    return () => {
      isActive = false;
      observerRef.current = null;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={elementRef}
      className={cn(styles.scrollReveal, className)}
      style={{ "--landing-reveal-delay": `${Math.max(0, delay)}ms` } as RevealStyle}
    >
      {children}
    </div>
  );
}
