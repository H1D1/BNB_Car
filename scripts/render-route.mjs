// Renders the "Tangier → Dakhla" film (Remotion composition RouteJourney) for each locale into
// public/media/route-journey-<locale>.mp4 (+ a poster). Counts and city names come from the DB.
//
// Remotion renders a JPEG frame sequence into .cache/render, and the bundled ffmpeg-static
// encodes it. This skips Remotion's own stitching step, which keeps its temp files in the OS
// temp folder (on Windows, antivirus/cleanup tools can delete them mid-render).
//
// Usage: npm run render:route            (all locales)
//        npm run render:route -- fr      (only French)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ['fr', 'ar', 'en'];
const STOPS = ['tangier', 'rabat', 'casablanca', 'marrakech', 'agadir', 'dakhla'];
const FPS = 30;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: counts } = await db.query(`select city_slug, count(*)::int n from cars where status = 'active' group by 1`);
const { rows: places } = await db.query(`select slug, name_fr, name_ar, name_en from places where slug = any($1)`, [STOPS]);
await db.end();

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

for (const locale of locales) {
  const work = path.join('.cache', 'render', locale);
  const frames = path.join(work, 'frames');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const props = {
    locale,
    token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    counts: Object.fromEntries(STOPS.map((s) => [s, counts.find((c) => c.city_slug === s)?.n ?? 0])),
    names: Object.fromEntries(places.map((p) => [p.slug, p[`name_${locale}`]])),
  };
  const propsFile = path.join(work, 'props.json');
  writeFileSync(propsFile, JSON.stringify(props));

  console.log(`\n▶ ${locale}: rendering frames…`);
  run(npx, ['remotion', 'render', 'src/remotion/index.ts', 'RouteJourney', frames, '--sequence', '--image-format=jpeg', '--jpeg-quality=92', `--props=${propsFile}`, '--gl=angle', '--concurrency=2']);

  // Remotion names frames like element-000.jpeg / element-0000.jpeg depending on the frame count.
  const files = readdirSync(frames).filter((f) => f.endsWith('.jpeg')).sort();
  if (!files.length) throw new Error(`No frames rendered for ${locale}`);
  const m = files[0].match(/^(.*?)(\d+)\.jpeg$/);
  const pattern = path.join(frames, `${m[1]}%0${m[2].length}d.jpeg`);

  console.log(`▶ ${locale}: encoding ${files.length} frames…`);
  run(ffmpeg, ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-start_number', String(Number(m[2])), '-i', pattern, '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `public/media/route-journey-${locale}.mp4`]);
  run(ffmpeg, ['-loglevel', 'error', '-y', '-i', path.join(frames, files[files.length - 1]), '-vf', 'scale=1280:-2', '-q:v', '4', `public/media/route-journey-${locale}.jpg`]);
  rmSync(frames, { recursive: true, force: true });
  console.log(`✓ public/media/route-journey-${locale}.mp4`);
}
