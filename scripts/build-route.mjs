// Regenerates src/lib/route-geo.json: the real driving route Tangier → Rabat → Casablanca →
// Marrakech → Agadir → Dakhla from the Mapbox Directions API, simplified for the story map.
// Run once when the route changes: node scripts/build-route.mjs
import { writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
const cities = {
  tangier: [-5.834, 35.7595], rabat: [-6.8416, 34.0209], casablanca: [-7.5898, 33.5731],
  marrakech: [-7.9811, 31.6295], agadir: [-9.5981, 30.4278], dakhla: [-15.958, 23.6848],
};
const coords = Object.values(cities).map((c) => c.join(',')).join(';');
const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`);
const route = (await res.json()).routes[0];

// Douglas–Peucker simplification (~400 m tolerance) keeps the file small.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.hypot(b[1] - a[1], b[0] - a[0]);
    if (d > max) { max = d; idx = i; }
  }
  return max > eps ? [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)] : [a, b];
}
const pts = simplify(route.geometry.coordinates, 0.004).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
await writeFile('src/lib/route-geo.json', JSON.stringify({ coordinates: pts, cities, legKm: route.legs.map((l) => Math.round(l.distance / 1000)), totalKm: Math.round(route.distance / 1000) }));
console.log(`${pts.length} points, ${Math.round(route.distance / 1000)} km`);
