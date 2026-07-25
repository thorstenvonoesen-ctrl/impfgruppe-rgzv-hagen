alter table public.participants
  add column if not exists checkin_method text;

alter table public.participants
  drop constraint if exists participants_checkin_method_check;

alter table public.participants
  add constraint participants_checkin_method_check
  check (checkin_method is null or checkin_method in ('qr', 'manual'));

create index if not exists participants_checkin_search_date_idx
  on public.participants (club_id, vaccination_date_id);

create extension if not exists pg_trgm;

create index if not exists participants_checkin_firstname_trgm_idx
  on public.participants using gin (firstname gin_trgm_ops);

create index if not exists participants_checkin_lastname_trgm_idx
  on public.participants using gin (lastname gin_trgm_ops);

create index if not exists participants_checkin_email_trgm_idx
  on public.participants using gin (email gin_trgm_ops);

create index if not exists participants_checkin_phone_trgm_idx
  on public.participants using gin (phone gin_trgm_ops);

create index if not exists participants_checkin_tsk_trgm_idx
  on public.participants using gin (tsk_number gin_trgm_ops);
