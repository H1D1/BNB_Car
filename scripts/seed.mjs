// Seeds places, demo users, cars, past trips and reviews.
// Usage: npm run db:seed            (only if no cars exist yet)
//        npm run db:seed -- --force (wipes cars/bookings/reviews first)
import pg from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });

const force = process.argv.includes('--force');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Deterministic PRNG so re-seeding gives the same catalogue.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));

const PLACES = [
  // slug, kind, city, fr, ar, en, iata, lat, lng, popular, sort
  ['casablanca', 'city', 'casablanca', 'Casablanca', 'الدار البيضاء', 'Casablanca', null, 33.5731, -7.5898, true, 1],
  ['marrakech', 'city', 'marrakech', 'Marrakech', 'مراكش', 'Marrakesh', null, 31.6295, -7.9811, true, 2],
  ['rabat', 'city', 'rabat', 'Rabat', 'الرباط', 'Rabat', null, 34.0209, -6.8416, true, 3],
  ['tangier', 'city', 'tangier', 'Tanger', 'طنجة', 'Tangier', null, 35.7595, -5.834, true, 4],
  ['agadir', 'city', 'agadir', 'Agadir', 'أكادير', 'Agadir', null, 30.4278, -9.5981, true, 5],
  ['fes', 'city', 'fes', 'Fès', 'فاس', 'Fez', null, 34.0181, -5.0078, true, 6],
  ['essaouira', 'city', 'essaouira', 'Essaouira', 'الصويرة', 'Essaouira', null, 31.5085, -9.7595, false, 7],
  ['chefchaouen', 'city', 'chefchaouen', 'Chefchaouen', 'شفشاون', 'Chefchaouen', null, 35.1688, -5.2636, false, 8],
  ['ouarzazate', 'city', 'ouarzazate', 'Ouarzazate', 'ورزازات', 'Ouarzazate', null, 30.9335, -6.937, false, 9],
  ['tetouan', 'city', 'tetouan', 'Tétouan', 'تطوان', 'Tetouan', null, 35.5785, -5.3684, false, 10],
  ['meknes', 'city', 'meknes', 'Meknès', 'مكناس', 'Meknes', null, 33.8935, -5.5473, false, 11],
  ['el-jadida', 'city', 'el-jadida', 'El Jadida', 'الجديدة', 'El Jadida', null, 33.2316, -8.5007, false, 12],
  ['oujda', 'city', 'oujda', 'Oujda', 'وجدة', 'Oujda', null, 34.6814, -1.9086, false, 13],
  ['dakhla', 'city', 'dakhla', 'Dakhla', 'الداخلة', 'Dakhla', null, 23.6848, -15.958, false, 14],
  ['cmn', 'airport', 'casablanca', 'Aéroport Mohammed V', 'مطار محمد الخامس الدولي', 'Mohammed V Airport', 'CMN', 33.3675, -7.5899, true, 20],
  ['rak', 'airport', 'marrakech', 'Aéroport Marrakech Menara', 'مطار مراكش المنارة', 'Marrakesh Menara Airport', 'RAK', 31.6069, -8.0363, true, 21],
  ['rba', 'airport', 'rabat', 'Aéroport Rabat-Salé', 'مطار الرباط سلا', 'Rabat–Salé Airport', 'RBA', 34.0515, -6.7515, false, 22],
  ['tng', 'airport', 'tangier', 'Aéroport Tanger Ibn Battouta', 'مطار طنجة ابن بطوطة', 'Tangier Ibn Battuta Airport', 'TNG', 35.7269, -5.9169, true, 23],
  ['aga', 'airport', 'agadir', 'Aéroport Agadir Al Massira', 'مطار أكادير المسيرة', 'Agadir Al Massira Airport', 'AGA', 30.325, -9.4131, true, 24],
  ['fez', 'airport', 'fes', 'Aéroport Fès-Saïss', 'مطار فاس سايس', 'Fès–Saïss Airport', 'FEZ', 33.9273, -4.9779, false, 25],
  ['esu', 'airport', 'essaouira', 'Aéroport Essaouira Mogador', 'مطار الصويرة موكادور', 'Essaouira Mogador Airport', 'ESU', 31.3975, -9.6817, false, 26],
  ['ozz', 'airport', 'ouarzazate', 'Aéroport de Ouarzazate', 'مطار ورزازات', 'Ouarzazate Airport', 'OZZ', 30.9391, -6.9094, false, 27],
  ['ttu', 'airport', 'tetouan', 'Aéroport Tétouan Sania Ramel', 'مطار تطوان سانية الرمل', 'Tetouan Sania Ramel Airport', 'TTU', 35.5943, -5.32, false, 28],
  ['oud', 'airport', 'oujda', 'Aéroport Oujda Angads', 'مطار وجدة أنكاد', 'Oujda Angads Airport', 'OUD', 34.7872, -1.924, false, 29],
  ['vil', 'airport', 'dakhla', 'Aéroport de Dakhla', 'مطار الداخلة', 'Dakhla Airport', 'VIL', 23.7183, -15.932, false, 30],
  ['casa-voyageurs', 'station', 'casablanca', 'Gare Casa-Voyageurs', 'محطة الدار البيضاء المسافرين', 'Casa-Voyageurs Station', null, 33.5893, -7.5913, false, 40],
  ['rabat-agdal', 'station', 'rabat', 'Gare Rabat-Agdal', 'محطة الرباط أكدال', 'Rabat-Agdal Station', null, 33.996, -6.8495, false, 41],
  ['tanger-ville', 'station', 'tangier', 'Gare Tanger-Ville', 'محطة طنجة المدينة', 'Tanger-Ville Station', null, 35.7693, -5.7945, false, 42],
  ['marrakech-gare', 'station', 'marrakech', 'Gare de Marrakech', 'محطة مراكش', 'Marrakesh Station', null, 31.6305, -8.0168, false, 43],
];

const NEIGHBORHOODS = {
  casablanca: ['Maârif', 'Gauthier', 'Anfa', 'Aïn Diab', 'Sidi Maârouf', 'Bourgogne', 'Racine'],
  marrakech: ['Guéliz', 'Hivernage', 'Palmeraie', 'Médina', 'Targa', 'Agdal'],
  rabat: ['Agdal', 'Hay Riad', 'Souissi', 'Hassan', 'Océan'],
  tangier: ['Malabata', 'Marshan', 'Centre-ville', 'Iberia', 'Boukhalef'],
  agadir: ['Founty', 'Talborjt', 'Secteur Touristique', 'Hay Mohammadi'],
  fes: ['Ville Nouvelle', 'Atlas', 'Route d\'Imouzzer'],
  essaouira: ['Médina', 'Diabat', 'Ghazoua'],
  tetouan: ['Centre', 'Mhannech'],
  ouarzazate: ['Centre', 'Tabounte'],
};

// Curated so listings look plausible: everyday hatchbacks for city cars, no supercars on a Dacia.
const PHOTOS = {
  city: ['1541899481282-d53bffe3c35d', '1471444928139-48c5bf5173f8', '1549317661-bd32c8ce0db2'],
  compact: ['1471444928139-48c5bf5173f8', '1541899481282-d53bffe3c35d', '1609521263047-f8f205293f24'],
  sedan: ['1619767886558-efdc259cde1a', '1621007947382-bb3c3994e3fb', '1606016159991-dfe4f2746ad5'],
  suv: ['1617469767053-d3b523a0b982', '1519641471654-76ce0107ad1b', '1533473359331-0135ef1b58bf', '1517524008697-84bbe3c3fd98', '1609521263047-f8f205293f24'],
  luxury: ['1590362891991-f776e747a588', '1563720223185-11003d516935', '1555215695-3004980ad54e', '1606664515524-ed2f786a0bd6', '1514316454349-750a7fd3da3a'],
  van: ['1533473359331-0135ef1b58bf', '1519641471654-76ce0107ad1b', '1617469767053-d3b523a0b982'],
};
// Closer matches for specific models.
const MODEL_PHOTOS = {
  'Hyundai Accent': '1619767886558-efdc259cde1a',
  'Toyota Corolla': '1621007947382-bb3c3994e3fb',
  'Range Rover Evoque': '1563720223185-11003d516935',
  'Fiat 500': '1549317661-bd32c8ce0db2',
  'Volkswagen Golf 8': '1471444928139-48c5bf5173f8',
  'Mercedes-Benz Classe C': '1514316454349-750a7fd3da3a',
  'Mercedes-Benz Classe E': '1590362891991-f776e747a588',
  'BMW X5': '1555215695-3004980ad54e',
  'Toyota Land Cruiser Prado': '1533473359331-0135ef1b58bf',
  'Kia Sportage': '1617469767053-d3b523a0b982',
  'Hyundai Tucson': '1519641471654-76ce0107ad1b',
};
const img = (id, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

// make, model, category, transmission, fuel, seats, daily MAD range, hourly?
const MODELS = [
  ['Dacia', 'Logan', 'city', 'manual', 'diesel', 5, [220, 280], true],
  ['Dacia', 'Sandero', 'city', 'manual', 'diesel', 5, [230, 300], true],
  ['Dacia', 'Sandero Stepway', 'compact', 'manual', 'diesel', 5, [270, 340], true],
  ['Dacia', 'Duster', 'suv', 'manual', 'diesel', 5, [350, 450], false],
  ['Dacia', 'Lodgy', 'van', 'manual', 'diesel', 7, [380, 480], false],
  ['Renault', 'Clio 5', 'city', 'manual', 'gasoline', 5, [260, 330], true],
  ['Renault', 'Clio 5 E-Tech', 'city', 'automatic', 'hybrid', 5, [340, 420], true],
  ['Renault', 'Mégane', 'compact', 'automatic', 'diesel', 5, [380, 460], false],
  ['Peugeot', '208', 'city', 'manual', 'gasoline', 5, [270, 340], true],
  ['Peugeot', '301', 'sedan', 'manual', 'diesel', 5, [280, 350], false],
  ['Peugeot', '3008', 'suv', 'automatic', 'diesel', 5, [550, 700], false],
  ['Hyundai', 'Accent', 'sedan', 'automatic', 'gasoline', 5, [300, 380], true],
  ['Hyundai', 'i10', 'city', 'automatic', 'gasoline', 4, [220, 280], true],
  ['Hyundai', 'Tucson', 'suv', 'automatic', 'hybrid', 5, [600, 780], false],
  ['Kia', 'Picanto', 'city', 'automatic', 'gasoline', 4, [210, 270], true],
  ['Kia', 'Sportage', 'suv', 'automatic', 'diesel', 5, [580, 720], false],
  ['Toyota', 'Yaris Hybrid', 'city', 'automatic', 'hybrid', 5, [330, 410], true],
  ['Toyota', 'Corolla', 'sedan', 'automatic', 'hybrid', 5, [420, 520], false],
  ['Toyota', 'Land Cruiser Prado', 'luxury', 'automatic', 'diesel', 7, [1300, 1700], false],
  ['Volkswagen', 'Golf 8', 'compact', 'automatic', 'gasoline', 5, [450, 550], false],
  ['Volkswagen', 'T-Roc', 'suv', 'automatic', 'gasoline', 5, [550, 680], false],
  ['Mercedes-Benz', 'Classe C', 'luxury', 'automatic', 'diesel', 5, [1100, 1400], false],
  ['Mercedes-Benz', 'Classe E', 'luxury', 'automatic', 'diesel', 5, [1500, 1900], false],
  ['Mercedes-Benz', 'Vito', 'van', 'automatic', 'diesel', 8, [900, 1200], false],
  ['Range Rover', 'Evoque', 'luxury', 'automatic', 'diesel', 5, [1600, 2100], false],
  ['BMW', 'X5', 'luxury', 'automatic', 'hybrid', 5, [2000, 2600], false],
  ['Fiat', '500', 'city', 'automatic', 'gasoline', 4, [260, 320], true],
  ['Citroën', 'C3', 'city', 'manual', 'gasoline', 5, [250, 310], true],
  ['Citroën', 'C-Elysée', 'sedan', 'manual', 'diesel', 5, [260, 320], false],
  ['Skoda', 'Octavia', 'sedan', 'automatic', 'diesel', 5, [420, 520], false],
  ['Seat', 'Ibiza', 'city', 'manual', 'gasoline', 5, [260, 320], true],
];

const FEATURES = ['ac', 'bluetooth', 'gps', 'usb', 'apple_carplay', 'android_auto', 'child_seat', 'roof_rack', 'backup_camera', 'cruise_control', 'four_wd', 'unlimited_km'];

const HOSTS = [
  { email: 'host@demo.carshare.ma', name: 'Youssef El Amrani', city: 'casablanca', phone: '+212661234501', bio: 'Passionné d\'automobile, je loue mes voitures entretenues chez le concessionnaire. Réponse rapide sur WhatsApp.' },
  { email: 'salma.bennani@demo.carshare.ma', name: 'Salma Bennani', city: 'marrakech', phone: '+212661234502', bio: 'Marrakchia, I love helping travellers discover the Atlas. Airport delivery at Menara available.' },
  { email: 'karim.tazi@demo.carshare.ma', name: 'Karim Tazi', city: 'rabat', phone: '+212661234503', bio: 'Cadre à Rabat, mes voitures sont disponibles le week-end et pendant mes déplacements.' },
  { email: 'imane.alaoui@demo.carshare.ma', name: 'Imane Alaoui', city: 'tangier', phone: '+212661234504', bio: 'Tangéroise — ideal for ferry arrivals from Tarifa and trips to Chefchaouen.' },
  { email: 'hamza.ouazzani@demo.carshare.ma', name: 'Hamza Ouazzani', city: 'agadir', phone: '+212661234505', bio: 'Surfeur à Taghazout, mes SUV ont un porte-planche. Livraison à l\'aéroport Al Massira.' },
  { email: 'nadia.berrada@demo.carshare.ma', name: 'Nadia Berrada', city: 'fes', phone: '+212661234506', bio: 'Fassia, voitures propres et récentes. Je vous conseille volontiers sur la route des cèdres.' },
  { email: 'omar.chraibi@demo.carshare.ma', name: 'Omar Chraibi', city: 'essaouira', phone: '+212661234507', bio: 'Between Essaouira and Marrakech every week — one-way trips welcome.' },
  { email: 'leila.fassi@demo.carshare.ma', name: 'Leila Fassi', city: 'casablanca', phone: '+212661234508', bio: 'Flotte premium à Casablanca : berlines et SUV pour vos rendez-vous d\'affaires.' },
];
const HOST_CITIES = { 6: ['essaouira', 'marrakech', 'ouarzazate'], 3: ['tangier', 'tetouan'] };

const RENTERS = [
  { email: 'renter@demo.carshare.ma', name: 'Achraf Barki', city: 'casablanca', phone: '+212661234590', locale: 'fr' },
  { email: 'sophie.martin@demo.carshare.ma', name: 'Sophie Martin', city: null, phone: '+33612345678', locale: 'fr' },
  { email: 'james.walker@demo.carshare.ma', name: 'James Walker', city: null, phone: '+447700900123', locale: 'en' },
  { email: 'mehdi.idrissi@demo.carshare.ma', name: 'Mehdi Idrissi', city: 'rabat', phone: '+212661234591', locale: 'ar' },
  { email: 'fz.lahlou@demo.carshare.ma', name: 'Fatima Zahra Lahlou', city: 'casablanca', phone: '+212661234592', locale: 'fr' },
  { email: 'lucas.fernandez@demo.carshare.ma', name: 'Lucas Fernández', city: null, phone: '+34612345678', locale: 'en' },
  { email: 'aya.benjelloun@demo.carshare.ma', name: 'Aya Benjelloun', city: 'marrakech', phone: '+212661234593', locale: 'ar' },
];

const DEMO_PASSWORD = 'Demo1234!';

const REVIEWS_R2H = [
  ['Voiture impeccable et Youssef très arrangeant pour l\'heure de retour. Je recommande !', 5],
  ['Spotless car, smooth handover at the airport. Would book again.', 5],
  ['سيارة نظيفة ومالك محترم جداً. شكراً على حسن التعامل', 5],
  ['Très bon rapport qualité-prix, la clim fonctionne parfaitement même en plein été.', 5],
  ['Great communication on WhatsApp, car exactly as pictured.', 5],
  ['Bonne expérience globale, petit retard à la remise des clés mais rien de grave.', 4],
  ['Perfect for the Atlas road trip, very comfortable and economical diesel.', 5],
  ['Hôte réactif, voiture propre. Le plein était fait.', 4],
  ['Excellent service, delivery to our riad was a lifesaver.', 5],
  ['السيارة في حالة ممتازة والتسليم كان في الوقت', 4],
];
const REVIEWS_H2R = [
  ['Locataire sérieux, voiture rendue propre et à l\'heure.', 5],
  ['Very respectful renter, welcome back anytime.', 5],
  ['Communication parfaite, je recommande ce conducteur.', 5],
  ['زبون محترم وملتزم بالمواعيد', 5],
  ['Returned with a full tank, thanks!', 4],
];

const descFor = (make, model, cityFr, cityEn, cityAr, feats) => ({
  fr: `${make} ${model} bien entretenue, idéale pour circuler à ${cityFr} et partir en escapade. Entretien à jour, assurance tous risques incluse côté propriétaire. ${feats.includes('ac') ? 'Climatisation efficace. ' : ''}Merci de rendre la voiture avec le même niveau de carburant.`,
  en: `Well-maintained ${make} ${model}, perfect for getting around ${cityEn} and weekend getaways. Fully serviced, comprehensive owner insurance. ${feats.includes('ac') ? 'Strong air conditioning. ' : ''}Please return the car with the same fuel level.`,
  ar: `${make} ${model} في حالة ممتازة، مثالية للتنقل في ${cityAr} والرحلات. الصيانة محدثة وتأمين شامل من طرف المالك. ${feats.includes('ac') ? 'مكيف هواء قوي. ' : ''}المرجو إرجاع السيارة بنفس مستوى الوقود.`,
});

async function ensureUser({ email, name, locale = 'fr' }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, locale },
  });
  if (!error) return data.user.id;
  if (!/already|registered|exists/i.test(error.message)) throw error;
  const { rows } = await db.query('select id from auth.users where email = $1', [email]);
  return rows[0].id;
}

const plate = () => `${between(1000, 99999)}-${pick(['أ', 'ب', 'د', 'هـ', 'و'])}-${between(1, 89)}`;

async function main() {
  await db.connect();

  for (const p of PLACES) {
    await db.query(
      `insert into public.places (slug, kind, city_slug, name_fr, name_ar, name_en, iata, lat, lng, popular, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (slug) do update set name_fr = excluded.name_fr, name_ar = excluded.name_ar, name_en = excluded.name_en,
         lat = excluded.lat, lng = excluded.lng, popular = excluded.popular, sort = excluded.sort, iata = excluded.iata`,
      p,
    );
  }
  console.log(`places: ${PLACES.length}`);

  const { rows: [{ n }] } = await db.query('select count(*)::int n from public.cars');
  if (n > 0 && !force) {
    console.log(`cars already seeded (${n}). Use --force to reseed.`);
    await db.end();
    return;
  }
  if (force) {
    await db.query('delete from public.disputes; delete from public.reviews; delete from public.conversations; delete from public.bookings; delete from public.cars;');
  }

  const hostIds = [];
  for (const h of HOSTS) {
    const id = await ensureUser(h);
    hostIds.push(id);
    await db.query(
      `update public.profiles set full_name=$2, city_slug=$3, phone=$4, whatsapp=$4, phone_verified=true, bio=$5,
         id_status='verified', license_status='verified', active_mode='host', is_host=true where id=$1`,
      [id, h.name, h.city, h.phone, h.bio],
    );
  }
  const renterIds = [];
  for (const r of RENTERS) {
    const id = await ensureUser(r);
    renterIds.push(id);
    await db.query(
      `update public.profiles set full_name=$2, city_slug=$3, phone=$4, whatsapp=$4, phone_verified=true,
         id_status='verified', license_status='verified', preferred_locale=$5, active_mode='renter' where id=$1`,
      [id, r.name, r.city, r.phone, r.locale],
    );
  }
  console.log(`users: ${hostIds.length} hosts, ${renterIds.length} renters`);

  const placeBySlug = Object.fromEntries(PLACES.map((p) => [p[0], p]));
  const airportsByCity = {};
  for (const p of PLACES) if (p[1] === 'airport') (airportsByCity[p[2]] ??= []).push(p[0]);

  const cars = [];
  for (let i = 0; i < 42; i++) {
    const hostIdx = i % HOSTS.length;
    const cities = HOST_CITIES[hostIdx] ?? [HOSTS[hostIdx].city];
    const city = cities[i % cities.length];
    const [, , , cityFr, cityAr, cityEn, , lat, lng] = placeBySlug[city];
    // premium host gets premium cars
    const pool = hostIdx === 7 ? MODELS.filter((m) => ['luxury', 'suv', 'sedan'].includes(m[2])) : MODELS;
    const [make, model, category, transmission, fuel, seats, [lo, hi], hourly] = pick(pool);
    const daily = Math.round(between(lo, hi) / 10) * 10;
    const feats = FEATURES.filter((f) => (f === 'ac' ? true : f === 'four_wd' ? category === 'suv' && rnd() > 0.5 : rnd() > 0.55));
    const neighborhood = pick(NEIGHBORHOODS[city] ?? ['Centre']);
    const airports = airportsByCity[city] ?? [];
    const offersAirport = airports.length > 0 && rnd() > 0.3;
    const year = between(2017, 2025);
    const { rows } = await db.query(
      `insert into public.cars (host_id, status, plate, make, model, year, transmission, fuel, category, seats, doors,
          mileage_km, features, daily_price_mad, hourly_price_mad, weekly_discount_pct, monthly_discount_pct, deposit_mad,
          min_days, instant_book, cash_allowed, km_per_day, extra_km_fee_mad, city_slug, neighborhood, address, lat, lng,
          delivery_available, delivery_fee_mad, airport_slugs, airport_fee_mad, title, description, cover_url)
       values ($1,'active',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
       returning id`,
      [
        hostIds[hostIdx], plate(), make, model, year, transmission, fuel, category, seats, seats > 4 ? 5 : 3,
        between(8, 140) * 1000 - (year - 2017) * 9000 + 60000, feats, daily,
        hourly ? Math.round(daily / 6 / 5) * 5 : null,
        pick([0, 10, 15]), pick([0, 20, 25]),
        category === 'luxury' ? 15000 : category === 'suv' ? 6000 : 3000,
        category === 'luxury' ? 2 : 1, rnd() > 0.4, rnd() > 0.5,
        feats.includes('unlimited_km') ? 1000 : pick([200, 250, 300]), category === 'luxury' ? 4 : 1.5,
        city, neighborhood, `${neighborhood}, ${cityFr}`,
        lat + (rnd() - 0.5) * 0.06, lng + (rnd() - 0.5) * 0.06,
        rnd() > 0.35, pick([50, 80, 100, 150]),
        offersAirport ? airports : [], offersAirport ? pick([100, 150, 200, 250]) : 0,
        `${make} ${model} ${year}`, descFor(make, model, cityFr, cityEn, cityAr, feats), null,
      ],
    );
    const carId = rows[0].id;
    const lead = MODEL_PHOTOS[`${make} ${model}`] ?? pick(PHOTOS[category]);
    const uniq = [...new Set([lead, ...PHOTOS[category]])].slice(0, 3);
    for (const [pos, id] of uniq.entries()) {
      await db.query('insert into public.car_photos (car_id, url, kind, position) values ($1,$2,$3,$4)', [carId, img(id), 'exterior', pos]);
    }
    await db.query('update public.cars set cover_url = $2 where id = $1', [carId, img(uniq[0], 900)]);
    if (rnd() > 0.5) {
      await db.query(
        `insert into public.car_seasonal_prices (car_id, label, start_date, end_date, daily_price_mad)
         values ($1, 'Été / Summer', make_date(extract(year from now())::int + 1, 7, 1), make_date(extract(year from now())::int + 1, 8, 31), $2)`,
        [carId, Math.round((daily * 1.3) / 10) * 10],
      );
    }
    cars.push({ id: carId, hostId: hostIds[hostIdx], daily, km: 250 });
  }
  console.log(`cars: ${cars.length}`);

  // Past completed trips with two-way reviews.
  let bookings = 0;
  for (const [ci, car] of cars.entries()) {
    const trips = between(0, 4);
    for (let t = 0; t < trips; t++) {
      const renter = renterIds[(ci + t) % renterIds.length];
      const daysAgo = 20 + ci * 3 + t * 40;
      const len = between(2, 7);
      const rental = car.daily * len;
      const service = Math.round(rental * 0.1);
      const { rows } = await db.query(
        `insert into public.bookings (car_id, renter_id, host_id, rental_type, start_at, end_at, status, units, unit_price_mad,
            rental_fee_mad, service_fee_mad, total_mad, deposit_mad, host_payout_mad, payment_method, payment_status,
            km_included, extra_km_fee_mad, contract_accepted_at, confirmed_at, started_at, completed_at, created_at)
         values ($1,$2,$3,'daily', now() - make_interval(days => $4), now() - make_interval(days => $4 - $5), 'completed',
            $5, $6, $7, $8, $9, 3000, $10, 'card', 'paid', $11, 1.5,
            now() - make_interval(days => $4 + 3), now() - make_interval(days => $4 + 2),
            now() - make_interval(days => $4), now() - make_interval(days => $4 - $5), now() - make_interval(days => $4 + 3))
         returning id`,
        [car.id, renter, car.hostId, daysAgo, len, car.daily, rental, service, rental + service, Math.round(rental * 0.85), len * 250],
      );
      bookings++;
      const [c1, r1] = pick(REVIEWS_R2H);
      await db.query(
        `insert into public.reviews (booking_id, car_id, author_id, subject_id, direction, rating, cleanliness, communication, accuracy, comment, created_at)
         values ($1,$2,$3,$4,'renter_to_host',$5,$6,$7,$8,$9, now() - make_interval(days => $10))`,
        [rows[0].id, car.id, renter, car.hostId, r1, Math.min(5, r1 + between(-1, 0) + 1), 5, Math.min(5, r1 + between(-1, 0) + 1), c1, daysAgo - len - 1],
      );
      const [c2, r2] = pick(REVIEWS_H2R);
      await db.query(
        `insert into public.reviews (booking_id, car_id, author_id, subject_id, direction, rating, comment, created_at)
         values ($1,$2,$3,$4,'host_to_renter',$5,$6, now() - make_interval(days => $7))`,
        [rows[0].id, car.id, car.hostId, renter, r2, c2, daysAgo - len - 1],
      );
      await db.query('update public.cars set trip_count = trip_count + 1 where id = $1', [car.id]);
      await db.query('update public.profiles set trips_completed = trips_completed + 1 where id = $1', [renter]);
    }
  }
  console.log(`past trips: ${bookings}`);
  console.log(`\nDemo logins (password ${DEMO_PASSWORD}):\n  renter@demo.carshare.ma\n  host@demo.carshare.ma`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
