// TEST DATA ONLY — gives the demo cars real used-car listings from avito.ma.
//
// Source: avito.ma public search pages saved in .cache/avito-p*.html (gitignored). The site sits
// behind Cloudflare bot protection, so this script makes NO requests to Avito: it parses the saved
// pages, and photos are *linked* to Avito's image CDN (loaded by the visitor's browser, see
// src/components/ui/SmartImage.tsx) rather than downloaded or re-hosted.
//
// - Only vehicle facts are used (title, year, mileage, gearbox, fuel, city, equipment, photo links).
//   Seller names/phones and seller-written descriptions are NOT copied.
// - Photos belong to their owners: keep this data out of any public/production deployment.
// - Car rows are updated in place, so hosts, bookings and reviews stay attached.
//
// Usage: npm run db:import-avito
//        npm run db:seed -- --force   (restore the original demo catalogue)
import pg from 'pg';
import { refuseProduction } from './env.mjs';
import { readdir, readFile } from 'node:fs/promises';

const CACHE_DIR = '.cache';
const PHOTOS_PER_CAR = 6;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Avito city → our places.slug
const CITY_MAP = {
  casablanca: 'casablanca', mohammedia: 'casablanca', settat: 'casablanca', berrechid: 'casablanca', bouskoura: 'casablanca',
  rabat: 'rabat', 'salé': 'rabat', sale: 'rabat', 'témara': 'rabat', temara: 'rabat', 'kénitra': 'rabat', kenitra: 'rabat',
  marrakech: 'marrakech', tanger: 'tangier', 'tétouan': 'tetouan', tetouan: 'tetouan', agadir: 'agadir', 'fès': 'fes', fes: 'fes',
  'meknès': 'meknes', meknes: 'meknes', oujda: 'oujda', 'el jadida': 'el-jadida', essaouira: 'essaouira',
  ouarzazate: 'ouarzazate', dakhla: 'dakhla', chefchaouen: 'chefchaouen',
};

const BRANDS = [
  'Mercedes-Benz', 'Mercedes', 'Land Rover', 'Range Rover', 'Alfa Romeo', 'Volkswagen', 'VW', 'Dacia', 'Renault', 'Peugeot',
  'Citroën', 'Citroen', 'Hyundai', 'Kia', 'Toyota', 'Ford', 'Fiat', 'Opel', 'Nissan', 'Skoda', 'Seat', 'Cupra', 'BMW', 'Audi',
  'Porsche', 'Jeep', 'Suzuki', 'Mitsubishi', 'Mazda', 'Honda', 'Chevrolet', 'Volvo', 'Lexus', 'Jaguar', 'Mini', 'DS', 'Chery',
  'Geely', 'MG', 'BYD', 'Haval', 'Changan', 'Tesla', 'Smart', 'Isuzu', 'Jetour', 'Omoda',
];
const EXOTIC = /bentley|rolls|ferrari|lamborghini|maserati|aston|mclaren|bugatti/i;
const STOP = /^(diesel|essence|hybride|hybrid|électrique|electrique|automatique|manuelle|boite|bva|bvm|full|option|options|pack|toutes|tt|neuve?|dédouanée|dedouanee|ww|\d{4}|\d[.,]\d|\d+ch|tdi|dci|hdi|cdi|tce|tsi|tfsi|puretech|bluehdi|crdi|gti?|line|amg|sport|edition|premium|ultimate|plus|confort|black|blanche?|noire?|new|nouvelle|nouveau)$/i;

function parseTitle(title) {
  const clean = title.replace(/\s+/g, ' ').trim();
  const brand = BRANDS.find((b) => clean.toLowerCase().startsWith(b.toLowerCase() + ' '));
  if (!brand) return null;
  const rest = clean.slice(brand.length).trim().split(' ');
  const model = [];
  for (const w of rest) {
    if (STOP.test(w) || model.length >= 2) break;
    model.push(w);
    if (!/^(classe|série|serie|range|grand|model)$/i.test(w)) break;
  }
  if (!model.length) return null;
  const norm = { Mercedes: 'Mercedes-Benz', VW: 'Volkswagen', Citroen: 'Citroën' };
  // "CLASSE E" → "Classe E", "YARIS" → "Yaris"; keep codes like "X4M", "C5", "T-Roc"
  const nice = (w) => (/^[A-ZÀ-Ý-]{3,}$/.test(w) && !/\d/.test(w) ? w[0] + w.slice(1).toLowerCase() : w);
  const m = model.map(nice).join(' ');
  return { make: norm[brand] ?? brand, model: m[0].toUpperCase() + m.slice(1) };
}

function categoryOf(make, model, year) {
  const m = `${make} ${model}`.toLowerCase();
  if (/classe v|lodgy|vito|kangoo|berlingo|partner|trafic|caddy|dokker|rifter|transporter|staria|h-1|carnival|sharan|touran|5008/.test(m)) return 'van';
  if (/porsche|range rover|land rover|lexus|jaguar|tesla|classe (e|s|g)|série (5|7)|x5|x6|x7|q7|q8|a6|a8|gle|gls|cayenne|macan/.test(m)) return 'luxury';
  if (/xc40|xc60|xc90|duster|tucson|sportage|kadjar|captur|3008|2008|tiguan|t-roc|touareg|qashqai|juke|kuga|cr-v|rav4|prado|land cruiser|santa fe|sorento|x1|x3|q3|q5|gla|glc|glb|evoque|stelvio|jeep|wrangler|compass|creta|seltos|stonic|niro|austral|arkana|kona|bayon|c-hr|haval|tiggo|ateca|karoq|kodiaq|x-trail|outlander|asx|hilux|ranger|d-max|kodiaq|jogger|bigster|sorento|ev6|ioniq 5/.test(m)) return 'suv';
  if (/(mercedes-benz|bmw|audi)/.test(m) && year >= 2018 && !/classe a|série 1|a1|a3|1er/.test(m)) return 'luxury';
  if (/logan|sandero|clio|208|i10|i20|picanto|polo|yaris|500|c3|ibiza|corsa|micra|swift|aygo|up|twingo|rio|celerio|spark|fabia|208|107|108|c1|panda|tipo/.test(m)) return 'city';
  if (/accent|elantra|corolla|301|c-elysée|c-elysee|octavia|passat|classe c|série 3|a4|jetta|cerato|k5|sonata|camry|superb|mégane sedan|taliant|symbol|s60|508|insignia|civic/.test(m)) return 'sedan';
  return 'compact';
}

const BASE_PRICE = { city: 260, compact: 330, sedan: 380, suv: 520, van: 480, luxury: 1200 };
const priceFor = (cat, year) => {
  const p = BASE_PRICE[cat] * (1 + Math.max(-0.3, Math.min(0.5, (year - 2018) * 0.05)));
  return Math.min(5000, Math.round(p / 10) * 10);
};

const FEATURE_MAP = {
  car_ac: 'ac', cd_mp3_bt: 'bluetooth', car_reverse_camera: 'backup_camera', car_navigation: 'gps', car_cruise_control: 'cruise_control',
};

const descFor = (make, model, cityFr, cityEn, cityAr) => ({
  fr: `${make} ${model} bien entretenue, idéale pour circuler à ${cityFr} et partir en escapade. Merci de rendre la voiture avec le même niveau de carburant.`,
  en: `Well-maintained ${make} ${model}, perfect for getting around ${cityEn} and weekend getaways. Please return it with the same fuel level.`,
  ar: `${make} ${model} في حالة جيدة، مثالية للتنقل في ${cityAr} والرحلات. المرجو إرجاع السيارة بنفس مستوى الوقود.`,
});

async function readListings() {
  const out = new Map();
  const files = (await readdir(CACHE_DIR)).filter((f) => /^avito-p\d+\.html$/.test(f)).sort();
  if (!files.length) throw new Error(`No saved Avito pages in ${CACHE_DIR}/ (expected avito-p1.html, ...)`);
  for (const file of files) {
    const html = await readFile(`${CACHE_DIR}/${file}`, 'utf8');
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) continue;
    const details = JSON.parse(m[1])?.props?.pageProps?.componentProps?.facetedSearchResponse?.ads?.details ?? [];
    for (const d of details) {
      const images = (d.media?.media?.images ?? []).map((i) => i.paths?.standard).filter(Boolean);
      const param = (id) => (d.params?.secondary ?? []).find((x) => x.id === id);
      const year = Number(param('regdate')?.textValue);
      const parsed = parseTitle(d.title ?? '');
      const city = CITY_MAP[(d.location?.city?.name ?? '').toLowerCase()];
      if (!parsed || !city || images.length < 3 || !(year >= 2012) || EXOTIC.test(d.title)) continue;
      out.set(d.adId, {
        id: d.adId,
        ...parsed,
        year,
        mileage: Number(param('mileage_exact')?.numericValue ?? 0),
        transmission: /auto/i.test(param('bv')?.textValue ?? '') ? 'automatic' : 'manual',
        fuel: /hybr/i.test(param('fuel')?.textValue ?? '') ? 'hybrid' : /lectr/i.test(param('fuel')?.textValue ?? '') ? 'electric' : /essence/i.test(param('fuel')?.textValue ?? '') ? 'gasoline' : 'diesel',
        features: [...new Set((d.params?.extra ?? []).filter((e) => e.booleanValue).map((e) => FEATURE_MAP[e.id]).filter(Boolean))],
        city,
        images: images.slice(0, PHOTOS_PER_CAR),
      });
    }
    console.log(`${file}: ${out.size} usable listings so far`);
  }
  return [...out.values()];
}

/** Spread picks across makes so the catalogue isn't 20 identical Dacias. */
function diversify(listings, n) {
  const byMake = new Map();
  for (const l of listings) (byMake.get(l.make) ?? byMake.set(l.make, []).get(l.make)).push(l);
  const picked = [];
  while (picked.length < n && [...byMake.values()].some((a) => a.length)) {
    for (const arr of byMake.values()) if (arr.length && picked.length < n) picked.push(arr.shift());
  }
  return picked;
}

async function main() {
  await db.connect();
  await refuseProduction(db, 'the Avito import');

  const { rows: cars } = await db.query(`
    select c.id, c.host_id, c.airport_slugs from cars c
    join auth.users u on u.id = c.host_id
    where u.email like '%@demo.carshare.ma' order by c.created_at`);
  const { rows: places } = await db.query('select * from places');
  const placeBy = Object.fromEntries(places.map((p) => [p.slug, p]));
  const airportsBy = {};
  for (const p of places) if (p.kind === 'airport') (airportsBy[p.city_slug] ??= []).push(p.slug);

  const listings = diversify(await readListings(), cars.length);
  console.log(`using ${listings.length} listings for ${cars.length} demo cars`);

  for (const [i, car] of cars.entries()) {
    const l = listings[i];
    if (!l) break;
    const city = placeBy[l.city];
    const category = categoryOf(l.make, l.model, l.year);

    const photos = l.images.map((u) => u.replace(/\?t=.*$/, '?t=images'));
    await db.query('begin');
    await db.query('delete from car_photos where car_id = $1', [car.id]);
    for (const [pos, url] of photos.entries()) {
      await db.query('insert into car_photos (car_id, url, storage_path, kind, position, credit) values ($1,$2,null,$3,$4,$5)', [
        car.id, url, 'exterior', pos, 'Photo: avito.ma (test data)',
      ]);
    }
    const daily = priceFor(category, l.year);
    await db.query(
      `update cars set make=$2, model=$3, year=$4, transmission=$5, fuel=$6, category=$7, mileage_km=$8,
         features=$9, daily_price_mad=$10, hourly_price_mad=$11, deposit_mad=$12, seats=$13, doors=$14,
         city_slug=$15, neighborhood=null, address=$16, lat=$17, lng=$18,
         airport_slugs=$19, title=$20, description=$21, cover_url=$22, status='active'
       where id=$1`,
      [
        car.id, l.make, l.model, l.year, l.transmission, l.fuel, category, l.mileage,
        [...new Set(['ac', ...l.features])], daily, category === 'city' ? Math.round(daily / 6 / 5) * 5 : null,
        category === 'luxury' ? 15000 : category === 'suv' ? 6000 : 3000, category === 'van' ? 7 : 5, category === 'van' ? 5 : 5,
        l.city, city.name_fr, city.lat + (Math.random() - 0.5) * 0.06, city.lng + (Math.random() - 0.5) * 0.06,
        car.airport_slugs.length ? (airportsBy[l.city] ?? []) : [], `${l.make} ${l.model} ${l.year}`,
        descFor(l.make, l.model, city.name_fr, city.name_en, city.name_ar), photos[0],
      ],
    );
    await db.query('commit');
    console.log(`✓ ${l.make} ${l.model} ${l.year} · ${l.city} · ${category} · ${daily} MAD · ${photos.length} photos`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
