import geo from "@/lib/route-geo.json";

/**
 * Scroll → journey maths for the "Tangier to Dakhla" story map.
 * Route geometry: real driving route from the Mapbox Directions API (scripts/build-route.mjs),
 * simplified and stored statically, so no API call happens at runtime.
 *
 * Fractions along the road are measured in Web-Mercator distance so they match Mapbox GL's
 * `line-progress` exactly (the drawn line trims to where the car is). Kilometres shown to the
 * user use true (geodesic) distance.
 */
type LngLat = [number, number];

const ORDER = ["tangier", "rabat", "casablanca", "marrakech", "agadir", "dakhla"] as const;
export type StopSlug = (typeof ORDER)[number];

const toRad = (d: number) => (d * Math.PI) / 180;
const merc = ([lng, lat]: LngLat) => [toRad(lng), Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))];
function km(a: LngLat, b: LngLat) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}
function bearingOf(a: LngLat, b: LngLat) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const coords = geo.coordinates as LngLat[];
const cumM = [0]; // mercator distance
const cumKm = [0]; // geodesic distance
for (let i = 1; i < coords.length; i++) {
  const [ax, ay] = merc(coords[i - 1]);
  const [bx, by] = merc(coords[i]);
  cumM.push(cumM[i - 1] + Math.hypot(bx - ax, by - ay));
  cumKm.push(cumKm[i - 1] + km(coords[i - 1], coords[i]));
}
const totalM = cumM[cumM.length - 1];
const cities = geo.cities as Record<StopSlug, LngLat>;
const stops = ORDER.map((slug) => {
  let best = 0;
  let bestD = Infinity;
  coords.forEach((c, i) => {
    const d = km(c, cities[slug]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return cumM[best] / totalM;
});

export const ROUTE = { coords, cities, order: ORDER, stops, totalKm: geo.totalKm as number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type RouteState = {
  f: number; // fraction of road travelled (mercator length, = Mapbox line-progress)
  position: LngLat;
  bearing: number;
  reached: StopSlug[];
  active: StopSlug;
  leg: number;
  legT: number; // 0..1 within the current leg
  km: number;
  overview: number; // 1 = whole-country view (intro / finale), 0 = following the car
};

/** Scroll progress (0..1) → journey state. Equal scroll per leg, with a dwell at each city. */
export function routeState(progress: number): RouteState {
  const INTRO = 0.06;
  const OUTRO = 0.9;
  const legs = ORDER.length - 1;
  const q = clamp((progress - INTRO) / (OUTRO - INTRO)) * legs;
  const leg = Math.min(legs - 1, Math.floor(q));
  const legT = clamp((q - leg - 0.15) / 0.7);
  const f = lerp(stops[leg], stops[leg + 1], smooth(legT));

  const target = f * totalM;
  let i = 1;
  while (i < cumM.length - 1 && cumM[i] < target) i++;
  const segT = cumM[i] === cumM[i - 1] ? 0 : (target - cumM[i - 1]) / (cumM[i] - cumM[i - 1]);
  const position: LngLat = [lerp(coords[i - 1][0], coords[i][0], segT), lerp(coords[i - 1][1], coords[i][1], segT)];
  const look = coords[Math.min(coords.length - 1, i + 2)];

  const reached = ORDER.filter((_, k) => f >= stops[k] - 0.002);
  const intro = 1 - smooth(clamp(progress / INTRO));
  const outro = smooth(clamp((progress - OUTRO) / (1 - OUTRO - 0.02)));
  return {
    f,
    position,
    bearing: bearingOf(position, look),
    reached,
    active: reached[reached.length - 1] ?? "tangier",
    leg,
    legT,
    km: Math.round(lerp(cumKm[i - 1], cumKm[i], segT) * (ROUTE.totalKm / cumKm[cumKm.length - 1])),
    overview: Math.max(intro, outro),
  };
}

export const OVERVIEW_CENTER: LngLat = [-10.2, 29.6];
export const overviewZoom = (mobile: boolean) => (mobile ? 4.1 : 4.85);

/**
 * Camera: close-ish on cities, pulled back mid-leg (more on the long Sahara leg), whole country
 * at intro/outro. Zoom is capped and pitch kept moderate so few tiles are needed while moving.
 */
export function cameraAt(s: RouteState, mobile: boolean) {
  const longLeg = s.leg === ROUTE.order.length - 2;
  const zCity = mobile ? 7.2 : 7.7;
  const zMid = longLeg ? (mobile ? 4.9 : 5.3) : mobile ? 6.2 : 6.6;
  const follow = { zoom: lerp(zCity, zMid, Math.sin(Math.PI * s.legT)), pitch: mobile ? 28 : 38 };
  const w = s.overview;
  return {
    center: [lerp(s.position[0], OVERVIEW_CENTER[0], w), lerp(s.position[1], OVERVIEW_CENTER[1], w)] as LngLat,
    zoom: lerp(follow.zoom, overviewZoom(mobile), w),
    pitch: lerp(follow.pitch, 0, w),
  };
}
