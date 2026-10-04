-- CarShare Morocco — initial schema
-- Tables, enums, RLS, triggers, booking/pricing RPCs, storage buckets.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_mode as enum ('renter', 'host');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.doc_type as enum ('cin', 'passport', 'license_ma', 'license_intl');
create type public.place_kind as enum ('city', 'airport', 'station');
create type public.transmission as enum ('manual', 'automatic');
create type public.fuel_type as enum ('diesel', 'gasoline', 'hybrid', 'electric');
create type public.car_category as enum ('city', 'compact', 'sedan', 'suv', 'luxury', 'van');
create type public.car_status as enum ('draft', 'active', 'paused');
create type public.photo_kind as enum ('exterior', 'interior', 'odometer', 'other');
create type public.rental_type as enum ('daily', 'hourly');
create type public.booking_status as enum ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'declined');
create type public.payment_method as enum ('cmi', 'card', 'cash');
create type public.payment_status as enum ('unpaid', 'authorized', 'paid', 'refunded', 'failed');
create type public.insurance_plan as enum ('none', 'basic', 'premium');
create type public.delivery_option as enum ('pickup', 'address', 'airport');
create type public.inspection_phase as enum ('pre', 'post');
create type public.review_direction as enum ('renter_to_host', 'host_to_renter');
create type public.dispute_type as enum ('late_return', 'damage', 'mileage', 'cleanliness', 'fuel', 'other');
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  bio text,
  city_slug text,
  phone text,
  phone_verified boolean not null default false,
  whatsapp text,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'ar', 'en')),
  active_mode public.user_mode not null default 'renter',
  is_host boolean not null default false,
  id_status public.verification_status not null default 'unverified',
  license_status public.verification_status not null default 'unverified',
  host_rating numeric(3,2),
  host_review_count int not null default 0,
  renter_rating numeric(3,2),
  renter_review_count int not null default 0,
  trips_completed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Badges are derived, never stored, so they can't be self-assigned.
create or replace view public.profile_badges with (security_invoker = true) as
select
  p.id,
  (p.is_host and p.id_status = 'verified' and p.phone_verified) as verified_host,
  (p.id_status = 'verified' and p.license_status = 'verified'
    and p.trips_completed >= 3 and coalesce(p.renter_rating, 0) >= 4.7) as super_driver,
  (p.id_status = 'verified' and p.license_status = 'verified' and p.phone_verified) as fully_verified
from public.profiles p;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'fr')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile, but not trust/verification/rating columns.
create or replace function public.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.phone_verified = old.phone_verified;
    new.id_status = old.id_status;
    new.license_status = old.license_status;
    new.host_rating = old.host_rating;
    new.host_review_count = old.host_review_count;
    new.renter_rating = old.renter_rating;
    new.renter_review_count = old.renter_review_count;
    new.trips_completed = old.trips_completed;
    new.is_host = old.is_host;
    -- changing the phone number invalidates its verification
    if new.phone is distinct from old.phone then
      new.phone_verified = false;
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Verification (ID / licence / phone)
-- ---------------------------------------------------------------------------
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type public.doc_type not null,
  front_path text not null,
  back_path text,
  document_number text,
  full_name_extracted text,
  expires_on date,
  status public.verification_status not null default 'pending',
  provider text not null default 'mock',
  provider_result jsonb,
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index on public.verification_documents (user_id, created_at desc);

create table public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.phone_verifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Places (cities, airports, stations)
-- ---------------------------------------------------------------------------
create table public.places (
  slug text primary key,
  kind public.place_kind not null,
  city_slug text not null,
  name_fr text not null,
  name_ar text not null,
  name_en text not null,
  iata text,
  lat double precision not null,
  lng double precision not null,
  popular boolean not null default false,
  sort int not null default 100
);

-- ---------------------------------------------------------------------------
-- Cars
-- ---------------------------------------------------------------------------
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  status public.car_status not null default 'draft',
  plate text,
  make text not null,
  model text not null,
  year int not null check (year between 1990 and 2100),
  transmission public.transmission not null,
  fuel public.fuel_type not null,
  category public.car_category not null,
  seats int not null default 5 check (seats between 1 and 9),
  doors int not null default 5 check (doors between 2 and 5),
  mileage_km int not null default 0 check (mileage_km >= 0),
  features text[] not null default '{}',
  daily_price_mad int not null check (daily_price_mad between 50 and 50000),
  hourly_price_mad int check (hourly_price_mad is null or hourly_price_mad between 10 and 5000),
  weekly_discount_pct int not null default 0 check (weekly_discount_pct between 0 and 60),
  monthly_discount_pct int not null default 0 check (monthly_discount_pct between 0 and 70),
  deposit_mad int not null default 3000 check (deposit_mad >= 0),
  min_days int not null default 1 check (min_days between 1 and 30),
  instant_book boolean not null default false,
  cash_allowed boolean not null default false,
  km_per_day int not null default 250 check (km_per_day > 0),
  extra_km_fee_mad numeric(6,2) not null default 1.5,
  city_slug text not null references public.places(slug),
  neighborhood text,
  address text,
  lat double precision not null,
  lng double precision not null,
  delivery_available boolean not null default false,
  delivery_fee_mad int not null default 0 check (delivery_fee_mad >= 0),
  delivery_radius_km int not null default 10,
  airport_slugs text[] not null default '{}',
  airport_fee_mad int not null default 0 check (airport_fee_mad >= 0),
  title text,
  description jsonb not null default '{}'::jsonb, -- { fr, ar, en }
  cover_url text,
  rating numeric(3,2),
  review_count int not null default 0,
  trip_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.cars (status, city_slug);
create index on public.cars (host_id);
create index on public.cars (daily_price_mad);

create trigger cars_updated_at before update on public.cars
  for each row execute function public.set_updated_at();

create or replace function public.guard_car_update() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.host_id = old.host_id;
    new.rating = old.rating;
    new.review_count = old.review_count;
    new.trip_count = old.trip_count;
  end if;
  return new;
end $$;

create trigger cars_guard before update on public.cars
  for each row execute function public.guard_car_update();

-- Becoming a host the first time a car is created.
create or replace function public.mark_host() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_host = true where id = new.host_id and not is_host;
  return new;
end $$;

create trigger cars_mark_host after insert on public.cars
  for each row execute function public.mark_host();

create table public.car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  url text not null,
  storage_path text,
  kind public.photo_kind not null default 'exterior',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.car_photos (car_id, position);

create table public.car_seasonal_prices (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  daily_price_mad int not null check (daily_price_mad between 50 and 50000),
  check (end_date >= start_date)
);
create index on public.car_seasonal_prices (car_id, start_date);

create table public.car_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  check (end_date >= start_date)
);
create index on public.car_blocked_dates (car_id, start_date);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, car_id)
);

-- ---------------------------------------------------------------------------
-- Bookings & payments
-- ---------------------------------------------------------------------------
create sequence public.contract_seq start 1000;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CSM-' || to_char(now(), 'YYMM') || '-' || nextval('public.contract_seq')),
  car_id uuid not null references public.cars(id) on delete restrict,
  renter_id uuid not null references public.profiles(id) on delete restrict,
  host_id uuid not null references public.profiles(id) on delete restrict,
  rental_type public.rental_type not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.booking_status not null default 'pending',
  instant boolean not null default false,
  delivery_option public.delivery_option not null default 'pickup',
  delivery_address text,
  airport_slug text,
  insurance_plan public.insurance_plan not null default 'none',
  -- money (MAD)
  units int not null,
  unit_price_mad numeric(10,2) not null,
  rental_fee_mad numeric(10,2) not null,
  discount_mad numeric(10,2) not null default 0,
  delivery_fee_mad numeric(10,2) not null default 0,
  insurance_fee_mad numeric(10,2) not null default 0,
  service_fee_mad numeric(10,2) not null default 0,
  total_mad numeric(10,2) not null,
  deposit_mad numeric(10,2) not null default 0,
  host_payout_mad numeric(10,2) not null,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  km_included int not null,
  extra_km_fee_mad numeric(6,2) not null,
  renter_message text,
  contract_accepted_at timestamptz,
  contract_snapshot jsonb,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  refund_mad numeric(10,2),
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (renter_id <> host_id)
);
create index on public.bookings (renter_id, start_at desc);
create index on public.bookings (host_id, start_at desc);
create index on public.bookings (car_id, start_at);

-- No two live bookings for the same car may overlap.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (car_id with =, tstzrange(start_at, end_at, '[)') with &&)
  where (status in ('pending', 'confirmed', 'active'));

create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null,
  method public.payment_method not null,
  kind text not null default 'charge' check (kind in ('charge', 'deposit_hold', 'refund')),
  amount_mad numeric(10,2) not null,
  status public.payment_status not null,
  provider_ref text,
  card_last4 text,
  card_brand text,
  created_at timestamptz not null default now()
);
create index on public.payments (booking_id);

-- ---------------------------------------------------------------------------
-- Inspections (handover walkaround)
-- ---------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  phase public.inspection_phase not null,
  submitted_by uuid not null references public.profiles(id),
  odometer_km int,
  fuel_level int check (fuel_level between 0 and 100),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, phase)
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  angle text not null,
  storage_path text not null,
  damage_note text,
  created_at timestamptz not null default now()
);
create index on public.inspection_photos (inspection_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now(),
  unique (car_id, renter_id),
  check (renter_id <> host_id)
);
create index on public.conversations (renter_id, last_message_at desc);
create index on public.conversations (host_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null, -- null = system message
  body text not null check (char_length(body) between 1 and 4000),
  lang text,
  translations jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 140)
   where id = new.conversation_id;
  return new;
end $$;

create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  direction public.review_direction not null,
  rating int not null check (rating between 1 and 5),
  cleanliness int check (cleanliness between 1 and 5),
  communication int check (communication between 1 and 5),
  accuracy int check (accuracy between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (booking_id, author_id)
);
create index on public.reviews (car_id, created_at desc);
create index on public.reviews (subject_id, created_at desc);

create or replace function public.refresh_ratings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'renter_to_host' then
    update public.cars c set
      rating = s.avg, review_count = s.cnt
    from (select round(avg(rating)::numeric, 2) avg, count(*) cnt
            from public.reviews where car_id = new.car_id and direction = 'renter_to_host') s
    where c.id = new.car_id;

    update public.profiles p set
      host_rating = s.avg, host_review_count = s.cnt
    from (select round(avg(rating)::numeric, 2) avg, count(*) cnt
            from public.reviews where subject_id = new.subject_id and direction = 'renter_to_host') s
    where p.id = new.subject_id;
  else
    update public.profiles p set
      renter_rating = s.avg, renter_review_count = s.cnt
    from (select round(avg(rating)::numeric, 2) avg, count(*) cnt
            from public.reviews where subject_id = new.subject_id and direction = 'host_to_renter') s
    where p.id = new.subject_id;
  end if;
  return new;
end $$;

create trigger reviews_refresh after insert on public.reviews
  for each row execute function public.refresh_ratings();

-- ---------------------------------------------------------------------------
-- Disputes (resolution center)
-- ---------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  against_id uuid not null references public.profiles(id),
  type public.dispute_type not null,
  amount_claimed_mad numeric(10,2) check (amount_claimed_mad is null or amount_claimed_mad >= 0),
  description text not null check (char_length(description) between 10 and 4000),
  evidence_paths text[] not null default '{}',
  status public.dispute_status not null default 'open',
  resolution text,
  resolved_amount_mad numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.disputes (booking_id);

create trigger disputes_updated_at before update on public.disputes
  for each row execute function public.set_updated_at();

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid references public.profiles(id), -- null = support agent / system
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.dispute_messages (dispute_id, created_at);

-- ---------------------------------------------------------------------------
-- Pricing & booking RPCs (server-authoritative money maths)
-- ---------------------------------------------------------------------------
create or replace function public.quote_booking(
  p_car_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_rental_type public.rental_type,
  p_delivery public.delivery_option default 'pickup',
  p_airport_slug text default null,
  p_insurance public.insurance_plan default 'none'
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.cars;
  v_hours numeric;
  v_units int;
  v_rental numeric := 0;
  v_unit_price numeric;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_insurance numeric := 0;
  v_service numeric;
  v_day date;
  v_day_price numeric;
  v_km int;
begin
  select * into c from public.cars where id = p_car_id;
  if not found then raise exception 'car_not_found'; end if;
  if p_end <= p_start then raise exception 'invalid_dates'; end if;

  v_hours := extract(epoch from (p_end - p_start)) / 3600.0;

  if p_rental_type = 'hourly' then
    if c.hourly_price_mad is null then raise exception 'hourly_not_available'; end if;
    v_units := greatest(2, ceil(v_hours)::int);
    if v_units > 12 then raise exception 'hourly_max_12h'; end if;
    v_unit_price := c.hourly_price_mad;
    v_rental := v_units * v_unit_price;
    v_km := least(c.km_per_day, v_units * 25);
  else
    v_units := greatest(1, ceil(v_hours / 24.0)::int);
    if v_units < c.min_days then raise exception 'min_days_%', c.min_days; end if;
    -- per-day price honours seasonal overrides
    for i in 0 .. v_units - 1 loop
      v_day := (p_start at time zone 'Africa/Casablanca')::date + i;
      select sp.daily_price_mad into v_day_price
        from public.car_seasonal_prices sp
       where sp.car_id = c.id and v_day between sp.start_date and sp.end_date
       order by sp.daily_price_mad desc limit 1;
      v_rental := v_rental + coalesce(v_day_price, c.daily_price_mad);
      v_day_price := null;
    end loop;
    v_unit_price := round(v_rental / v_units, 2);
    if v_units >= 28 and c.monthly_discount_pct > 0 then
      v_discount := round(v_rental * c.monthly_discount_pct / 100.0, 2);
    elsif v_units >= 7 and c.weekly_discount_pct > 0 then
      v_discount := round(v_rental * c.weekly_discount_pct / 100.0, 2);
    end if;
    v_km := v_units * c.km_per_day;
  end if;

  if p_delivery = 'address' then
    if not c.delivery_available then raise exception 'delivery_not_available'; end if;
    v_delivery := c.delivery_fee_mad;
  elsif p_delivery = 'airport' then
    if p_airport_slug is null or not (p_airport_slug = any(c.airport_slugs)) then
      raise exception 'airport_not_available';
    end if;
    v_delivery := c.airport_fee_mad;
  end if;

  -- insurance priced per started day
  v_insurance := case p_insurance
    when 'basic' then 60 * greatest(1, ceil(v_hours / 24.0))
    when 'premium' then 120 * greatest(1, ceil(v_hours / 24.0))
    else 0 end;

  v_service := round((v_rental - v_discount) * 0.10, 2);

  return jsonb_build_object(
    'units', v_units,
    'unit_price', v_unit_price,
    'rental_fee', v_rental,
    'discount', v_discount,
    'delivery_fee', v_delivery,
    'insurance_fee', v_insurance,
    'service_fee', v_service,
    'total', v_rental - v_discount + v_delivery + v_insurance + v_service,
    'deposit', case p_insurance when 'premium' then round(c.deposit_mad * 0.3) when 'basic' then round(c.deposit_mad * 0.6) else c.deposit_mad end,
    'host_payout', round((v_rental - v_discount + v_delivery) * 0.85, 2),
    'km_included', v_km,
    'extra_km_fee', c.extra_km_fee_mad,
    'instant', c.instant_book
  );
end $$;

create or replace function public.is_available(p_car_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.bookings b
     where b.car_id = p_car_id
       and b.status in ('pending', 'confirmed', 'active')
       and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) and not exists (
    select 1 from public.car_blocked_dates d
     where d.car_id = p_car_id
       and daterange(d.start_date, d.end_date, '[]')
           && daterange((p_start at time zone 'Africa/Casablanca')::date,
                        (p_end at time zone 'Africa/Casablanca')::date, '[]')
  );
$$;

create or replace function public.create_booking(
  p_car_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_rental_type public.rental_type,
  p_delivery public.delivery_option,
  p_delivery_address text,
  p_airport_slug text,
  p_insurance public.insurance_plan,
  p_payment_method public.payment_method,
  p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.cars;
  q jsonb;
  r public.profiles;
  v_id uuid;
  v_conv uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into c from public.cars where id = p_car_id and status = 'active';
  if not found then raise exception 'car_not_found'; end if;
  if c.host_id = v_uid then raise exception 'cannot_book_own_car'; end if;
  if p_start < now() - interval '15 minutes' then raise exception 'start_in_past'; end if;

  select * into r from public.profiles where id = v_uid;
  if r.license_status <> 'verified' or r.id_status <> 'verified' then
    raise exception 'verification_required';
  end if;
  if p_payment_method = 'cash' and not (c.cash_allowed and r.trips_completed >= 1 and r.phone_verified) then
    raise exception 'cash_not_allowed';
  end if;
  if not public.is_available(p_car_id, p_start, p_end) then raise exception 'not_available'; end if;

  q := public.quote_booking(p_car_id, p_start, p_end, p_rental_type, p_delivery, p_airport_slug, p_insurance);

  insert into public.bookings (
    car_id, renter_id, host_id, rental_type, start_at, end_at, status, instant,
    delivery_option, delivery_address, airport_slug, insurance_plan,
    units, unit_price_mad, rental_fee_mad, discount_mad, delivery_fee_mad, insurance_fee_mad,
    service_fee_mad, total_mad, deposit_mad, host_payout_mad, payment_method,
    km_included, extra_km_fee_mad, renter_message, contract_accepted_at, contract_snapshot,
    confirmed_at
  ) values (
    c.id, v_uid, c.host_id, p_rental_type, p_start, p_end,
    case when c.instant_book then 'confirmed' else 'pending' end::public.booking_status,
    c.instant_book,
    p_delivery, nullif(p_delivery_address, ''), p_airport_slug, p_insurance,
    (q->>'units')::int, (q->>'unit_price')::numeric, (q->>'rental_fee')::numeric, (q->>'discount')::numeric,
    (q->>'delivery_fee')::numeric, (q->>'insurance_fee')::numeric, (q->>'service_fee')::numeric,
    (q->>'total')::numeric, (q->>'deposit')::numeric, (q->>'host_payout')::numeric, p_payment_method,
    (q->>'km_included')::int, (q->>'extra_km_fee')::numeric, nullif(p_message, ''), now(),
    jsonb_build_object(
      'car', jsonb_build_object('make', c.make, 'model', c.model, 'year', c.year, 'plate', c.plate,
                                'fuel', c.fuel, 'transmission', c.transmission),
      'quote', q,
      'renter_name', r.full_name,
      'host_name', (select full_name from public.profiles where id = c.host_id),
      'accepted_ip_free', true
    ),
    case when c.instant_book then now() end
  ) returning id into v_id;

  -- open (or reuse) the conversation and post a system note
  insert into public.conversations (car_id, renter_id, host_id, booking_id)
  values (c.id, v_uid, c.host_id, v_id)
  on conflict (car_id, renter_id) do update set booking_id = excluded.booking_id
  returning id into v_conv;

  if nullif(p_message, '') is not null then
    insert into public.messages (conversation_id, sender_id, body) values (v_conv, v_uid, p_message);
  end if;

  return v_id;
end $$;

-- State machine for bookings. Who may do what is enforced here, not in the client.
create or replace function public.transition_booking(p_booking_id uuid, p_action text, p_reason text default null)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  b public.bookings;
  v_is_host boolean;
  v_is_renter boolean;
  v_hours_before numeric;
  v_refund numeric;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  v_is_host := b.host_id = v_uid;
  v_is_renter := b.renter_id = v_uid;
  if not (v_is_host or v_is_renter) then raise exception 'forbidden'; end if;

  if p_action = 'accept' then
    if not v_is_host or b.status <> 'pending' then raise exception 'invalid_transition'; end if;
    update public.bookings set status = 'confirmed', confirmed_at = now() where id = b.id returning * into b;

  elsif p_action = 'decline' then
    if not v_is_host or b.status <> 'pending' then raise exception 'invalid_transition'; end if;
    update public.bookings set status = 'declined', cancelled_at = now(), cancelled_by = v_uid,
      cancel_reason = p_reason, refund_mad = case when payment_status = 'paid' then total_mad else 0 end,
      payment_status = case when payment_status = 'paid' then 'refunded'::public.payment_status else payment_status end
    where id = b.id returning * into b;

  elsif p_action = 'cancel' then
    if b.status not in ('pending', 'confirmed') then raise exception 'invalid_transition'; end if;
    v_hours_before := extract(epoch from (b.start_at - now())) / 3600.0;
    -- policy: host cancels → full refund; renter: >48h full, 24–48h 50%, <24h service fee kept + 1 day
    if v_is_host then
      v_refund := b.total_mad;
    elsif v_hours_before >= 48 then
      v_refund := b.total_mad;
    elsif v_hours_before >= 24 then
      v_refund := round(b.total_mad * 0.5, 2);
    else
      v_refund := greatest(0, b.total_mad - b.service_fee_mad - b.unit_price_mad);
    end if;
    if b.payment_status <> 'paid' then v_refund := 0; end if;
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
      cancel_reason = p_reason, refund_mad = v_refund,
      payment_status = case when payment_status = 'paid' and v_refund > 0 then 'refunded'::public.payment_status else payment_status end
    where id = b.id returning * into b;

  elsif p_action = 'start' then
    if not v_is_host or b.status <> 'confirmed' then raise exception 'invalid_transition'; end if;
    if b.payment_method <> 'cash' and b.payment_status <> 'paid' then raise exception 'payment_required'; end if;
    if not exists (select 1 from public.inspections where booking_id = b.id and phase = 'pre') then
      raise exception 'pre_inspection_required';
    end if;
    update public.bookings set status = 'active', started_at = now(),
      payment_status = case when payment_method = 'cash' then 'paid'::public.payment_status else payment_status end
    where id = b.id returning * into b;

  elsif p_action = 'complete' then
    if not v_is_host or b.status <> 'active' then raise exception 'invalid_transition'; end if;
    update public.bookings set status = 'completed', completed_at = now() where id = b.id returning * into b;
    update public.profiles set trips_completed = trips_completed + 1 where id = b.renter_id;
    update public.cars set trip_count = trip_count + 1 where id = b.car_id;

  else
    raise exception 'unknown_action';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  select id, null, 'booking:' || p_action from public.conversations
   where car_id = b.car_id and renter_id = b.renter_id;

  return b;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.verification_documents enable row level security;
alter table public.phone_verifications enable row level security;
alter table public.places enable row level security;
alter table public.cars enable row level security;
alter table public.car_photos enable row level security;
alter table public.car_seasonal_prices enable row level security;
alter table public.car_blocked_dates enable row level security;
alter table public.favorites enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;

create or replace function public.is_booking_party(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings
                  where id = p_booking_id and (renter_id = auth.uid() or host_id = auth.uid()));
$$;

-- profiles: public directory, but phone/whatsapp are column-restricted (see grants below)
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- verification docs: owner only (writes via server with service role)
create policy vdocs_read_own on public.verification_documents for select using (user_id = auth.uid());
-- phone_verifications: no client access at all (server only)

create policy places_read on public.places for select using (true);

create policy cars_read on public.cars for select using (status = 'active' or host_id = auth.uid());
create policy cars_insert on public.cars for insert with check (host_id = auth.uid());
create policy cars_update on public.cars for update using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy cars_delete on public.cars for delete using (host_id = auth.uid());

create or replace function public.owns_car(p_car_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cars where id = p_car_id and host_id = auth.uid());
$$;
create or replace function public.car_visible(p_car_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cars where id = p_car_id and (status = 'active' or host_id = auth.uid()));
$$;

create policy photos_read on public.car_photos for select using (public.car_visible(car_id));
create policy photos_write on public.car_photos for all using (public.owns_car(car_id)) with check (public.owns_car(car_id));

create policy seasonal_read on public.car_seasonal_prices for select using (public.car_visible(car_id));
create policy seasonal_write on public.car_seasonal_prices for all using (public.owns_car(car_id)) with check (public.owns_car(car_id));

create policy blocked_read on public.car_blocked_dates for select using (public.car_visible(car_id));
create policy blocked_write on public.car_blocked_dates for all using (public.owns_car(car_id)) with check (public.owns_car(car_id));

create policy fav_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bookings: parties read; writes only via RPCs (security definer)
create policy bookings_read on public.bookings for select using (renter_id = auth.uid() or host_id = auth.uid());

create policy payments_read on public.payments for select using (public.is_booking_party(booking_id));

create policy inspections_read on public.inspections for select using (public.is_booking_party(booking_id));
create policy inspections_insert on public.inspections for insert
  with check (submitted_by = auth.uid() and public.is_booking_party(booking_id));
create or replace function public.acknowledge_inspection(p_inspection uuid) returns void
language sql security definer set search_path = public as $$
  update public.inspections set acknowledged_by = auth.uid(), acknowledged_at = now()
   where id = p_inspection and submitted_by <> auth.uid() and acknowledged_at is null
     and public.is_booking_party(booking_id);
$$;

create policy iphotos_read on public.inspection_photos for select using (
  exists (select 1 from public.inspections i where i.id = inspection_id and public.is_booking_party(i.booking_id)));
create policy iphotos_insert on public.inspection_photos for insert with check (
  exists (select 1 from public.inspections i where i.id = inspection_id and i.submitted_by = auth.uid()));

create policy conv_read on public.conversations for select using (renter_id = auth.uid() or host_id = auth.uid());
create policy conv_insert on public.conversations for insert with check (
  renter_id = auth.uid()
  and exists (select 1 from public.cars c where c.id = conversations.car_id
               and c.host_id = conversations.host_id and c.status = 'active'));

create or replace function public.is_conversation_party(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations
                  where id = p_conv and (renter_id = auth.uid() or host_id = auth.uid()));
$$;

create policy msg_read on public.messages for select using (public.is_conversation_party(conversation_id));
create policy msg_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_conversation_party(conversation_id));
create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where conversation_id = p_conv and read_at is null
     and sender_id is distinct from auth.uid()
     and public.is_conversation_party(p_conv);
$$;

create policy reviews_read on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.bookings b
     where b.id = booking_id and b.status = 'completed' and b.car_id = reviews.car_id
       and ((direction = 'renter_to_host' and b.renter_id = auth.uid() and b.host_id = subject_id)
         or (direction = 'host_to_renter' and b.host_id = auth.uid() and b.renter_id = subject_id))
  ));

create policy disputes_read on public.disputes for select using (opened_by = auth.uid() or against_id = auth.uid());
create policy disputes_insert on public.disputes for insert with check (
  opened_by = auth.uid()
  and exists (select 1 from public.bookings b where b.id = booking_id
               and b.status in ('active', 'completed', 'cancelled')
               and ((b.renter_id = auth.uid() and b.host_id = against_id)
                 or (b.host_id = auth.uid() and b.renter_id = against_id))));

create policy dmsg_read on public.dispute_messages for select using (
  exists (select 1 from public.disputes d where d.id = dispute_id and (d.opened_by = auth.uid() or d.against_id = auth.uid())));
create policy dmsg_insert on public.dispute_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.disputes d where d.id = dispute_id and d.status in ('open', 'under_review')
               and (d.opened_by = auth.uid() or d.against_id = auth.uid())));

-- Column-level privacy: contact details are never readable directly.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, bio, city_slug, phone_verified, preferred_locale, active_mode,
  is_host, id_status, license_status, host_rating, host_review_count, renter_rating,
  renter_review_count, trips_completed, created_at, updated_at)
  on public.profiles to anon, authenticated;

create or replace function public.get_my_contact() returns table (phone text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select phone, whatsapp from public.profiles where id = auth.uid();
$$;

-- Contact details are shared only between parties of a confirmed/active/completed booking.
create or replace function public.get_contact(p_user uuid) returns table (phone text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select p.phone, coalesce(p.whatsapp, p.phone) from public.profiles p
   where p.id = p_user and exists (
     select 1 from public.bookings b
      where b.status in ('confirmed', 'active', 'completed')
        and ((b.renter_id = auth.uid() and b.host_id = p_user)
          or (b.host_id = auth.uid() and b.renter_id = p_user)));
$$;

-- Grants for RPCs
revoke all on function public.get_my_contact from public, anon;
grant execute on function public.get_my_contact to authenticated;
revoke all on function public.get_contact from public, anon;
grant execute on function public.get_contact to authenticated;
revoke all on function public.mark_conversation_read from public, anon;
grant execute on function public.mark_conversation_read to authenticated;
revoke all on function public.acknowledge_inspection from public, anon;
grant execute on function public.acknowledge_inspection to authenticated;
revoke all on function public.create_booking from public, anon;
grant execute on function public.create_booking to authenticated;
revoke all on function public.transition_booking from public, anon;
grant execute on function public.transition_booking to authenticated;
grant execute on function public.quote_booking to anon, authenticated;
grant execute on function public.is_available to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.bookings;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('car-photos', 'car-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('inspections', 'inspections', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('dispute-evidence', 'dispute-evidence', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Path convention: <bucket>/<owner-uid>/... (inspections: <booking-id>/...)
create policy "car photos public read" on storage.objects for select using (bucket_id = 'car-photos');
create policy "car photos owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "car photos owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vdocs owner read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vdocs owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "inspections party read" on storage.objects for select to authenticated
  using (bucket_id = 'inspections' and public.is_booking_party(((storage.foldername(name))[1])::uuid));
create policy "inspections party write" on storage.objects for insert to authenticated
  with check (bucket_id = 'inspections' and public.is_booking_party(((storage.foldername(name))[1])::uuid));

create policy "evidence party read" on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and public.is_booking_party(((storage.foldername(name))[1])::uuid));
create policy "evidence party write" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and public.is_booking_party(((storage.foldername(name))[1])::uuid));
