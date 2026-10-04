import { intlLocale } from "./utils";
import type { Locale } from "./types";

export const CURRENCIES = ["MAD", "EUR", "USD", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Indicative rates (1 MAD = x). Display only — every charge is made in MAD.
// Swap for a live FX feed (e.g. Bank Al-Maghrib reference rates) in production.
export const RATES: Record<Currency, number> = { MAD: 1, EUR: 0.0925, USD: 0.1, GBP: 0.079 };

export function formatMAD(amount: number, locale: Locale, opts: { decimals?: boolean } = {}) {
  const n = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(Number(amount));
  return locale === "ar" ? `${n} د.م.` : `${n} MAD`;
}

export function formatConverted(amountMad: number, currency: Currency, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amountMad) * RATES[currency]);
}
