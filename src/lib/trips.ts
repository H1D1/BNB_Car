import "server-only";
import { cache } from "react";
import { createClient, getUser } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { PUBLIC_PROFILE_COLUMNS, type PublicProfile } from "./data";
import { en } from "./i18n/dictionaries/en";
import type { BadgeTone } from "@/components/ui/primitives";
import type { Booking, BookingStatus, Car, DisputeStatus } from "./types";

export const TRIP_CAR_COLUMNS =
  "id, host_id, status, plate, make, model, year, transmission, fuel, category, seats, doors, city_slug, neighborhood, address, cover_url, rating, review_count";

export type TripCar = Pick<
  Car,
  | "id"
  | "host_id"
  | "status"
  | "plate"
  | "make"
  | "model"
  | "year"
  | "transmission"
  | "fuel"
  | "category"
  | "seats"
  | "doors"
  | "city_slug"
  | "neighborhood"
  | "address"
  | "cover_url"
  | "rating"
  | "review_count"
>;

export type TripRole = "renter" | "host";

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/**
 * Loads a booking the signed-in user is party to (RLS), plus its car and both profiles.
 * Cars may be paused/unlisted later, so the car is read with the service role once the
 * booking itself has proven the user is a party.
 */
export const getTrip = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle<Booking>();
  if (!booking) return null;

  const admin = createAdminClient();
  const [car, profiles] = await Promise.all([
    admin.from("cars").select(TRIP_CAR_COLUMNS).eq("id", booking.car_id).maybeSingle<TripCar>(),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", [booking.renter_id, booking.host_id]),
  ]);
  const people = (profiles.data ?? []) as PublicProfile[];
  const role: TripRole = booking.host_id === user.id ? "host" : "renter";
  const renter = people.find((p) => p.id === booking.renter_id) ?? null;
  const host = people.find((p) => p.id === booking.host_id) ?? null;
  return {
    booking,
    car: car.data,
    role,
    userId: user.id,
    renter,
    host,
    counterpart: role === "host" ? renter : host,
  };
});

export type Trip = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

/** Mirrors the refund policy inside transition_booking('cancel'). */
export function refundEstimate(b: Pick<Booking, "start_at" | "total_mad" | "service_fee_mad" | "unit_price_mad" | "payment_status">, byHost: boolean, now = Date.now()) {
  if (b.payment_status !== "paid") return 0;
  const total = Number(b.total_mad);
  if (byHost) return total;
  const hoursBefore = (new Date(b.start_at).getTime() - now) / 3_600_000;
  if (hoursBefore >= 48) return total;
  if (hoursBefore >= 24) return Math.round(total * 0.5 * 100) / 100;
  return Math.max(0, total - Number(b.service_fee_mad) - Number(b.unit_price_mad));
}

export const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  pending: "saffron",
  confirmed: "majorelle",
  active: "mint",
  completed: "neutral",
  cancelled: "rose",
  declined: "rose",
};

export const DISPUTE_TONE: Record<DisputeStatus, BadgeTone> = {
  open: "saffron",
  under_review: "majorelle",
  resolved: "mint",
  rejected: "neutral",
};

export const DISPUTABLE: BookingStatus[] = ["active", "completed", "cancelled"];

const ERROR_CODES = new Set(Object.keys(en.errors));

/** Maps a Postgres exception message (raised as a code) to an `errors.*` key suffix. */
export function errorCode(message: string | undefined | null) {
  const m = (message ?? "").trim();
  return ERROR_CODES.has(m) ? m : "generic";
}
