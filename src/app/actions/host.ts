"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getProfile, getUser } from "@/lib/supabase/server";
import { getPlaces } from "@/lib/data";
import { normalizePlate, plateProvider, type PlateVehicle } from "@/lib/integrations/plates";
import { isoToCasablancaLocal } from "@/lib/utils";
import { CAR_FEATURES, CATEGORIES, FUELS, MIN_PHOTOS, PHOTO_KINDS, TRANSMISSIONS } from "@/lib/listing";
import type { ActionState, CarCategory, CarPhoto, PhotoKind } from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type WizardResult = { ok?: boolean; error?: string; fields?: string[]; carId?: string };
type PhotosResult = { ok?: boolean; error?: string; photos?: CarPhoto[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;


/** Starting price for a fresh draft, overwritten in the pricing step. */
const DEFAULT_PRICE: Record<CarCategory, number> = { city: 250, compact: 330, sedan: 400, suv: 550, luxury: 1200, van: 600 };

const todayCasablanca = () => isoToCasablancaLocal(new Date()).slice(0, 10);

/** Numbers from inputs: accepts "1,5" (French decimal comma) and trims. */
const num = (min: number, max: number, opts: { int?: boolean } = { int: true }) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(",", ".") : v),
    opts.int ? z.coerce.number().int().min(min).max(max) : z.coerce.number().min(min).max(max),
  );

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.trim()) : v),
    z.number().int().min(min).max(max).nullable(),
  );

const fieldsOf = (e: z.ZodError) => [...new Set(e.issues.map((i) => String(i.path[0] ?? "")))].filter(Boolean);

async function ownCar(carId: string) {
  const user = await getUser();
  if (!user || !UUID.test(carId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("cars").select("id, status, description").eq("id", carId).eq("host_id", user.id).maybeSingle();
  if (!data) return null;
  return { supabase, user, car: data as { id: string; status: string; description: Record<string, string> | null } };
}

function revalidateCar(carId: string) {
  revalidatePath("/host");
  revalidatePath(`/host/cars/${carId}`);
  revalidatePath(`/cars/${carId}`);
}

const errorCode = (message: string | undefined) => {
  const m = (message ?? "").trim();
  return /^[a-z_]+$/.test(m) ? m : "generic";
};

// ---------------------------------------------------------------------------
// Step 1 — vehicle
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
  plate: z.string().trim().max(24).optional().default(""),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  year: num(1990, new Date().getFullYear() + 1),
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUELS),
  category: z.enum(CATEGORIES),
  seats: num(1, 9),
  doors: num(2, 5),
  mileage_km: num(0, 2_000_000),
  features: z.array(z.enum(CAR_FEATURES)).max(CAR_FEATURES.length).default([]),
});

export async function lookupPlate(plate: string): Promise<{ vehicle: PlateVehicle | null }> {
  if (!(await getUser())) return { vehicle: null };
  if (typeof plate !== "string" || plate.length > 30) return { vehicle: null };
  return { vehicle: await plateProvider.lookup(plate) };
}

export async function saveVehicle(carId: string | null, input: unknown): Promise<WizardResult> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  const v = parsed.data;
  const row = {
    plate: v.plate ? normalizePlate(v.plate) : null,
    make: v.make,
    model: v.model,
    year: v.year,
    transmission: v.transmission,
    fuel: v.fuel,
    category: v.category,
    seats: v.seats,
    doors: v.doors,
    mileage_km: v.mileage_km,
    features: [...new Set(v.features)],
  };

  if (carId) {
    const own = await ownCar(carId);
    if (!own) return { error: "forbidden" };
    const { error } = await own.supabase.from("cars").update(row).eq("id", carId);
    if (error) return { error: "generic" };
    revalidateCar(carId);
    return { ok: true, carId };
  }

  // New listing: create a draft so photos/calendar have a car id. Price and
  // location get sensible placeholders until the following steps are saved.
  const [user, profile, places] = await Promise.all([getUser(), getProfile(), getPlaces()]);
  if (!user) return { error: "not_authenticated" };
  const cities = places.filter((p) => p.kind === "city");
  const city = cities.find((p) => p.slug === profile?.city_slug) ?? cities.find((p) => p.slug === "casablanca") ?? cities[0];
  if (!city) return { error: "generic" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cars")
    .insert({
      ...row,
      host_id: user.id,
      status: "draft",
      daily_price_mad: DEFAULT_PRICE[v.category],
      city_slug: city.slug,
      lat: city.lat,
      lng: city.lng,
      title: `${v.make} ${v.model} ${v.year}`,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };
  revalidatePath("/host");
  return { ok: true, carId: data.id as string };
}

// ---------------------------------------------------------------------------
// Step 2 — pricing
// ---------------------------------------------------------------------------

const pricingSchema = z.object({
  daily_price_mad: num(50, 50000),
  hourly_price_mad: optionalInt(10, 5000),
  weekly_discount_pct: num(0, 60),
  monthly_discount_pct: num(0, 70),
  deposit_mad: num(0, 100000),
  min_days: num(1, 30),
  km_per_day: num(50, 2000),
  extra_km_fee_mad: num(0, 50, { int: false }),
  instant_book: z.boolean(),
  cash_allowed: z.boolean(),
});

export async function savePricing(carId: string, input: unknown): Promise<WizardResult> {
  const parsed = pricingSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const v = parsed.data;
  const { error } = await own.supabase
    .from("cars")
    .update({ ...v, extra_km_fee_mad: Math.round(v.extra_km_fee_mad * 100) / 100 })
    .eq("id", carId);
  if (error) return { error: "generic" };
  revalidateCar(carId);
  return { ok: true, carId };
}

export type MarketSuggestion = { min: number; max: number; median: number; count: number; scope: "city" | "national" } | null;

/** Price range of active cars with the same category, in the same city (or nationally as a fallback). */
export async function marketSuggestion(citySlug: string, category: string, excludeCarId?: string | null): Promise<MarketSuggestion> {
  const cat = z.enum(CATEGORIES).safeParse(category);
  if (!cat.success || typeof citySlug !== "string" || citySlug.length > 60) return null;
  const supabase = await createClient();
  const fetchPrices = async (city?: string) => {
    let q = supabase.from("cars").select("id, daily_price_mad").eq("status", "active").eq("category", cat.data);
    if (city) q = q.eq("city_slug", city);
    const { data } = await q.limit(500);
    return (data ?? []).filter((c) => c.id !== excludeCarId).map((c) => Number(c.daily_price_mad));
  };
  let scope: "city" | "national" = "city";
  let prices = await fetchPrices(citySlug);
  if (prices.length < 2) {
    scope = "national";
    prices = await fetchPrices();
  }
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return { min: prices[0], max: prices[prices.length - 1], median: Math.round(median / 10) * 10, count: prices.length, scope };
}

// ---------------------------------------------------------------------------
// Step 3 — location & delivery
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  city_slug: z.string().min(1).max(60),
  neighborhood: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  // Morocco incl. southern provinces
  lat: z.number().min(20.5).max(36.2),
  lng: z.number().min(-17.5).max(-0.9),
  delivery_available: z.boolean(),
  delivery_fee_mad: num(0, 3000),
  delivery_radius_km: num(1, 200),
  airport_slugs: z.array(z.string().max(60)).max(20).default([]),
  airport_fee_mad: num(0, 3000),
});

export async function saveLocation(carId: string, input: unknown): Promise<WizardResult> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const v = parsed.data;
  const places = await getPlaces();
  if (!places.some((p) => p.kind === "city" && p.slug === v.city_slug)) return { error: "invalid", fields: ["city_slug"] };
  const airports = new Set(places.filter((p) => p.kind === "airport").map((p) => p.slug));
  const airport_slugs = [...new Set(v.airport_slugs)].filter((s) => airports.has(s));
  const { error } = await own.supabase
    .from("cars")
    .update({
      city_slug: v.city_slug,
      neighborhood: v.neighborhood || null,
      address: v.address || null,
      lat: v.lat,
      lng: v.lng,
      delivery_available: v.delivery_available,
      delivery_fee_mad: v.delivery_available ? v.delivery_fee_mad : 0,
      delivery_radius_km: v.delivery_radius_km,
      airport_slugs,
      airport_fee_mad: airport_slugs.length ? v.airport_fee_mad : 0,
    })
    .eq("id", carId);
  if (error) return { error: "generic" };
  revalidateCar(carId);
  return { ok: true, carId };
}

// ---------------------------------------------------------------------------
// Step 4 — photos, description, publish
// ---------------------------------------------------------------------------

const detailsSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  description: z
    .object({
      fr: z.string().trim().max(3000).optional().default(""),
      ar: z.string().trim().max(3000).optional().default(""),
      en: z.string().trim().max(3000).optional().default(""),
    })
    .default({ fr: "", ar: "", en: "" }),
});

export async function saveDetails(carId: string, input: unknown): Promise<WizardResult> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid", fields: fieldsOf(parsed.error) };
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const description = Object.fromEntries(Object.entries(parsed.data.description).filter(([, s]) => s.length > 0));
  const { error } = await own.supabase
    .from("cars")
    .update({ title: parsed.data.title || null, description })
    .eq("id", carId);
  if (error) return { error: "generic" };
  revalidateCar(carId);
  return { ok: true, carId };
}

/** Why a car can't go live yet (empty array = publishable). */
async function publishBlockers(own: NonNullable<Awaited<ReturnType<typeof ownCar>>>) {
  const [{ count }, profile] = await Promise.all([
    own.supabase.from("car_photos").select("id", { count: "exact", head: true }).eq("car_id", own.car.id),
    getProfile(),
  ]);
  const blockers: ("needPhotos" | "needDescription" | "needVerification")[] = [];
  if ((count ?? 0) < MIN_PHOTOS) blockers.push("needPhotos");
  if (!Object.values(own.car.description ?? {}).some((s) => typeof s === "string" && s.trim().length > 0)) blockers.push("needDescription");
  if (!profile || profile.id_status !== "verified" || !profile.phone_verified) blockers.push("needVerification");
  return blockers;
}

export async function publishCar(carId: string): Promise<WizardResult> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const blockers = await publishBlockers(own);
  if (blockers.length) return { error: blockers[0], fields: blockers };
  const { error } = await own.supabase.from("cars").update({ status: "active" }).eq("id", carId);
  if (error) return { error: "generic" };
  revalidateCar(carId);
  revalidatePath("/search");
  return { ok: true, carId };
}

export async function setCarStatus(carId: string, status: "active" | "paused"): Promise<WizardResult> {
  if (status === "active") return publishCar(carId);
  if (status !== "paused") return { error: "invalid" };
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const { error } = await own.supabase.from("cars").update({ status: "paused" }).eq("id", carId);
  if (error) return { error: "generic" };
  revalidateCar(carId);
  revalidatePath("/search");
  return { ok: true, carId };
}

export async function deleteCar(carId: string): Promise<WizardResult> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const { data: photos } = await own.supabase.from("car_photos").select("storage_path").eq("car_id", carId);
  const { error } = await own.supabase.from("cars").delete().eq("id", carId);
  if (error) return { error: error.code === "23503" ? "car_has_bookings" : "generic" };
  const paths = (photos ?? [])
    .map((p) => p.storage_path as string | null)
    .filter((p): p is string => !!p && p.startsWith(`${own.user.id}/`));
  if (paths.length) await own.supabase.storage.from("car-photos").remove(paths);
  revalidatePath("/host");
  revalidatePath("/search");
  return { ok: true };
}

// Photos: the browser uploads the (compressed) file straight to Storage under
// `${uid}/${carId}/…`; these actions keep car_photos rows and cars.cover_url in sync.

async function syncPhotos(supabase: Awaited<ReturnType<typeof createClient>>, carId: string): Promise<CarPhoto[]> {
  const { data } = await supabase.from("car_photos").select("*").eq("car_id", carId).order("position").order("created_at");
  const photos = (data ?? []) as CarPhoto[];
  await supabase.from("cars").update({ cover_url: photos[0]?.url ?? null }).eq("id", carId);
  return photos;
}

export async function addCarPhotos(carId: string, items: { path: string; kind: PhotoKind }[]): Promise<PhotosResult> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const parsed = z
    .array(z.object({ path: z.string().max(300), kind: z.enum(PHOTO_KINDS) }))
    .min(1)
    .max(30)
    .safeParse(items);
  if (!parsed.success) return { error: "invalid" };
  const prefix = `${own.user.id}/${carId}/`;
  if (parsed.data.some((i) => !i.path.startsWith(prefix) || i.path.includes(".."))) return { error: "forbidden" };

  const { data: last } = await own.supabase
    .from("car_photos")
    .select("position")
    .eq("car_id", carId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (last?.position ?? -1) + 1;
  const rows = parsed.data.map((i) => ({
    car_id: carId,
    storage_path: i.path,
    url: own.supabase.storage.from("car-photos").getPublicUrl(i.path).data.publicUrl,
    kind: i.kind,
    position: pos++,
  }));
  const { error } = await own.supabase.from("car_photos").insert(rows);
  if (error) return { error: "generic" };
  const photos = await syncPhotos(own.supabase, carId);
  revalidateCar(carId);
  return { ok: true, photos };
}

export async function setPhotoKind(carId: string, photoId: string, kind: PhotoKind): Promise<PhotosResult> {
  const own = await ownCar(carId);
  if (!own || !UUID.test(photoId)) return { error: "forbidden" };
  if (!(PHOTO_KINDS as readonly string[]).includes(kind)) return { error: "invalid" };
  await own.supabase.from("car_photos").update({ kind }).eq("id", photoId).eq("car_id", carId);
  return { ok: true, photos: await syncPhotos(own.supabase, carId) };
}

export async function reorderPhotos(carId: string, orderedIds: string[]): Promise<PhotosResult> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  if (!Array.isArray(orderedIds) || orderedIds.length > 60 || orderedIds.some((id) => !UUID.test(id))) return { error: "invalid" };
  await Promise.all(
    orderedIds.map((id, position) => own.supabase.from("car_photos").update({ position }).eq("id", id).eq("car_id", carId)),
  );
  const photos = await syncPhotos(own.supabase, carId);
  revalidateCar(carId);
  return { ok: true, photos };
}

export async function deletePhoto(carId: string, photoId: string): Promise<PhotosResult> {
  const own = await ownCar(carId);
  if (!own || !UUID.test(photoId)) return { error: "forbidden" };
  const { data: photo } = await own.supabase.from("car_photos").select("id, storage_path").eq("id", photoId).eq("car_id", carId).maybeSingle();
  if (!photo) return { error: "forbidden" };
  const { error } = await own.supabase.from("car_photos").delete().eq("id", photoId);
  if (error) return { error: "generic" };
  if (photo.storage_path?.startsWith(`${own.user.id}/`)) await own.supabase.storage.from("car-photos").remove([photo.storage_path]);
  const photos = await syncPhotos(own.supabase, carId);
  revalidateCar(carId);
  return { ok: true, photos };
}

// ---------------------------------------------------------------------------
// Booking requests
// ---------------------------------------------------------------------------

export async function respondToRequest(bookingId: string, action: "accept" | "decline"): Promise<ActionState> {
  if (!UUID.test(bookingId) || (action !== "accept" && action !== "decline")) return { error: "invalid_transition" };
  if (!(await getUser())) return { error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_booking", { p_booking_id: bookingId, p_action: action });
  if (error) return { error: errorCode(error.message) };
  revalidatePath("/host");
  revalidatePath(`/trips/${bookingId}`);
  revalidatePath("/trips");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Calendar: blocked dates & seasonal prices
// ---------------------------------------------------------------------------

const rangeSchema = z
  .object({ start: z.string().regex(DATE), end: z.string().regex(DATE) })
  .refine((r) => r.end >= r.start, { path: ["end"] });

export async function addBlockedDates(carId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const r = rangeSchema.safeParse({ start: form.get("start"), end: form.get("end") });
  if (!r.success) return { error: "invalidRange" };
  if (r.data.end < todayCasablanca()) return { error: "pastRange" };
  const note = String(form.get("note") ?? "").trim().slice(0, 140) || null;
  const { error } = await own.supabase.from("car_blocked_dates").insert({ car_id: carId, start_date: r.data.start, end_date: r.data.end, note });
  if (error) return { error: "generic" };
  revalidatePath(`/host/cars/${carId}/calendar`);
  revalidatePath(`/cars/${carId}`);
  return { ok: true };
}

export async function removeBlockedDates(carId: string, id: string): Promise<void> {
  const own = await ownCar(carId);
  if (!own || !UUID.test(id)) return;
  await own.supabase.from("car_blocked_dates").delete().eq("id", id).eq("car_id", carId);
  revalidatePath(`/host/cars/${carId}/calendar`);
  revalidatePath(`/cars/${carId}`);
}

export async function addSeasonalPrice(carId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const own = await ownCar(carId);
  if (!own) return { error: "forbidden" };
  const r = rangeSchema.safeParse({ start: form.get("start"), end: form.get("end") });
  if (!r.success) return { error: "invalidRange" };
  if (r.data.end < todayCasablanca()) return { error: "pastRange" };
  const label = String(form.get("label") ?? "").trim().slice(0, 60);
  if (!label) return { error: "labelRequired" };
  const price = num(50, 50000).safeParse(form.get("price"));
  if (!price.success) return { error: "invalidPrice" };
  const { error } = await own.supabase
    .from("car_seasonal_prices")
    .insert({ car_id: carId, label, start_date: r.data.start, end_date: r.data.end, daily_price_mad: price.data });
  if (error) return { error: "generic" };
  revalidatePath(`/host/cars/${carId}/calendar`);
  revalidatePath(`/cars/${carId}`);
  return { ok: true };
}

export async function removeSeasonalPrice(carId: string, id: string): Promise<void> {
  const own = await ownCar(carId);
  if (!own || !UUID.test(id)) return;
  await own.supabase.from("car_seasonal_prices").delete().eq("id", id).eq("car_id", carId);
  revalidatePath(`/host/cars/${carId}/calendar`);
  revalidatePath(`/cars/${carId}`);
}
