import type { Locale } from "../types";
import { en, type Dict } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";

export const LOCALES: Locale[] = ["fr", "ar", "en"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "csm_locale";
export const CURRENCY_COOKIE = "csm_currency";

export const LOCALE_LABELS: Record<Locale, string> = { fr: "Français", ar: "العربية", en: "English" };

export const dictionaries: Record<Locale, Dict> = { fr, ar, en };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as string[]).includes(v);
export const dirOf = (l: Locale): "rtl" | "ltr" => (l === "ar" ? "rtl" : "ltr");

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Paths<Dict>;
export type TVars = Record<string, string | number>;
export type TFn = (key: TKey, vars?: TVars) => string;

export function makeT(dict: Dict): TFn {
  return (key, vars) => {
    let node: unknown = dict;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)?.[part];
    let s = typeof node === "string" ? node : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/** Lookup for dynamic keys (enum values from the DB). Falls back to the raw value. */
export function tDyn(t: TFn, prefix: string, value: string) {
  const key = `${prefix}.${value}` as TKey;
  const out = t(key);
  return out === key ? value : out;
}
