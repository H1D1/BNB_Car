import type { DeliveryOption, InsurancePlan, RentalType } from "./types";

/** Booking choices carried in the URL from the car page to checkout. Dates are Casablanca wall time. */
export type BookingDraft = {
  start: string;
  end: string;
  type: RentalType;
  delivery: DeliveryOption;
  address?: string;
  alat?: number;
  alng?: number;
  airport?: string;
  insurance: InsurancePlan;
};

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function draftToQuery(d: BookingDraft) {
  const p = new URLSearchParams({ start: d.start, end: d.end, type: d.type, delivery: d.delivery, insurance: d.insurance });
  if (d.delivery === "address" && d.address) {
    p.set("address", d.address);
    if (d.alat != null && d.alng != null) {
      p.set("alat", d.alat.toFixed(5));
      p.set("alng", d.alng.toFixed(5));
    }
  }
  if (d.delivery === "airport" && d.airport) p.set("airport", d.airport);
  return p.toString();
}

export function parseDraft(sp: Record<string, string | string[] | undefined>): BookingDraft | null {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) || undefined;
  const start = one("start");
  const end = one("end");
  if (!start || !end || !DT.test(start) || !DT.test(end) || end <= start) return null;
  const type = one("type") === "hourly" ? "hourly" : "daily";
  const delivery = (["pickup", "address", "airport"] as const).find((d) => d === one("delivery")) ?? "pickup";
  const insurance = (["none", "basic", "premium"] as const).find((d) => d === one("insurance")) ?? "none";
  const alat = Number(one("alat"));
  const alng = Number(one("alng"));
  return {
    start,
    end,
    type,
    delivery,
    insurance,
    address: one("address")?.slice(0, 300),
    alat: Number.isFinite(alat) && one("alat") ? alat : undefined,
    alng: Number.isFinite(alng) && one("alng") ? alng : undefined,
    airport: one("airport"),
  };
}

/** Adds hours to a "YYYY-MM-DDTHH:mm" wall-time string without timezone drift. */
export function addHoursLocal(local: string, hours: number) {
  const d = new Date(local + ":00Z");
  d.setTime(d.getTime() + hours * 3600_000);
  return d.toISOString().slice(0, 16);
}
