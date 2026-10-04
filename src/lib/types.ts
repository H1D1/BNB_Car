export type Locale = "fr" | "ar" | "en";
export type UserMode = "renter" | "host";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type DocType = "cin" | "passport" | "license_ma" | "license_intl";
export type Transmission = "manual" | "automatic";
export type FuelType = "diesel" | "gasoline" | "hybrid" | "electric";
export type CarCategory = "city" | "compact" | "sedan" | "suv" | "luxury" | "van";
export type CarStatus = "draft" | "active" | "paused";
export type PhotoKind = "exterior" | "interior" | "odometer" | "other";
export type RentalType = "daily" | "hourly";
export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled" | "declined";
export type PaymentMethod = "cmi" | "card" | "cash";
export type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded" | "failed";
export type InsurancePlan = "none" | "basic" | "premium";
export type DeliveryOption = "pickup" | "address" | "airport";
export type DisputeType = "late_return" | "damage" | "mileage" | "cleanliness" | "fuel" | "other";
export type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  city_slug: string | null;
  phone_verified: boolean;
  preferred_locale: Locale;
  active_mode: UserMode;
  is_host: boolean;
  id_status: VerificationStatus;
  license_status: VerificationStatus;
  host_rating: number | null;
  host_review_count: number;
  renter_rating: number | null;
  renter_review_count: number;
  trips_completed: number;
  created_at: string;
}

export interface Place {
  slug: string;
  kind: "city" | "airport" | "station";
  city_slug: string;
  name_fr: string;
  name_ar: string;
  name_en: string;
  iata: string | null;
  lat: number;
  lng: number;
  popular: boolean;
  sort: number;
}

export interface Car {
  id: string;
  host_id: string;
  status: CarStatus;
  plate: string | null;
  make: string;
  model: string;
  year: number;
  transmission: Transmission;
  fuel: FuelType;
  category: CarCategory;
  seats: number;
  doors: number;
  mileage_km: number;
  features: string[];
  daily_price_mad: number;
  hourly_price_mad: number | null;
  weekly_discount_pct: number;
  monthly_discount_pct: number;
  deposit_mad: number;
  min_days: number;
  instant_book: boolean;
  cash_allowed: boolean;
  km_per_day: number;
  extra_km_fee_mad: number;
  city_slug: string;
  neighborhood: string | null;
  address: string | null;
  lat: number;
  lng: number;
  delivery_available: boolean;
  delivery_fee_mad: number;
  delivery_radius_km: number;
  airport_slugs: string[];
  airport_fee_mad: number;
  title: string | null;
  description: Partial<Record<Locale, string>>;
  cover_url: string | null;
  rating: number | null;
  review_count: number;
  trip_count: number;
  created_at: string;
}

export interface CarPhoto {
  id: string;
  car_id: string;
  url: string;
  storage_path: string | null;
  kind: PhotoKind;
  position: number;
  credit: string | null;
}

export interface Booking {
  id: string;
  reference: string;
  car_id: string;
  renter_id: string;
  host_id: string;
  rental_type: RentalType;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  instant: boolean;
  delivery_option: DeliveryOption;
  delivery_address: string | null;
  airport_slug: string | null;
  insurance_plan: InsurancePlan;
  units: number;
  unit_price_mad: number;
  rental_fee_mad: number;
  discount_mad: number;
  delivery_fee_mad: number;
  insurance_fee_mad: number;
  service_fee_mad: number;
  total_mad: number;
  deposit_mad: number;
  host_payout_mad: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  km_included: number;
  extra_km_fee_mad: number;
  renter_message: string | null;
  contract_accepted_at: string | null;
  contract_snapshot: Record<string, unknown> | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  refund_mad: number | null;
  confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface Quote {
  units: number;
  unit_price: number;
  rental_fee: number;
  discount: number;
  delivery_fee: number;
  insurance_fee: number;
  service_fee: number;
  total: number;
  deposit: number;
  host_payout: number;
  km_included: number;
  extra_km_fee: number;
  instant: boolean;
}

export interface Review {
  id: string;
  booking_id: string;
  car_id: string;
  author_id: string;
  subject_id: string;
  direction: "renter_to_host" | "host_to_renter";
  rating: number;
  cleanliness: number | null;
  communication: number | null;
  accuracy: number | null;
  comment: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  lang: string | null;
  translations: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  booking_id: string;
  opened_by: string;
  against_id: string;
  type: DisputeType;
  amount_claimed_mad: number | null;
  description: string;
  evidence_paths: string[];
  status: DisputeStatus;
  resolution: string | null;
  resolved_amount_mad: number | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by server actions used with useActionState. */
export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
