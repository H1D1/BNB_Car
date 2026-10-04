import clsx, { type ClassValue } from "clsx";
import type { Locale, Place } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export const intlLocale = (l: Locale) => (l === "ar" ? "ar-MA" : l === "fr" ? "fr-MA" : "en-GB");

export const TZ = "Africa/Casablanca";

export function formatDate(d: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, ...opts }).format(new Date(d));
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
};

/** ISO → "YYYY-MM-DDTHH:mm" in Casablanca time, for datetime-local inputs. */
export function isoToCasablancaLocal(iso: string | Date) {
  const p = partsIn(new Date(iso));
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}`;
}

/** Local "YYYY-MM-DDTHH:mm" (Casablanca wall time) → ISO string. Handles the Ramadan UTC+0 switch. */
export function casablancaLocalToISO(local: string) {
  const asUtc = new Date(local + ":00Z");
  const p = partsIn(asUtc);
  const shown = Date.UTC(+p.y, +p.mo - 1, +p.d, +p.h, +p.mi);
  const offset = shown - asUtc.getTime();
  return new Date(asUtc.getTime() - offset).toISOString();
}

/** Default search window: tomorrow 10:00 → +3 days 10:00 (Casablanca). */
export function defaultDates() {
  const day = (offset: number) => isoToCasablancaLocal(new Date(Date.now() + offset * 86400_000)).slice(0, 10) + "T10:00";
  return { start: day(1), end: day(4) };
}

export const whatsappLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
