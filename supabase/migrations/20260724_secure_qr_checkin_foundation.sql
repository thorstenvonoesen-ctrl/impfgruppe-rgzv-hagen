-- Security foundation for authenticated, club-scoped administration and QR check-in.
-- Apply in the Supabase SQL editor before deploying the corresponding application code.
create extension if not exists pgcrypto;

alter table public.participants
  add column if not exists checkin_token text,
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

create unique index if not exists participants_checkin_token_key
  on public.participants (checkin_token) where checkin_token is not null;

create table if not exists public.club_admin_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null check (role in ('superadmin', 'clubadmin', 'checkin_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create or replace function public.assign_participant_checkin_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Always replace a browser-supplied token with cryptographically secure server data.
  new.checkin_token := encode(gen_random_bytes(32), 'hex');
  new.checked_in := false;
  new.checked_in_at := null;
  new.checked_in_by := null;
  return new;
end;
$$;

drop trigger if exists participants_assign_checkin_token on public.participants;
create trigger participants_assign_checkin_token
  before insert on public.participants
  for each row execute function public.assign_participant_checkin_token();

update public.participants
set checkin_token = encode(gen_random_bytes(32), 'hex')
where checkin_token is null;

create or replace function public.can_manage_club(target_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_admin_memberships membership
    where membership.user_id = auth.uid()
      and membership.active
      and (membership.role = 'superadmin' or membership.club_id = target_club_id)
  );
$$;

alter table public.club_admin_memberships enable row level security;
alter table public.participants enable row level security;
alter table public.vaccination_dates enable row level security;
alter table public.clubs enable row level security;

-- Memberships are only visible to their authenticated owner; administrative assignment
-- is deliberately performed with the Supabase dashboard/service role.
drop policy if exists "members read own club roles" on public.club_admin_memberships;
create policy "members read own club roles" on public.club_admin_memberships
  for select to authenticated using (user_id = auth.uid());

-- Replace historic anonymous administration policies. Registrations are created through
-- the server endpoint, so anonymous clients do not receive participant read/update rights.
drop policy if exists "public insert participants" on public.participants;
drop policy if exists "admin read participants" on public.participants;
drop policy if exists "admin update participants" on public.participants;
drop policy if exists "authenticated club members read participants" on public.participants;
drop policy if exists "authenticated club members update participants" on public.participants;
drop policy if exists "authenticated club members delete participants" on public.participants;
create policy "authenticated club members read participants" on public.participants
  for select to authenticated using (public.can_manage_club(club_id));
create policy "authenticated club members update participants" on public.participants
  for update to authenticated using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));
create policy "authenticated club members delete participants" on public.participants
  for delete to authenticated using (public.can_manage_club(club_id));

drop policy if exists "authenticated club members read vaccination dates" on public.vaccination_dates;
drop policy if exists "authenticated club members manage vaccination dates" on public.vaccination_dates;
create policy "authenticated club members read vaccination dates" on public.vaccination_dates
  for select to authenticated using (public.can_manage_club(club_id));
create policy "authenticated club members manage vaccination dates" on public.vaccination_dates
  for all to authenticated using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

-- Public read access is limited to non-sensitive club/date metadata. Participant totals
-- are served as aggregates by an API endpoint and no participant rows are exposed.
drop policy if exists "public read clubs" on public.clubs;
create policy "public read clubs" on public.clubs for select to anon, authenticated using (true);
drop policy if exists "public read vaccination dates" on public.vaccination_dates;
create policy "public read vaccination dates" on public.vaccination_dates for select to anon using (true);

revoke all on public.participants from anon;
revoke update on public.participants from authenticated;
grant select, delete on public.participants to authenticated;
grant update (firstname, lastname, street, housenumber, zipcode, city, email, phone, tsk_number, animal_type, animal_count, vaccine, vaccination_date_id) on public.participants to authenticated;
grant select, insert, update, delete on public.vaccination_dates to authenticated;
grant select on public.clubs to anon, authenticated;
grant select on public.club_admin_memberships to authenticated;

-- Service-role endpoints bypass RLS and remain the sole writers of payments/check-ins.
