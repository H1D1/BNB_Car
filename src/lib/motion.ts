"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const subscribeMQ = (query: string) => (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(subscribeMQ(query), () => window.matchMedia(query).matches, () => serverValue);
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True when the visitor asked to save data or is on a 2G-class connection. */
export function useSaveData() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
    },
    () => false,
  );
}

/** Becomes true when the element enters the viewport (once by default). */
export function useInView(ref: RefObject<Element | null>, { once = true, margin = "0px 0px -15% 0px" } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, margin]);
  return inView;
}

/**
 * Scroll progress (0 → 1) of a tall section as it travels through the viewport:
 * 0 when its top reaches the top of the screen, 1 when its bottom reaches the bottom.
 * rAF-throttled; drives the pinned "route" and "how it works" sequences.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? -r.top / travel : r.top < window.innerHeight / 2 ? 1 : 0;
      setProgress(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return progress;
}
