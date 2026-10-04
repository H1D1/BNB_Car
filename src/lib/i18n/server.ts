import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { Locale } from "../types";
import { CURRENCIES, type Currency } from "../currency";
import { CURRENCY_COOKIE, DEFAULT_LOCALE, LOCALE_COOKIE, dictionaries, dirOf, isLocale, makeT } from "./config";

export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
});

export const getCurrency = cache(async (): Promise<Currency> => {
  const v = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return (CURRENCIES as readonly string[]).includes(v ?? "") ? (v as Currency) : "MAD";
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return { locale, dict, dir: dirOf(locale), t: makeT(dict) };
});
