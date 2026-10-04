# CarShare Morocco

Peer-to-peer car rental for Morocco — "Airbnb for cars". Renters book cars from verified local hosts in
Casablanca, Marrakech, Tangier and beyond, with transparent pricing in dirhams, airport delivery and a
liquid-glass interface in French, Arabic (RTL) and English.

Spec: [carshare_morocco_features_and_design.md](carshare_morocco_features_and_design.md)

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS v4 — custom "liquid glass" tokens in `src/app/globals.css` |
| Backend | Supabase: Postgres + Row Level Security, Auth, Storage, Realtime |
| Maps | Leaflet with Mapbox raster tiles, Mapbox Geocoding v6 for suggestions / reverse geocoding |
| i18n | Typed dictionaries (`src/lib/i18n/dictionaries`) — FR (default), AR (RTL), EN |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Mapbox keys
npm run db:migrate           # applies supabase/migrations/*.sql
npm run db:seed              # places, demo users, 42 cars, past trips & reviews
npm run dev
```

Demo accounts (password `Demo1234!`):

- `renter@demo.carshare.ma` — verified renter with completed trips
- `host@demo.carshare.ma` — verified host with listed cars

## Architecture

- **Money is computed in Postgres.** `quote_booking` / `create_booking` (security definer) price every
  booking server-side — seasonal prices, weekly/monthly discounts, delivery, insurance and the 10 % service
  fee — so the client can never tamper with totals.
- **Bookings are a state machine** in `transition_booking` (accept, decline, cancel with the refund
  policy, start — which requires the pre-trip inspection and payment — and complete).
- **No double bookings**: a GiST exclusion constraint on `(car_id, tstzrange)` for live bookings.
- **Privacy by default**: RLS on every table; phone/WhatsApp are column-restricted and only exposed via
  `get_contact()` between parties of a confirmed booking. Trust columns (verification status, ratings,
  badges) are guarded by triggers so users can't self-verify.
- **Storage buckets**: `car-photos` and `avatars` (public), `verification-docs`, `inspections`,
  `dispute-evidence` (private, path-scoped policies).

```
src/
  app/            routes (search, cars/[id], book/[carId], pay/[bookingId], trips, host, messages, account, disputes…)
  app/actions/    server actions per feature
  components/     ui kit (glass primitives, LocationInput…), cars, booking, layout
  lib/            data access, i18n, mapbox, currency, booking helpers
  lib/integrations/  provider interfaces with test-mode implementations
supabase/migrations/  SQL schema
scripts/          migrate + seed
```

## Integrations (test mode → production)

Each external service sits behind an interface in `src/lib/integrations/` with a mock implementation, so
every flow works end to end today:

| Feature | Test mode | Production |
| --- | --- | --- |
| Payments (`payments.ts`) | Any card accepted, `…0002` declines | CMI hosted payment page (signed form + callback), international acquirer for Visa/Mastercard |
| Phone OTP (`sms.ts`) | Code shown on screen | Twilio SMS / WhatsApp or a Moroccan SMS aggregator |
| ID & licence (`kyc.ts`) | Format + expiry checks on the typed data | OCR/KYC vendor reading CIN, passport, permis |
| Chat translation (`translate.ts`) | Disabled notice | Any translation API (FR/AR/EN) |
| Plate lookup (`plates.ts`) | Deterministic sample catalogue | Registry / insurer API |
| FX display (`lib/currency.ts`) | Static indicative rates | Bank Al-Maghrib reference rates |

Accounts are created pre-confirmed because the Supabase project has no SMTP provider yet; switch
`signup` in `src/app/actions/auth.ts` to `supabase.auth.signUp()` once email is configured.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply pending SQL migrations (tracked in `public._migrations`) |
| `npm run db:seed` | Seed demo data (`-- --force` to wipe & reseed cars/bookings) |
