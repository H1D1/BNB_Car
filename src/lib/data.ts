import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { casablancaLocalToISO } from "./utils";
import { distanceKm } from "./mapbox";
import type { Car, CarCategory, CarPhoto, FuelType, Place, Profile, Review, Transmission } from "./types";

export const CAR_CARD_COLUMNS =
  "id, host_id, make, model, year, transmission, fuel, category, seats, daily_price_mad, hourly_price_mad, instant_book, city_slug, neighborhood, lat, lng, delivery_available, airport_slugs, cover_url, rating, review_count, trip_count, status";

export type CarCard = Pick<
  Car,
  | "id"
  | "host_id"
  | "make"
  | "model"
  | "year"
  | "transmission"
  | "fuel"
  | "category"
  | "seats"
  | "daily_price_mad"
  | "hourly_price_mad"
  | "instant_book"
  | "city_slug"
  | "neighborhood"
  | "lat"
  | "lng"
  | "delivery_available"
  | "airport_slugs"
  | "cover_url"
  | "rating"
  | "review_count"
  | "trip_count"
  | "status"
> & { distance_km?: number };

export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, avatar_url, bio, city_slug, phone_verified, is_host, id_status, license_status, host_rating, host_review_count, renter_rating, renter_review_count, trips_completed, created_at";

export type PublicProfile = Pick<
  Profile,
  | "id"
  | "full_name"
  | "avatar_url"
  | "bio"
  | "city_slug"
  | "phone_verified"
  | "is_host"
  | "id_status"
  | "license_status"
  | "host_rating"
  | "host_review_count"
  | "renter_rating"
  | "renter_review_count"
  | "trips_completed"
  | "created_at"
>;

export const getPlaces = cache(async (): Promise<Place[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("places").select("*").order("sort");
  return (data ?? []) as Place[];
});

export const getPlace = async (slug: string | undefined) => (slug ? (await getPlaces()).find((p) => p.slug === slug) : undefined);

export const NEARBY_RADIUS_KM = 40;

export type SearchFilters = {
  place?: string;
  lat?: number;
  lng?: number;
  label?: string;
  start?: string; // Casablanca local "YYYY-MM-DDTHH:mm"
  end?: string;
  transmission?: Transmission[];
  fuel?: FuelType[];
  category?: CarCategory[];
  minPrice?: number;
  maxPrice?: number;
  booking?: "instant" | "request";
  delivery?: boolean;
  seats?: number;
  sort?: "recommended" | "price_asc" | "price_desc" | "rating" | "newest";
};

const list = <T extends string>(v: string | string[] | undefined, allowed: readonly T[]) =>
  (Array.isArray(v) ? v : v ? v.split(",") : []).filter((x): x is T => (allowed as readonly string[]).includes(x));

export function parseFilters(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) || undefined;
  const num = (k: string) => {
    const n = Number(one(k));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const dt = (k: string) => {
    const v = one(k);
    return v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : undefined;
  };
  const sort = one("sort");
  const lat = Number(one("lat"));
  const lng = Number(one("lng"));
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && one("lat") != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return {
    place: hasPoint ? undefined : one("place"),
    lat: hasPoint ? lat : undefined,
    lng: hasPoint ? lng : undefined,
    label: hasPoint ? one("label")?.slice(0, 160) : undefined,
    start: dt("start"),
    end: dt("end"),
    transmission: list(sp.transmission, ["manual", "automatic"] as const),
    fuel: list(sp.fuel, ["diesel", "gasoline", "hybrid", "electric"] as const),
    category: list(sp.category, ["city", "compact", "sedan", "suv", "luxury", "van"] as const),
    minPrice: num("min"),
    maxPrice: num("max"),
    booking: one("booking") === "instant" ? "instant" : one("booking") === "request" ? "request" : undefined,
    delivery: one("delivery") === "1",
    seats: num("seats"),
    sort: (["recommended", "price_asc", "price_desc", "rating", "newest"] as const).find((s) => s === sort) ?? "recommended",
  };
}

export async function searchCars(f: SearchFilters): Promise<CarCard[]> {
  const supabase = await createClient();
  let q = supabase.from("cars").select(CAR_CARD_COLUMNS).eq("status", "active");

  const place = await getPlace(f.place);
  if (place?.kind === "airport") q = q.contains("airport_slugs", [place.slug]);
  else if (place) q = q.eq("city_slug", place.city_slug);

  if (f.transmission?.length) q = q.in("transmission", f.transmission);
  if (f.fuel?.length) q = q.in("fuel", f.fuel);
  if (f.category?.length) q = q.in("category", f.category);
  if (f.minPrice) q = q.gte("daily_price_mad", f.minPrice);
  if (f.maxPrice) q = q.lte("daily_price_mad", f.maxPrice);
  if (f.booking) q = q.eq("instant_book", f.booking === "instant");
  if (f.delivery) q = q.eq("delivery_available", true);
  if (f.seats) q = q.gte("seats", f.seats);

  switch (f.sort) {
    case "price_asc":
      q = q.order("daily_price_mad", { ascending: true });
      break;
    case "price_desc":
      q = q.order("daily_price_mad", { ascending: false });
      break;
    case "rating":
      q = q.order("rating", { ascending: false, nullsFirst: false });
      break;
    case "newest":
      q = q.order("year", { ascending: false });
      break;
    default:
      q = q.order("trip_count", { ascending: false }).order("rating", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await q.limit(120);
  if (error) throw error;
  let cars = (data ?? []) as CarCard[];

  if (f.lat != null && f.lng != null) {
    const here = { lat: f.lat, lng: f.lng };
    cars = cars
      .map((c) => ({ ...c, distance_km: Math.round(distanceKm(here, c) * 10) / 10 }))
      .filter((c) => c.distance_km! <= NEARBY_RADIUS_KM);
    if (f.sort === "recommended") cars.sort((a, b) => a.distance_km! - b.distance_km!);
  }

  if (f.start && f.end && f.end > f.start) {
    const { data: busy } = await supabase.rpc("unavailable_car_ids", {
      p_start: casablancaLocalToISO(f.start),
      p_end: casablancaLocalToISO(f.end),
    });
    const busySet = new Set((busy ?? []) as string[]);
    cars = cars.filter((c) => !busySet.has(c.id));
  }
  return cars;
}

export async function getCar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: car } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
  if (!car) return null;
  const [photos, host, reviews, seasonal, busy] = await Promise.all([
    supabase.from("car_photos").select("*").eq("car_id", id).order("position"),
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", car.host_id).single(),
    supabase
      .from("reviews")
      .select("*, author:profiles!reviews_author_id_fkey(id, full_name, avatar_url)")
      .eq("car_id", id)
      .eq("direction", "renter_to_host")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("car_seasonal_prices").select("*").eq("car_id", id).gte("end_date", new Date().toISOString().slice(0, 10)).order("start_date"),
    supabase.rpc("car_busy_ranges", { p_car_id: id }),
  ]);
  return {
    car: car as Car,
    photos: (photos.data ?? []) as CarPhoto[],
    host: host.data as PublicProfile,
    reviews: (reviews.data ?? []) as (Review & { author: { id: string; full_name: string; avatar_url: string | null } })[],
    seasonal: (seasonal.data ?? []) as { id: string; label: string; start_date: string; end_date: string; daily_price_mad: number }[],
    busy: (busy.data ?? []) as { start_at: string; end_at: string; kind: string }[],
  };
}

export async function getFavoriteIds(userId: string | undefined) {
  if (!userId) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("car_id").eq("user_id", userId);
  return new Set((data ?? []).map((f) => f.car_id as string));
}

/** Badges derived from profile data — mirrors the profile_badges view. */
export function badgesOf(p: Pick<Profile, "is_host" | "id_status" | "license_status" | "phone_verified" | "trips_completed" | "renter_rating">) {
  return {
    verifiedHost: p.is_host && p.id_status === "verified" && p.phone_verified,
    superDriver: p.id_status === "verified" && p.license_status === "verified" && p.trips_completed >= 3 && Number(p.renter_rating ?? 0) >= 4.7,
    idVerified: p.id_status === "verified",
    licenseVerified: p.license_status === "verified",
    phoneVerified: p.phone_verified,
  };
}

/** Live numbers for the landing page: cars and lowest daily price per category and per airport. */
export const getMarketStats = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("cars").select("category, daily_price_mad, airport_slugs").eq("status", "active");
  const byCategory: Partial<Record<CarCategory, { count: number; from: number }>> = {};
  const byAirport: Record<string, { count: number; from: number }> = {};
  const bump = (bucket: { count: number; from: number } | undefined, price: number) =>
    bucket ? { count: bucket.count + 1, from: Math.min(bucket.from, price) } : { count: 1, from: price };
  for (const c of data ?? []) {
    byCategory[c.category as CarCategory] = bump(byCategory[c.category as CarCategory], c.daily_price_mad);
    for (const a of (c.airport_slugs as string[]) ?? []) byAirport[a] = bump(byAirport[a], c.daily_price_mad);
  }
  return { byCategory, byAirport };
});
