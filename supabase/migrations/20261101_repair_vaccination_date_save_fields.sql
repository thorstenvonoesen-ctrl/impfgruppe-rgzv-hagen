-- Independent, idempotent repair for installations missing the appointment fields.
-- No existing appointment/participant values, policies or grants are changed.
begin;
alter table public.vaccination_dates
  add column if not exists time time,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists registration_closed boolean not null default false,
  add column if not exists venue_name text,
  add column if not exists street text,
  add column if not exists house_number text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists address_public boolean not null default false;
notify pgrst, 'reload schema';
commit;
