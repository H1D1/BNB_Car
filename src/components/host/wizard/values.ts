import type { Car, CarCategory, FuelType, Locale, Place, Transmission } from "@/lib/types";

/** Form state of the listing wizard. Numbers stay strings while editing; the server validates them. */
export type WizardValues = {
  plate: string;
  make: string;
  model: string;
  year: string;
  transmission: Transmission;
  fuel: FuelType;
  category: CarCategory;
  seats: string;
  doors: string;
  mileage_km: string;
  features: string[];

  daily_price_mad: string;
  hourly_price_mad: string;
  weekly_discount_pct: string;
  monthly_discount_pct: string;
  deposit_mad: string;
  min_days: string;
  km_per_day: string;
  extra_km_fee_mad: string;
  instant_book: boolean;
  cash_allowed: boolean;

  city_slug: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  delivery_available: boolean;
  delivery_fee_mad: string;
  delivery_radius_km: string;
  airport_slugs: string[];
  airport_fee_mad: string;

  title: string;
  description: Record<Locale, string>;
};

export type SetValues = (patch: Partial<WizardValues> | ((prev: WizardValues) => Partial<WizardValues>)) => void;

export type StepProps = {
  v: WizardValues;
  set: SetValues;
  invalid: (field: string) => boolean;
};

const s = (n: number | null | undefined) => (n == null ? "" : String(n));

export function toValues(car: Car | null, defaultCity: Place | undefined): WizardValues {
  return {
    plate: car?.plate ?? "",
    make: car?.make ?? "",
    model: car?.model ?? "",
    year: s(car?.year ?? new Date().getFullYear() - 3),
    transmission: car?.transmission ?? "manual",
    fuel: car?.fuel ?? "diesel",
    category: car?.category ?? "city",
    seats: s(car?.seats ?? 5),
    doors: s(car?.doors ?? 5),
    mileage_km: s(car?.mileage_km ?? 0),
    features: car?.features ?? ["ac", "bluetooth"],

    daily_price_mad: s(car?.daily_price_mad ?? 300),
    hourly_price_mad: s(car?.hourly_price_mad),
    weekly_discount_pct: s(car?.weekly_discount_pct ?? 10),
    monthly_discount_pct: s(car?.monthly_discount_pct ?? 20),
    deposit_mad: s(car?.deposit_mad ?? 3000),
    min_days: s(car?.min_days ?? 1),
    km_per_day: s(car?.km_per_day ?? 250),
    extra_km_fee_mad: s(car?.extra_km_fee_mad ?? 1.5),
    instant_book: car?.instant_book ?? false,
    cash_allowed: car?.cash_allowed ?? false,

    city_slug: car?.city_slug ?? defaultCity?.slug ?? "casablanca",
    neighborhood: car?.neighborhood ?? "",
    address: car?.address ?? "",
    lat: car?.lat ?? defaultCity?.lat ?? 33.5731,
    lng: car?.lng ?? defaultCity?.lng ?? -7.5898,
    delivery_available: car?.delivery_available ?? false,
    delivery_fee_mad: s(car?.delivery_fee_mad ?? 100),
    delivery_radius_km: s(car?.delivery_radius_km ?? 10),
    airport_slugs: car?.airport_slugs ?? [],
    airport_fee_mad: s(car?.airport_fee_mad ?? 150),

    title: car?.title ?? "",
    description: { fr: car?.description?.fr ?? "", ar: car?.description?.ar ?? "", en: car?.description?.en ?? "" },
  };
}

export const vehiclePayload = (v: WizardValues) => ({
  plate: v.plate,
  make: v.make,
  model: v.model,
  year: v.year,
  transmission: v.transmission,
  fuel: v.fuel,
  category: v.category,
  seats: v.seats,
  doors: v.doors,
  mileage_km: v.mileage_km,
  features: v.features,
});

export const pricingPayload = (v: WizardValues) => ({
  daily_price_mad: v.daily_price_mad,
  hourly_price_mad: v.hourly_price_mad,
  weekly_discount_pct: v.weekly_discount_pct,
  monthly_discount_pct: v.monthly_discount_pct,
  deposit_mad: v.deposit_mad,
  min_days: v.min_days,
  km_per_day: v.km_per_day,
  extra_km_fee_mad: v.extra_km_fee_mad,
  instant_book: v.instant_book,
  cash_allowed: v.cash_allowed,
});

export const locationPayload = (v: WizardValues) => ({
  city_slug: v.city_slug,
  neighborhood: v.neighborhood,
  address: v.address,
  lat: v.lat,
  lng: v.lng,
  delivery_available: v.delivery_available,
  delivery_fee_mad: v.delivery_fee_mad,
  delivery_radius_km: v.delivery_radius_km,
  airport_slugs: v.airport_slugs,
  airport_fee_mad: v.airport_fee_mad,
});

export const detailsPayload = (v: WizardValues) => ({ title: v.title, description: v.description });
