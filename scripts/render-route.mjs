// Renders the "Tangier → Dakhla" film (Remotion composition RouteJourney) for each locale into
// public/media/route-journey-<locale>.mp4 (+ a poster). Counts and city names come from the DB.
// Usage: node scripts/render-route.mjs [fr ar en]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ['fr', 'ar', 'en'];
const STOPS = ['tangier', 'rabat', 'casablanca', 'marrakech', 'agadir', 'dakhla'];

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: counts } = await db.query(`select city_slug, count(*)::int n from cars where status = 'active' group by 1`);
const { rows: places } = await db.query(`select slug, name_fr, name_ar, name_en from places where slug = any($1)`, [STOPS]);
await db.end();

mkdirSync('.cache/render', { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const locale of locales) {
  const props = {
    locale,
    token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    counts: Object.fromEntries(STOPS.map((s) => [s, counts.find((c) => c.city_slug === s)?.n ?? 0])),
    names: Object.fromEntries(places.map((p) => [p.slug, p[`name_${locale}`]])),
  };
  const propsFile = `.cache/render/props-${locale}.json`;
  writeFileSync(propsFile, JSON.stringify(props));
  const raw = `.cache/render/route-${locale}.mp4`;
  console.log(`\n▶ ${locale}: rendering…`);
  execFileSync(npx, ['remotion', 'render', 'src/remotion/index.ts', 'RouteJourney', raw, `--props=${propsFile}`, '--gl=angle', '--codec=h264', '--crf=18', '--concurrency=2'], { stdio: 'inherit', shell: process.platform === 'win32' });
  // web encode: 1280px, ~2 MB
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', raw, '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `public/media/route-journey-${locale}.mp4`]);
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-sseof', '-0.5', '-i', raw, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '4', `public/media/route-journey-${locale}.jpg`]);
  console.log(`✓ public/media/route-journey-${locale}.mp4`);
}
