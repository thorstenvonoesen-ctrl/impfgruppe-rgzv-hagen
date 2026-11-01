-- Eigenständiges Mitgliederverzeichnis. Keine Verbindung zu Tarif/Anmeldung.
-- Keine Bestandsdaten werden importiert, aktualisiert oder gelöscht.
begin;
set local lock_timeout = '5s';

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  firstname text not null check (length(trim(firstname)) between 1 and 100),
  lastname text not null check (length(trim(lastname)) between 1 and 100),
  email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  member_number text check (length(member_number) between 1 and 64),
  is_active boolean not null default true,
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (lower(firstname || ' ' || lastname || ' ' || email)) stored
);
create unique index if not exists club_members_club_email_key on public.club_members(club_id,lower(trim(email)));
create unique index if not exists club_members_club_number_key on public.club_members(club_id,lower(trim(member_number))) where member_number is not null;
create index if not exists club_members_club_name_idx on public.club_members(club_id,lastname,firstname,id);

create or replace function public.can_manage_club_members(target_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.club_admin_memberships m
    where m.user_id=auth.uid() and m.active
      and (m.role='superadmin' or (m.role='clubadmin' and m.club_id=target_club)));
$$;
revoke all on function public.can_manage_club_members(uuid) from public,anon;
grant execute on function public.can_manage_club_members(uuid) to authenticated;

create or replace function public.normalize_club_member()
returns trigger language plpgsql set search_path = public as $$
begin
  new.firstname := trim(new.firstname);
  new.lastname := trim(new.lastname);
  new.email := lower(trim(new.email));
  new.member_number := nullif(trim(new.member_number),'');
  new.notes := nullif(trim(new.notes),'');
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.normalize_club_member() from public,anon,authenticated;
-- Recreate only our own trigger. No participant, appointment or tariff triggers touched.
drop trigger if exists club_members_normalize on public.club_members;
create trigger club_members_normalize before insert or update on public.club_members
  for each row execute function public.normalize_club_member();

alter table public.club_members enable row level security;
drop policy if exists club_members_admin_read on public.club_members;
create policy club_members_admin_read on public.club_members for select to authenticated
  using (public.can_manage_club_members(club_id));
drop policy if exists club_members_admin_insert on public.club_members;
create policy club_members_admin_insert on public.club_members for insert to authenticated
  with check (public.can_manage_club_members(club_id));
drop policy if exists club_members_admin_update on public.club_members;
create policy club_members_admin_update on public.club_members for update to authenticated
  using (public.can_manage_club_members(club_id)) with check (public.can_manage_club_members(club_id));
revoke all on public.club_members from public,anon,authenticated;
grant select on public.club_members to authenticated;
grant insert(club_id,firstname,lastname,email,member_number,is_active,notes) on public.club_members to authenticated;
grant update(firstname,lastname,email,member_number,is_active,notes) on public.club_members to authenticated;

-- Security invoker: jeder INSERT durchläuft dieselben RLS-Regeln wie Einzeleingaben.
-- Import überspringt Dubletten, überschreibt und reaktiviert niemals Bestandsmitglieder.
create or replace function public.import_club_members(target_club uuid,members jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare item jsonb; inserted integer := 0; skipped integer := 0; affected integer;
begin
  if not public.can_manage_club_members(target_club) then
    raise exception using errcode='42501',message='Keine Berechtigung für diesen Verein.';
  end if;
  if jsonb_typeof(members) is distinct from 'array' then
    raise exception using errcode='22023',message='Mitglieder müssen eine Liste sein.';
  end if;
  if jsonb_array_length(members) not between 1 and 500 then
    raise exception using errcode='22023',message='Pro Import sind 1 bis 500 Mitglieder erlaubt.';
  end if;
  for item in select value from jsonb_array_elements(members) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'is_active') is distinct from 'boolean'
       or jsonb_typeof(item->'firstname') is distinct from 'string'
       or jsonb_typeof(item->'lastname') is distinct from 'string'
       or jsonb_typeof(item->'email') is distinct from 'string'
       or coalesce(jsonb_typeof(item->'member_number'),'null') not in ('string','null')
       or coalesce(jsonb_typeof(item->'notes'),'null') not in ('string','null') then
      raise exception using errcode='22023',message='Ungültige Mitgliedsdaten.';
    end if;
    insert into public.club_members(club_id,firstname,lastname,email,member_number,is_active,notes)
      values(target_club,item->>'firstname',item->>'lastname',item->>'email',item->>'member_number',(item->>'is_active')::boolean,item->>'notes')
      on conflict do nothing;
    get diagnostics affected = row_count;
    inserted := inserted + affected;
    skipped := skipped + (1-affected);
  end loop;
  return jsonb_build_object('inserted',inserted,'skipped',skipped);
end;
$$;
revoke all on function public.import_club_members(uuid,jsonb) from public,anon;
grant execute on function public.import_club_members(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
