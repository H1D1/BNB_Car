// Shared by the server layout (inline script) and the client theme hooks.
export type Theme = "light" | "dark";
export const THEME_COOKIE = "csm_theme";
/**
 * Runs in <head> before first paint: explicit cookie choice wins, otherwise follow the OS
 * (and keep following it live until the user picks a theme). The `light` class is owned by
 * this script + setTheme(), never by React, so server re-renders can't reset it.
 */
export const themeInitScript = `(function(){try{var d=document.documentElement,m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/),q=window.matchMedia("(prefers-color-scheme: light)");function a(l){d.classList.toggle("light",l)}if(m){a(m[1]==="light")}else{a(q.matches);q.addEventListener("change",function(e){if(!/(?:^|; )${THEME_COOKIE}=/.test(document.cookie))a(e.matches)})}}catch(e){}})()`;
