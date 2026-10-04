// Licence-plate → vehicle lookup used by the listing wizard.
//
// MOCK PROVIDER. Morocco has no public vehicle-registry API; in production swap
// `plateProvider` for a real integration (e.g. NARSA / Ministry of Transport registry
// access via a partner, or an insurer's vehicle API such as the "carte grise" data
// returned when quoting an assurance auto). Keep the PlateLookupProvider interface so
// the wizard doesn't change.
import type { CarCategory, FuelType, Transmission } from "../types";

export type PlateVehicle = {
  make: string;
  model: string;
  year: number;
  transmission: Transmission;
  fuel: FuelType;
  category: CarCategory;
  seats: number;
  doors: number;
};

export interface PlateLookupProvider {
  readonly name: string;
  lookup(plate: string): Promise<PlateVehicle | null>;
}

/** Normalises "12345-أ-6", "12345 A 6", "12345|ب|1"… to "12345-X-6" (letter kept as typed). */
export function normalizePlate(raw: string) {
  const cleaned = raw.trim().replace(/[\s|/_.]+/g, "-").replace(/-+/g, "-").toUpperCase();
  return cleaned.slice(0, 20);
}

/** Moroccan plates: 1–5 digits, an Arabic (or transliterated Latin) letter, a 1–2 digit prefecture code. */
export const PLATE_RE = /^\d{1,5}-[؀-ۿA-Z]{1,2}-\d{1,2}$/;

const CATALOGUE: Omit<PlateVehicle, "year">[] = [
  { make: "Dacia", model: "Logan", transmission: "manual", fuel: "diesel", category: "city", seats: 5, doors: 4 },
  { make: "Dacia", model: "Sandero", transmission: "manual", fuel: "diesel", category: "city", seats: 5, doors: 5 },
  { make: "Dacia", model: "Sandero Stepway", transmission: "manual", fuel: "gasoline", category: "compact", seats: 5, doors: 5 },
  { make: "Dacia", model: "Duster", transmission: "manual", fuel: "diesel", category: "suv", seats: 5, doors: 5 },
  { make: "Dacia", model: "Lodgy", transmission: "manual", fuel: "diesel", category: "van", seats: 7, doors: 5 },
  { make: "Renault", model: "Clio", transmission: "manual", fuel: "diesel", category: "city", seats: 5, doors: 5 },
  { make: "Renault", model: "Mégane", transmission: "automatic", fuel: "diesel", category: "compact", seats: 5, doors: 5 },
  { make: "Peugeot", model: "208", transmission: "manual", fuel: "gasoline", category: "city", seats: 5, doors: 5 },
  { make: "Peugeot", model: "301", transmission: "manual", fuel: "diesel", category: "sedan", seats: 5, doors: 4 },
  { make: "Peugeot", model: "3008", transmission: "automatic", fuel: "diesel", category: "suv", seats: 5, doors: 5 },
  { make: "Hyundai", model: "Accent", transmission: "automatic", fuel: "gasoline", category: "sedan", seats: 5, doors: 4 },
  { make: "Hyundai", model: "Tucson", transmission: "automatic", fuel: "diesel", category: "suv", seats: 5, doors: 5 },
  { make: "Kia", model: "Picanto", transmission: "manual", fuel: "gasoline", category: "city", seats: 4, doors: 5 },
  { make: "Toyota", model: "Yaris", transmission: "automatic", fuel: "hybrid", category: "city", seats: 5, doors: 5 },
];

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** Deterministic mock: ~4 in 5 well-formed plates resolve to a plausible Moroccan car. */
export const mockPlateProvider: PlateLookupProvider = {
  name: "mock",
  async lookup(plate) {
    const p = normalizePlate(plate);
    if (!PLATE_RE.test(p)) return null;
    const h = hash(p);
    if (h % 5 === 0) return null; // simulate "not found"
    const base = CATALOGUE[h % CATALOGUE.length];
    const year = 2012 + ((h >>> 8) % 13); // 2012–2024
    return { ...base, year };
  },
};

export const plateProvider: PlateLookupProvider = mockPlateProvider;
