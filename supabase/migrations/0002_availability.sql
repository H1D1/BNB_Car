-- Availability helpers that expose busy *time ranges* only (no booking/renter details).

create or replace function public.unavailable_car_ids(p_start timestamptz, p_end timestamptz)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select b.car_id from public.bookings b
   where b.status in ('pending', 'confirmed', 'active')
     and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
  union
  select d.car_id from public.car_blocked_dates d
   where daterange(d.start_date, d.end_date, '[]')
         && daterange((p_start at time zone 'Africa/Casablanca')::date,
                      (p_end at time zone 'Africa/Casablanca')::date, '[]');
$$;

create or replace function public.car_busy_ranges(p_car_id uuid)
returns table (start_at timestamptz, end_at timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select b.start_at, b.end_at, 'booked' from public.bookings b
   where b.car_id = p_car_id and b.status in ('pending', 'confirmed', 'active') and b.end_at > now()
  union all
  select (d.start_date::timestamp at time zone 'Africa/Casablanca'),
         ((d.end_date + 1)::timestamp at time zone 'Africa/Casablanca'), 'blocked'
    from public.car_blocked_dates d
   where d.car_id = p_car_id and d.end_date >= current_date
  order by 1;
$$;

grant execute on function public.unavailable_car_ids to anon, authenticated;
grant execute on function public.car_busy_ranges to anon, authenticated;

-- Payment confirmation is server-side only (service role), but hosts/renters get a system message.
create or replace function public.notify_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.payment_method <> 'cash' then
    insert into public.messages (conversation_id, sender_id, body)
    select id, null, 'booking:paid' from public.conversations
     where car_id = new.car_id and renter_id = new.renter_id;
  end if;
  return new;
end $$;

create trigger bookings_notify_paid after update of payment_status on public.bookings
  for each row execute function public.notify_paid();
