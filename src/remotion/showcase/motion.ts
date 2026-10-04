import type { CSSProperties } from "react";

/**
 * Time-driven animation primitives for Remotion compositions (pure functions of `ms`), so a
 * frame renders identically in the Player, when seeking, and in CLI renders.
 */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const progress = (ms: number, delay: number, dur: number) => clamp((ms - delay) / dur);

export function up(ms: number, delay: number, dur = 600, dist = 18): CSSProperties {
  const p = easeOut(progress(ms, delay, dur));
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

export function fade(ms: number, delay: number, dur = 400): CSSProperties {
  return { opacity: easeOut(progress(ms, delay, dur)) };
}

/** Overshooting pop (0.6 → 1.06 → 1). */
export function pop(ms: number, delay: number, dur = 600): CSSProperties {
  const p = progress(ms, delay, dur);
  const scale = p < 0.7 ? 0.6 + 0.46 * easeOut(p / 0.7) : 1.06 - 0.06 * easeInOut((p - 0.7) / 0.3);
  return { opacity: clamp(p * 1.6), transform: `scale(${scale})` };
}

export function sheet(ms: number, delay: number, dur = 700): CSSProperties {
  const p = easeOut(progress(ms, delay, dur));
  return { transform: `translateY(${(1 - p) * 105}%)` };
}

export function zoomIn(ms: number, delay: number, dur = 700): CSSProperties {
  const p = easeOut(progress(ms, delay, dur));
  return { opacity: p, transform: `translateY(${(1 - p) * 36}px) scale(${0.86 + 0.14 * p})` };
}

/** Touch ripple: appears, then expands and fades. */
export function tap(ms: number, delay: number, dur = 700): CSSProperties {
  const p = progress(ms, delay, dur);
  if (p <= 0 || p >= 1) return { opacity: 0 };
  const opacity = p < 0.3 ? (p / 0.3) * 0.85 : 0.85 * (1 - (p - 0.3) / 0.7);
  const scale = p < 0.3 ? 0.4 + (0.6 * p) / 0.3 : 1 + ((p - 0.3) / 0.7) * 1;
  return { opacity, transform: `translate(-50%, -50%) scale(${scale})` };
}

/** Act transition: outgoing content slides/fades as the next act enters. */
export function actIn(ms: number, dur = 500): CSSProperties {
  const p = easeOut(progress(ms, 0, dur));
  return { opacity: p, transform: `translateX(${(1 - p) * 24}px)` };
}
