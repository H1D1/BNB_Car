import clsx, { type ClassValue } from "clsx";
import type { Locale, Place } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export const intlLocale = (l: Locale) => (l === "ar" ? "ar-MA" : l === "fr" ? "fr-MA" : "en-GB");

/*
 * Casablanca time without the runtime's timezone database: some server runtimes (Vercel's Node)
 * ship tz data that puts Morocco on UTC+0, which shifted server-rendered times by an hour and
 * broke hydration. Morocco is UTC+1 except during Ramadan (UTC+0); windows below are from
 * tzdata 2024b, each switching at 02:00 UTC on the given days.
 */
const RAMADAN_UTC0 = (
  "2019-05-05/2019-06-09 2020-04-19/2020-05-31 2021-04-11/2021-05-16 2022-03-27/2022-05-08 2023-03-19/2023-04-23 " +
  "2024-03-10/2024-04-14 2025-02-23/2025-04-06 2026-02-15/2026-03-22 2027-02-07/2027-03-14 2028-01-23/2028-03-05 " +
  "2029-01-14/2029-02-18 2029-12-30/2030-02-10 2030-12-22/2031-01-26 2031-12-14/2032-01-18 2032-11-28/2033-01-09 " +
  "2033-11-20/2033-12-25 2034-11-05/2034-12-17 2035-10-28/2035-12-09 2036-10-19/2036-11-23 2037-10-04/2037-11-15 " +
  "2038-09-26/2038-10-31 2039-09-18/2039-10-23 2040-09-02/2040-10-14 2041-08-25/2041-09-29 2042-08-10/2042-09-21 " +
  "2043-08-02/2043-09-13 2044-07-24/2044-08-28 2045-07-09/2045-08-20"
)
  .split(" ")
  .map((w) => w.split("/").map((d) => Date.parse(`${d}T02:00:00Z`)) as [number, number]);

/** Casablanca's UTC offset in ms at a given instant. */
export function casablancaOffset(ms: number) {
  return RAMADAN_UTC0.some(([a, b]) => ms >= a && ms < b) ? 0 : 3600_000;
}

/** The instant shifted so its UTC fields read as Casablanca wall time. */
const shifted = (d: string | Date) => {
  const ms = new Date(d).getTime();
  return new Date(ms + casablancaOffset(ms));
};

export function formatDate(d: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: "UTC" }).format(shifted(d));
}

export function formatDateTime(d: string | Date, locale: Locale) {
  return formatDate(d, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelative(d: string | Date, locale: Locale) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d, locale);
}

export const placeName = (p: Pick<Place, "name_fr" | "name_ar" | "name_en">, l: Locale) =>
  l === "ar" ? p.name_ar : l === "en" ? p.name_en : p.name_fr;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

const partsIn = (d: Date) => {
  const iso = shifted(d).toISOString();
  return { y: iso.slice(0, 4), mo: iso.slice(5, 7), d: iso.slice(8, 10), h: iso.slice(11, 13), mi: iso.slice(14, 16) };
};

/** ISO → "YYYY-MM-DDTHH:mm" in Casablanca time, for datetime-local inputs. */
export function isoToCasablancaLocal(iso: string | Date) {
  const p = partsIn(new Date(iso));
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}`;
}

/** Local "YYYY-MM-DDTHH:mm" (Casablanca wall time) → ISO string. Handles the Ramadan UTC+0 switch. */
export function casablancaLocalToISO(local: string) {
  const asUtc = Date.parse(local + ":00Z");
  return new Date(asUtc - casablancaOffset(asUtc - 3600_000)).toISOString();
}

/** Default search window: tomorrow 10:00 → +3 days 10:00 (Casablanca). */
export function defaultDates() {
  const day = (offset: number) => isoToCasablancaLocal(new Date(Date.now() + offset * 86400_000)).slice(0, 10) + "T10:00";
  return { start: day(1), end: day(4) };
}

export const whatsappLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
