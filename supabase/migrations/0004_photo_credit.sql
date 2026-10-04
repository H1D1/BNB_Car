-- Attribution for freely-licensed photos (e.g. Wikimedia Commons: author + licence).
alter table public.car_photos add column if not exists credit text;
