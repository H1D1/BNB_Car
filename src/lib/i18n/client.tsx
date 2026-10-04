"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "../types";
import type { Currency } from "../currency";
import type { Dict } from "./dictionaries/en";
import { dirOf, makeT, type TFn } from "./config";

type Ctx = { locale: Locale; currency: Currency; t: TFn; dir: "ltr" | "rtl" };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  currency,
  dict,
  children,
}: {
  locale: Locale;
  currency: Currency;
  dict: Dict;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, currency, t: makeT(dict), dir: dirOf(locale) }), [locale, currency, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
