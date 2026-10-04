-- Hardening: publish rules enforced in the DB, storage cleanup policies, OTP index.

-- A listing can only go live with ≥3 photos, a description and a verified host.
-- Applies to end users only; service-role/seed scripts are trusted.
create or replace function public.guard_car_publish() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if (select count(*) from public.car_photos where car_id = new.id) < 3 then
      raise exception 'publish_needs_photos';
    end if;
    if not exists (select 1 from jsonb_each_text(new.description) d where length(trim(d.value)) > 0) then
      raise exception 'publish_needs_description';
    end if;
    select * into p from public.profiles where id = new.host_id;
    if p.id_status <> 'verified' or not p.phone_verified then
      raise exception 'publish_needs_verification';
    end if;
  end if;
  return new;
end $$;

create trigger cars_guard_publish before insert or update of status on public.cars
  for each row execute function public.guard_car_publish();

-- Let users clean up their own uploads (re-done verification, failed inspection/dispute submits).
create policy "vdocs owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "inspections owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'inspections' and owner = auth.uid());
create policy "evidence owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'dispute-evidence' and owner = auth.uid());

create index if not exists phone_verifications_user_open on public.phone_verifications (user_id, consumed_at);
