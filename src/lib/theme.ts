"use client";

import { useSyncExternalStore } from "react";

import { THEME_COOKIE, type Theme } from "./theme-shared";

export type { Theme };

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

const read = (): Theme => (document.documentElement.classList.contains("light") ? "light" : "dark");

/** Current theme, kept in sync with the <html> class (SSR assumes dark). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f6f2ec" : "#0a0f2c");
}
