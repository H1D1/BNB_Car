// Mapbox: raster tiles for Leaflet + Geocoding v6 for suggestions / reverse lookup.
// The public (pk.) token is safe to ship to the browser; restrict it to your domains in the Mapbox dashboard.
import type { Locale, Place } from "./types";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const mapboxTiles = (theme: "light" | "dark") =>
  `https://api.mapbox.com/styles/v1/mapbox/${theme === "light" ? "light-v11" : "dark-v11"}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
export const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type GeoResult = {
  id: string;
  name: string;
  fullAddress: string;
  type: string; // address | street | neighborhood | locality | place | poi | ...
  lat: number;
  lng: number;
  city?: string;
  neighborhood?: string;
};

type V6Feature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    name: string;
    full_address?: string;
    place_formatted?: string;
    feature_type: string;
    context?: Record<string, { name: string } | undefined>;
  };
};

const BASE = "https://api.mapbox.com/search/geocode/v6";
// Geocoding v6 rejects the whole request on an unknown type (e.g. "poi"), so filter defensively.
// POI coverage for Morocco is thin in Mapbox; addresses, streets and neighbourhoods are reliable.
const V6_TYPES = new Set(["country", "region", "postcode", "district", "place", "locality", "neighborhood", "street", "block", "address", "secondary_address"]);
const lang = (l: Locale) => (l === "ar" ? "ar" : l === "en" ? "en" : "fr");

function toResult(f: V6Feature): GeoResult {
  const ctx = f.properties.context ?? {};
  return {
    id: f.id,
    name: f.properties.name,
    fullAddress: f.properties.full_address ?? [f.properties.name, f.properties.place_formatted].filter(Boolean).join(", "),
    type: f.properties.feature_type,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    city: ctx.place?.name,
    neighborhood: ctx.neighborhood?.name ?? ctx.locality?.name,
  };
}

/** Forward geocoding with autocomplete, restricted to Morocco. */
export async function geocode(
  q: string,
  locale: Locale,
  opts: { proximity?: { lat: number; lng: number }; types?: string; signal?: AbortSignal } = {},
): Promise<GeoResult[]> {
  if (!MAPBOX_TOKEN || q.trim().length < 2) return [];
  const params = new URLSearchParams({
    q,
    country: "ma",
    autocomplete: "true",
    language: lang(locale),
    limit: "6",
    access_token: MAPBOX_TOKEN,
  });
  const types = opts.types?.split(",").map((t) => t.trim()).filter((t) => V6_TYPES.has(t)).join(",");
  if (types) params.set("types", types);
  if (opts.proximity) params.set("proximity", `${opts.proximity.lng},${opts.proximity.lat}`);
  const res = await fetch(`${BASE}/forward?${params}`, { signal: opts.signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { features: V6Feature[] };
  return json.features.map(toResult);
}

export async function reverseGeocode(lat: number, lng: number, locale: Locale): Promise<GeoResult | null> {
  if (!MAPBOX_TOKEN) return null;
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    language: lang(locale),
    limit: "1",
    access_token: MAPBOX_TOKEN,
  });
  const res = await fetch(`${BASE}/reverse?${params}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { features: V6Feature[] };
  return json.features[0] ? toResult(json.features[0]) : null;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Closest supported city for a coordinate (used to tag listings and searches). */
export function nearestCity(lat: number, lng: number, places: Place[]) {
  let best: Place | undefined;
  let bestD = Infinity;
  for (const p of places) {
    if (p.kind !== "city") continue;
    const d = distanceKm({ lat, lng }, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best ? { place: best, km: bestD } : null;
}
