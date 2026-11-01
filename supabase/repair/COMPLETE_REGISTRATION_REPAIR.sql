-- COMPLETE REGISTRATION REPAIR. Run this ONE file as postgres in the correct Supabase SQL Editor.
-- No historical participant deletion, no SMTP, no changes to delete_participant_registration.
begin;
set local lock_timeout='5s';
-- Minimum additive registration prerequisites; existing values remain untouched.
do $$ begin
  if to_regclass('public.clubs') is null or to_regclass('public.vaccination_dates') is null or to_regclass('public.participants') is null or to_regclass('public.club_admin_memberships') is null then
    raise exception 'Grundtabellen/Vereinsadmin-Grundlage fehlen. Keine Bestandsdaten geändert.';
  end if;
end; $$;
alter table public.clubs add column if not exists member_code text,add column if not exists member_price numeric,add column if not exists guest_price numeric;
alter table public.vaccination_dates add column if not exists archived boolean default false;
alter table public.participants
  add column if not exists street text,add column if not exists housenumber text,add column if not exists zipcode text,add column if not exists city text,add column if not exists phone text,
  add column if not exists animal_type text,add column if not exists chicken_count integer,add column if not exists bantam_count integer,add column if not exists turkey_count integer,
  add column if not exists is_member boolean,add column if not exists registration_status text,add column if not exists checkin_token text,
  add column if not exists checked_in boolean default false,add column if not exists checked_in_at timestamptz,add column if not exists checked_in_by text,
  add column if not exists created_at timestamptz default now();
grant select on public.clubs,public.vaccination_dates,public.participants to service_role;

-- SOURCE: 20261101_repair_vaccination_date_save_fields
-- Independent, idempotent repair for installations missing the appointment fields.
-- No existing appointment/participant values, policies or grants are changed.

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

-- SOURCE: 20261103_complete_mail_queue_repair
-- Vollständige, wiederholbare Reparatur für den administrativen Mail-Rundversand.
-- Im SQL Editor des tatsächlich verwendeten Supabase-Projekts als postgres ausführen.
-- Kein Versand, keine Datenlöschung, kein UPDATE von Teilnehmern/Terminen/Versandprotokollen.
-- Unvollständige historische Pflichtdaten oder widersprüchliche Typen führen zum
-- sicheren Abbruch der gesamten Transaktion; sie werden niemals geraten/überschrieben.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Die bestehenden Teilnahme-/Berechtigungsdaten werden nur geprüft, nicht verändert.
do $$
declare r record;
begin
  for r in select * from (values
    ('clubs','id'),('clubs','slug'),
    ('vaccination_dates','id'),('vaccination_dates','club_id'),('vaccination_dates','title'),('vaccination_dates','date'),
    ('participants','id'),('participants','club_id'),('participants','vaccination_date_id'),
    ('participants','firstname'),('participants','lastname'),('participants','email'),
    ('participants','checked_in'),('participants','registration_status'),
    ('club_admin_memberships','user_id'),('club_admin_memberships','club_id'),
    ('club_admin_memberships','role'),('club_admin_memberships','active')
  ) required(table_name,column_name)
  loop
    if not exists(select 1 from information_schema.columns c where c.table_schema='public'
        and c.table_name=r.table_name and c.column_name=r.column_name) then
      raise exception 'Voraussetzung fehlt: public.%.%. Teilnahme-/Admin-Grundmigration zuerst prüfen; keine Bestandsdaten geändert.', r.table_name,r.column_name;
    end if;
  end loop;
end;
$$;

create table if not exists public.mail_batches (
  id text, club_id uuid, appointment_id uuid, kind text, created_at timestamptz default now()
);
create table if not exists public.mail_deliveries (
  id uuid default gen_random_uuid(), event_key text, club_id uuid, appointment_id uuid,
  participant_id uuid, kind text, recipient text, payload jsonb,
  status text default 'pending', attempts integer default 0,
  next_attempt_at timestamptz default now(), claimed_at timestamptz,
  sent_at timestamptz, error_code text, created_at timestamptz default now()
);

-- CREATE TABLE IF NOT EXISTS alleine repariert keine fehlenden Spalten.
-- Bei fehlendem historischen Status wird vorsichtshalber 'uncertain' verwendet,
-- damit bereits versendete Nachrichten nicht erneut als 'pending' starten.
alter table public.mail_batches
  add column if not exists id text,
  add column if not exists club_id uuid,
  add column if not exists appointment_id uuid,
  add column if not exists kind text,
  add column if not exists created_at timestamptz default now();
alter table public.mail_deliveries
  add column if not exists id uuid,
  add column if not exists event_key text,
  add column if not exists club_id uuid,
  add column if not exists appointment_id uuid,
  add column if not exists participant_id uuid,
  add column if not exists kind text,
  add column if not exists recipient text,
  add column if not exists payload jsonb,
  add column if not exists status text default 'uncertain',
  add column if not exists attempts integer default 0,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists claimed_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists error_code text,
  add column if not exists created_at timestamptz default now();

-- Keine impliziten Typkonvertierungen oder Rekonstruktion historischer Schlüssel.
do $$
declare r record; actual_type oid; has_null boolean;
begin
  for r in select * from (values
    ('mail_batches','id','text',true),('mail_batches','club_id','uuid',true),
    ('mail_batches','appointment_id','uuid',true),('mail_batches','kind','text',true),
    ('mail_batches','created_at','timestamptz',true),
    ('mail_deliveries','id','uuid',true),('mail_deliveries','event_key','text',true),
    ('mail_deliveries','club_id','uuid',true),('mail_deliveries','appointment_id','uuid',false),
    ('mail_deliveries','participant_id','uuid',false),('mail_deliveries','kind','text',true),
    ('mail_deliveries','recipient','text',true),('mail_deliveries','payload','jsonb',true),
    ('mail_deliveries','status','text',true),('mail_deliveries','attempts','integer',true),
    ('mail_deliveries','next_attempt_at','timestamptz',true),('mail_deliveries','claimed_at','timestamptz',false),
    ('mail_deliveries','sent_at','timestamptz',false),('mail_deliveries','error_code','text',false),
    ('mail_deliveries','created_at','timestamptz',true)
  ) expected(table_name,column_name,type_name,required)
  loop
    select a.atttypid into actual_type from pg_attribute a
      where a.attrelid=format('public.%I',r.table_name)::regclass and a.attname=r.column_name and not a.attisdropped;
    if actual_type is distinct from to_regtype(r.type_name)::oid then
      raise exception 'Abweichender Spaltentyp bei public.%.%. Manuelle Prüfung erforderlich; keine Daten konvertiert.',r.table_name,r.column_name;
    end if;
    if r.required then
      execute format('select exists(select 1 from public.%I where %I is null)',r.table_name,r.column_name) into has_null;
      if has_null then
        raise exception 'Historische Pflichtangabe fehlt bei public.%.%. Sicherer Abbruch ohne Überschreiben von Versandprotokollen.',r.table_name,r.column_name;
      end if;
      execute format('alter table public.%I alter column %I set not null',r.table_name,r.column_name);
    end if;
  end loop;
end;
$$;

-- Nur Defaults für künftige Aufträge; vorhandene Status/Versuche bleiben erhalten.
alter table public.mail_batches alter column created_at set default now();
alter table public.mail_deliveries
  alter column id set default gen_random_uuid(),
  alter column status set default 'pending',
  alter column attempts set default 0,
  alter column next_attempt_at set default now(),
  alter column created_at set default now();

-- Fehlende Schlüssel hinzufügen; vorhandene gleichwertige eindeutige Indizes nutzen.
-- Doppelte historische Schlüssel führen zum Abbruch statt zum Löschen von Zeilen.
do $$
declare r record;
begin
  for r in select * from (values ('mail_batches','id'),('mail_deliveries','id'),('mail_deliveries','event_key')) k(table_name,column_name)
  loop
    if not exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid
      and a.attname=r.column_name where i.indrelid=format('public.%I',r.table_name)::regclass
      and i.indisunique and i.indisvalid and i.indpred is null and i.indexprs is null
      and i.indnkeyatts=1 and i.indkey[0]=a.attnum) then
      execute format('create unique index %I on public.%I (%I)',r.table_name || '_' || r.column_name || '_repair_key',r.table_name,r.column_name);
    end if;
  end loop;
end;
$$;

-- Zusätzliche, vereinsbezogene Integrität auch für bereits angelegte Tabellen.
-- NOT VALID bedeutet: historische Zeilen bleiben unverändert, neue Änderungen
-- müssen die Regeln erfüllen. Bekannte alte Fremdschlüssel werden nicht entfernt.
do $$
declare r record;
begin
  for r in select * from (values
    ('mail_batches','mail_batches_club_repair_fk','foreign key (club_id) references public.clubs(id)'),
    ('mail_batches','mail_batches_appointment_repair_fk','foreign key (appointment_id) references public.vaccination_dates(id)'),
    ('mail_deliveries','mail_deliveries_club_repair_fk','foreign key (club_id) references public.clubs(id)'),
    ('mail_deliveries','mail_deliveries_appointment_repair_fk','foreign key (appointment_id) references public.vaccination_dates(id)'),
    ('mail_deliveries','mail_deliveries_participant_repair_fk','foreign key (participant_id) references public.participants(id)'),
    ('mail_deliveries','mail_deliveries_status_repair_check',
      'check (status in (''pending'',''sending'',''sent'',''failed'',''uncertain'',''skipped''))'),
    ('mail_deliveries','mail_deliveries_attempts_repair_check','check (attempts >= 0)')
  ) c(table_name,constraint_name,definition)
  loop
    if not exists(select 1 from pg_constraint where conrelid=format('public.%I',r.table_name)::regclass and conname=r.constraint_name) then
      execute format('alter table public.%I add constraint %I %s not valid',r.table_name,r.constraint_name,r.definition);
    end if;
  end loop;
end;
$$;

create index if not exists mail_deliveries_campaign_status_idx
  on public.mail_deliveries(club_id,appointment_id,kind,created_at desc);
create index if not exists mail_deliveries_club_status_idx
  on public.mail_deliveries(club_id,created_at desc);
create index if not exists mail_deliveries_pending_repair_idx
  on public.mail_deliveries(next_attempt_at,created_at) where status in ('pending','failed');

-- Vereinsprüfung erfolgt in der authentifizierten Server-API; die Warteschlange
-- darf niemals über den anonymen oder normalen Browserclient zugänglich sein.
alter table public.mail_batches enable row level security;
alter table public.mail_deliveries enable row level security;
revoke all on public.mail_batches,public.mail_deliveries from public,anon,authenticated;
-- Auch eventuell historisch vergebene Spaltenrechte entziehen.
do $$
declare r record;
begin
  for r in select table_name,string_agg(quote_ident(column_name),',') cols
    from information_schema.columns where table_schema='public' and table_name in ('mail_batches','mail_deliveries') group by table_name
  loop
    execute format('revoke select (%s),insert (%s),update (%s),references (%s) on public.%I from public,anon,authenticated',r.cols,r.cols,r.cols,r.cols,r.table_name);
  end loop;
end;
$$;
grant select,insert,update,delete on public.mail_batches,public.mail_deliveries to service_role;

-- Zusätzliche Vereinssicherung in der Datenbank. Bestehende Protokolle werden
-- nicht umgeschrieben; neue/geänderte Zuordnungen müssen zusammenpassen.
create or replace function public.check_mail_queue_club()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.appointment_id is not null and not exists (
    select 1 from public.vaccination_dates d where d.id=new.appointment_id and d.club_id=new.club_id
  ) then raise exception 'Versandauftrag: Termin und Verein stimmen nicht überein.'; end if;
  if tg_table_name='mail_deliveries' then
    if new.participant_id is not null and not exists (
      select 1 from public.participants p where p.id=new.participant_id and p.club_id=new.club_id
        and (new.appointment_id is null or p.vaccination_date_id=new.appointment_id)
    ) then raise exception 'Versandauftrag: Teilnehmer und Vereins-/Terminzuordnung stimmen nicht überein.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_mail_queue_club() from public,anon,authenticated;
do $$
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.mail_batches'::regclass and tgname='mail_batches_check_club') then
    create trigger mail_batches_check_club before insert or update of club_id,appointment_id on public.mail_batches
      for each row execute function public.check_mail_queue_club();
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.mail_deliveries'::regclass and tgname='mail_deliveries_check_club') then
    create trigger mail_deliveries_check_club before insert or update of club_id,appointment_id,participant_id on public.mail_deliveries
      for each row execute function public.check_mail_queue_club();
  end if;
end;
$$;

create or replace function public.mail_appointment_open(a jsonb)
returns boolean language sql stable set search_path = public as $$
  select not coalesce((a->>'archived')::boolean, false)
    and not coalesce((a->>'registration_closed')::boolean, false)
    and not coalesce((a->>'closed')::boolean, false)
    and now() < (((a->>'date')::date + coalesce(nullif(a->>'time','')::time,
      substring(a->>'title' from '(?:[01]?[0-9]|2[0-3]):[0-5][0-9]')::time, time '00:00')) at time zone 'Europe/Berlin')
    and (coalesce(a->>'registration_closes_at', a->>'registration_deadline') is null
      or now() < coalesce(a->>'registration_closes_at', a->>'registration_deadline')::timestamptz);
$$;


create or replace function public.claim_mail_delivery(delivery_id uuid)
returns setof public.mail_deliveries language sql security definer set search_path = public as $$
  update public.mail_deliveries set status='sending', claimed_at=now(), attempts=attempts+1
  where id=delivery_id and status in ('pending','failed') and next_attempt_at <= now() and attempts < 5 returning *;
$$;

-- Freeze an entire confirmed recipient list in a single transaction.
create or replace function public.create_mail_batch(batch_key text, target_club uuid, target_appointment uuid, mail_kind text, deliveries jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_key text; a jsonb;
begin
  if mail_kind not in ('new-appointment','appointment-change')
     or batch_key is null or length(trim(batch_key))=0
     or jsonb_typeof(deliveries) is distinct from 'array'
     or jsonb_array_length(deliveries)=0 then
    raise exception 'Ungültiger Rundversand oder leere Empfängerliste.';
  end if;
  if mail_kind='new-appointment' and batch_key is distinct from 'new-appointment:' || target_appointment::text then
    raise exception 'Ungültiger Rundversandschlüssel.';
  end if;
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=target_appointment and d.club_id=target_club for share;
  if a is null or coalesce((a->>'archived')::boolean,false) or coalesce((a->>'is_test')::boolean,false)
      or exists(select 1 from jsonb_each_text(a) kv where kv.value ilike '%test%') then raise exception 'Kein Rundversand für diesen Termin.'; end if;
  if mail_kind = 'new-appointment' and not public.mail_appointment_open(a) then raise exception 'Anmeldung geschlossen.'; end if;
  if exists(select 1 from jsonb_array_elements(deliveries) x
    where x->'payload'->'appointment' is distinct from a
      or jsonb_typeof(x->'payload'->'participant') is distinct from 'object'
      or coalesce(trim(x->>'recipient'),'')='') then
    raise exception 'Ungültige Empfängerdaten oder Termindaten geändert. Vorschau neu laden.';
  end if;
  if (select count(*) from jsonb_array_elements(deliveries)) <>
     (select count(distinct lower(trim(x->>'recipient'))) from jsonb_array_elements(deliveries) x) then
    raise exception 'Doppelte Empfänger im Rundversand. Vorschau neu laden.';
  end if;
  insert into public.mail_batches(id,club_id,appointment_id,kind) values(batch_key,target_club,target_appointment,mail_kind)
    on conflict do nothing returning id into inserted_key;
  if inserted_key is null then return false; end if;
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    select batch_key || ':' || lower(trim(x->>'recipient')), target_club,target_appointment,
      nullif(x->>'participant_id','')::uuid,mail_kind,lower(trim(x->>'recipient')),x->'payload'
    from jsonb_array_elements(deliveries) x;
  return true;
end;
$$;


revoke all on function public.mail_appointment_open(jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mail_appointment_open(jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) to service_role;

notify pgrst, 'reload schema';

-- Erfolgskontrolle ohne personenbezogene Daten oder Versand:
select to_regclass('public.mail_batches') is not null as mail_batches_ready,
       to_regclass('public.mail_deliveries') is not null as mail_deliveries_ready,
       to_regprocedure('public.create_mail_batch(text,uuid,uuid,text,jsonb)') is not null as batch_function_ready,
       to_regprocedure('public.claim_mail_delivery(uuid)') is not null as claim_function_ready;

-- SOURCE: 20261104_add_club_members
-- Eigenständiges Mitgliederverzeichnis. Keine Verbindung zu Tarif/Anmeldung.
-- Keine Bestandsdaten werden importiert, aktualisiert oder gelöscht.

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

-- SOURCE: 20261105_registration_confirmation_outbox
-- Requires 20261103_complete_mail_queue_repair.sql and the existing check-in/participant foundation.
-- No historical participant changes, no automatic historical mail jobs, no SMTP calls.

set local lock_timeout = '5s';
create or replace function public.queue_registration_mail()
returns trigger language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  if new.payment_method = 'bar' and new.registration_status = 'bar_registered' then
    select to_jsonb(d) into a from public.vaccination_dates d where d.id = new.vaccination_date_id;
    insert into public.mail_deliveries(event_key, club_id, appointment_id, participant_id, kind, recipient, payload)
      values ('registration:' || new.id, new.club_id, new.vaccination_date_id, new.id, 'registration', lower(trim(new.email)),
        jsonb_build_object('participant', to_jsonb(new), 'appointment', a)) on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists participants_queue_registration_mail on public.participants;
create trigger participants_queue_registration_mail after insert on public.participants for each row execute function public.queue_registration_mail();

create or replace function public.guard_cash_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare a jsonb;
begin
  if new.payment_method <> 'bar' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vaccination_date_id::text || ':' || lower(trim(new.email)), 0));
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=new.vaccination_date_id for share;
  if a is null or not public.mail_appointment_open(a) then raise exception 'Die Anmeldung ist geschlossen.'; end if;
  if exists(select 1 from public.participants where vaccination_date_id=new.vaccination_date_id
      and lower(trim(email))=lower(trim(new.email)) and registration_status in ('bar_registered','completed','pending_payment')) then
    raise exception 'Für diese Adresse besteht bereits eine Anmeldung.';
  end if;
  return new;
end;
$$;
drop trigger if exists participants_guard_cash_registration on public.participants;
create trigger participants_guard_cash_registration before insert on public.participants for each row execute function public.guard_cash_registration();


create or replace function public.register_with_confirmation(registration jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants%rowtype; input public.participants%rowtype; a jsonb;
begin
  input := jsonb_populate_record(null::public.participants,registration);
  if input.payment_method is distinct from 'bar' or input.registration_status is distinct from 'bar_registered' then
    raise exception using errcode='22023',message='Ungültige Baranmeldung.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(input.vaccination_date_id::text || ':' || lower(trim(input.email)),0));
  select to_jsonb(d) into a from public.vaccination_dates d
    where d.id=input.vaccination_date_id and d.club_id=input.club_id for share;
  if a is null or not public.mail_appointment_open(a) then raise exception using errcode='55000',message='Die Anmeldung ist geschlossen.'; end if;
  if exists(select 1 from public.participants existing where existing.vaccination_date_id=input.vaccination_date_id
    and lower(trim(existing.email))=lower(trim(input.email)) and existing.registration_status in ('bar_registered','completed','pending_payment')) then
    raise exception using errcode='23505',message='Für diese Adresse besteht bereits eine Anmeldung.';
  end if;
  -- Explicit allowlist: ids, check-in tokens, receipt/payment markers and timestamps
  -- cannot be supplied by the caller. Existing defaults and protection triggers apply.
  insert into public.participants(firstname,lastname,street,housenumber,zipcode,city,email,phone,tsk_number,
    vaccine,animal_type,animal_count,chicken_count,bantam_count,turkey_count,vaccination_date_id,club_id,
    is_member,payment_status,payment_amount,payment_method,registration_status)
  values(input.firstname,input.lastname,input.street,input.housenumber,input.zipcode,input.city,lower(trim(input.email)),input.phone,input.tsk_number,
    input.vaccine,input.animal_type,input.animal_count,input.chicken_count,input.bantam_count,input.turkey_count,input.vaccination_date_id,input.club_id,
    input.is_member,input.payment_status,input.payment_amount,input.payment_method,input.registration_status)
  returning * into p;
  if nullif(p.checkin_token,'') is null then raise exception using errcode='55000',message='Die Check-in-Grundlage fehlt.'; end if;
  -- Idempotent even with the normal AFTER INSERT trigger present. Also guarantees
  -- an atomic outbox if a later partial deployment inadvertently removes that trigger.
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    values('registration:' || p.id,p.club_id,p.vaccination_date_id,p.id,'registration',lower(trim(p.email)),
      jsonb_build_object('participant',to_jsonb(p),'appointment',a)) on conflict(event_key) do nothing;
  return jsonb_build_object('id',p.id,'payment_amount',p.payment_amount);
end;
$$;

-- Audit of explicit manual retries; attempts on the delivery count the current cycle.
create table if not exists public.mail_delivery_retries (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.mail_deliveries(id),
  club_id uuid not null references public.clubs(id), previous_attempts integer not null,
  previous_error_code text, retried_at timestamptz not null default now()
);
alter table public.mail_delivery_retries enable row level security;
revoke all on public.mail_delivery_retries from public,anon,authenticated;
grant select,insert on public.mail_delivery_retries to service_role;
create or replace function public.retry_failed_mail_delivery(target_club uuid,delivery_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare job public.mail_deliveries%rowtype;
begin
  select * into job from public.mail_deliveries d where d.id=delivery_id and d.club_id=target_club for update;
  if not found or job.status <> 'failed' then return null; end if;
  insert into public.mail_delivery_retries(delivery_id,club_id,previous_attempts,previous_error_code)
    values(job.id,job.club_id,job.attempts,job.error_code);
  update public.mail_deliveries d set status='pending',attempts=0,next_attempt_at=now() where d.id=job.id;
  return jsonb_build_object('participant_id',job.participant_id,'appointment_id',job.appointment_id,'kind',job.kind);
end;
$$;

-- Explicit recovery of one selected registration; no historical bulk backfill.
create or replace function public.ensure_registration_confirmation(target_club uuid,target_participant uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants%rowtype; a jsonb; job public.mail_deliveries%rowtype;
begin
  select * into p from public.participants existing where existing.id=target_participant and existing.club_id=target_club for share;
  if not found then raise exception using errcode='22023',message='Anmeldung nicht gefunden.'; end if;
  select * into job from public.mail_deliveries d where d.event_key='registration:' || p.id and d.club_id=target_club;
  if found then return jsonb_build_object('id',job.id,'status',job.status); end if;
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=p.vaccination_date_id and d.club_id=p.club_id for share;
  if a is null or coalesce((a->>'archived')::boolean,false) or (a->>'date')::date < (now() at time zone 'Europe/Berlin')::date
    or p.payment_method is distinct from 'bar' or p.registration_status not in ('bar_registered','completed') or nullif(p.checkin_token,'') is null then
    raise exception using errcode='22023',message='Für diese Anmeldung kann keine Bestätigung nachgeholt werden.';
  end if;
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    values('registration:' || p.id,p.club_id,p.vaccination_date_id,p.id,'registration',lower(trim(p.email)),
      jsonb_build_object('participant',to_jsonb(p),'appointment',a)) on conflict(event_key) do nothing;
  select * into job from public.mail_deliveries d where d.event_key='registration:' || p.id and d.club_id=target_club;
  return jsonb_build_object('id',job.id,'status',job.status);
end;
$$;

revoke all on function public.queue_registration_mail(),public.guard_cash_registration(),public.register_with_confirmation(jsonb),public.retry_failed_mail_delivery(uuid,uuid),public.ensure_registration_confirmation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_with_confirmation(jsonb),public.retry_failed_mail_delivery(uuid,uuid),public.ensure_registration_confirmation(uuid,uuid) to service_role;
notify pgrst,'reload schema';

-- SOURCE: 20261106_verified_member_tariffs
-- Adds email proof and automatic tariffs for NEW registrations only.
-- Requires member directory (20261104), confirmation outbox (20261105) and its prerequisites.
-- No existing participant, member, amount or code is updated; no email is sent.

set local lock_timeout='5s';
alter table public.participants
  add column if not exists mail_revision integer not null default 0,
  add column if not exists tariff_source text check(tariff_source in ('guest','code','verified_member')),
  add column if not exists tariff_verified_email text;
create table if not exists public.membership_email_challenges (
  id uuid primary key,club_id uuid not null references public.clubs(id),appointment_id uuid not null references public.vaccination_dates(id),
  email_hash text not null,code_hash text not null,created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',attempts integer not null default 0,
  consumed_at timestamptz
);
create index if not exists membership_challenges_rate_idx on public.membership_email_challenges(club_id,email_hash,created_at);
create index if not exists membership_challenges_club_rate_idx on public.membership_email_challenges(club_id,created_at);
alter table public.membership_email_challenges enable row level security;
revoke all on public.membership_email_challenges from public,anon,authenticated;
grant select,insert,update on public.membership_email_challenges to service_role;

create or replace function public.reserve_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('membership-challenge:' || target_club::text,0));
  if not exists(select 1 from public.vaccination_dates d where d.id=target_appointment and d.club_id=target_club)
    or length(email_digest)<>64 or length(otp_digest)<>64 then return false; end if;
  if exists(select 1 from public.membership_email_challenges where club_id=target_club and email_hash=email_digest and created_at>now()-interval '60 seconds')
    or (select count(*) from public.membership_email_challenges where club_id=target_club and email_hash=email_digest and created_at>now()-interval '1 hour')>=3
    or (select count(*) from public.membership_email_challenges where club_id=target_club and created_at>now()-interval '1 hour')>=200 then return false; end if;
  insert into public.membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash) values(challenge_id,target_club,target_appointment,email_digest,otp_digest);
  return true;
end;
$$;
create or replace function public.verify_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
declare challenge public.membership_email_challenges%rowtype;
begin
  select * into challenge from public.membership_email_challenges c where c.id=challenge_id and c.club_id=target_club and c.appointment_id=target_appointment and c.email_hash=email_digest for update;
  if not found or challenge.expires_at<=now() or challenge.consumed_at is not null or challenge.attempts>=5 then return false; end if;
  update public.membership_email_challenges set attempts=attempts+1 where id=challenge.id;
  if challenge.code_hash<>otp_digest then return false; end if;
  update public.membership_email_challenges set consumed_at=now() where id=challenge.id;
  return true;
end;
$$;

create or replace function public.register_with_tariff_confirmation(registration jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants%rowtype; input public.participants%rowtype; a jsonb; c public.clubs%rowtype; eligible uuid; chosen_source text; verified text;
begin
  input := jsonb_populate_record(null::public.participants,registration);
  if input.payment_method is distinct from 'bar' or input.registration_status is distinct from 'bar_registered' then
    raise exception using errcode='22023',message='Ungültige Baranmeldung.';
  end if;
  select * into c from public.clubs where id=input.club_id for share;
  if not found then raise exception 'Verein nicht gefunden.'; end if;
  input.is_member := false; input.payment_amount := coalesce(c.guest_price,10); chosen_source := 'guest';
  verified := lower(trim(registration->>'verified_email'));
  if nullif(trim(registration->>'member_code'),'') is not null and nullif(trim(c.member_code),'') is not null
     and upper(trim(registration->>'member_code'))=upper(trim(c.member_code)) then
    input.is_member := true; chosen_source := 'code';
  elsif verified=lower(trim(input.email)) then
    select m.id into eligible from public.club_members m where m.club_id=input.club_id and m.email=verified and m.is_active for share;
    if eligible is not null then input.is_member := true; chosen_source := 'verified_member'; end if;
  end if;
  if input.is_member then input.payment_amount := coalesce(c.member_price,5); end if;
  if input.payment_amount<0 or input.payment_amount>100000 or input.payment_amount<>round(input.payment_amount,2) then raise exception 'Ungültige Vereinstarife.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(input.vaccination_date_id::text || ':' || lower(trim(input.email)),0));
  select to_jsonb(d) into a from public.vaccination_dates d
    where d.id=input.vaccination_date_id and d.club_id=input.club_id for share;
  if a is null or not public.mail_appointment_open(a) then raise exception using errcode='55000',message='Die Anmeldung ist geschlossen.'; end if;
  if exists(select 1 from public.participants existing where existing.vaccination_date_id=input.vaccination_date_id
    and lower(trim(existing.email))=lower(trim(input.email)) and existing.registration_status in ('bar_registered','completed','pending_payment')) then
    raise exception using errcode='23505',message='Für diese Adresse besteht bereits eine Anmeldung.';
  end if;
  -- Explicit allowlist: ids, check-in tokens, receipt/payment markers and timestamps
  -- cannot be supplied by the caller. Existing defaults and protection triggers apply.
  insert into public.participants(firstname,lastname,street,housenumber,zipcode,city,email,phone,tsk_number,
    vaccine,animal_type,animal_count,chicken_count,bantam_count,turkey_count,vaccination_date_id,club_id,
    is_member,payment_status,payment_amount,payment_method,registration_status,tariff_source,tariff_verified_email)
  values(input.firstname,input.lastname,input.street,input.housenumber,input.zipcode,input.city,lower(trim(input.email)),input.phone,input.tsk_number,
    input.vaccine,input.animal_type,input.animal_count,input.chicken_count,input.bantam_count,input.turkey_count,input.vaccination_date_id,input.club_id,
    input.is_member,input.payment_status,input.payment_amount,input.payment_method,input.registration_status,chosen_source,case when chosen_source='verified_member' then verified else null end)
  returning * into p;
  if nullif(p.checkin_token,'') is null then raise exception using errcode='55000',message='Die Check-in-Grundlage fehlt.'; end if;
  -- Idempotent even with the normal AFTER INSERT trigger present. Also guarantees
  -- an atomic outbox if a later partial deployment inadvertently removes that trigger.
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    values('registration:' || p.id,p.club_id,p.vaccination_date_id,p.id,'registration',lower(trim(p.email)),
      jsonb_build_object('participant',to_jsonb(p),'appointment',a)) on conflict(event_key) do nothing;
  return jsonb_build_object('id',p.id,'payment_amount',p.payment_amount);
end;
$$;


create or replace function public.manage_registration(target_id uuid, expected_revision integer, operation text, changes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants; a jsonb; k text; eligible uuid;
begin
  select * into p from public.participants where id = target_id for update;
  if not found then raise exception 'Anmeldung nicht gefunden.'; end if;
  select to_jsonb(d) into a from public.vaccination_dates d where d.id = p.vaccination_date_id for share;
  if not public.mail_appointment_open(a) or p.checked_in or p.registration_status not in ('completed','bar_registered') then
    raise exception 'Diese Anmeldung kann nicht mehr geändert oder storniert werden.';
  end if;
  if p.mail_revision <> expected_revision then raise exception 'Die Anmeldung wurde zwischenzeitlich geändert. Bitte neu laden.'; end if;
  if operation = 'cancel' then
    update public.participants set registration_status = 'cancelled', mail_revision = mail_revision + 1 where id = target_id returning * into p;
    k := 'cancelled';
  elsif operation = 'update' then
    if trim(coalesce(changes->>'firstname','')) = '' or trim(coalesce(changes->>'lastname','')) = ''
      or trim(coalesce(changes->>'tsk_number','')) = '' or coalesce(changes->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or coalesce((changes->>'animal_count')::integer,0) < 1
      or (changes->>'chicken_count')::integer < 0 or (changes->>'bantam_count')::integer < 0 or (changes->>'turkey_count')::integer < 0
      or (changes->>'animal_count')::integer <> (changes->>'chicken_count')::integer + (changes->>'bantam_count')::integer + (changes->>'turkey_count')::integer then
      raise exception 'Ungültige Anmeldedaten.';
    end if;
    if p.tariff_source='verified_member' and lower(trim(changes->>'email'))<>lower(trim(p.email)) then
      if lower(trim(changes->>'verified_email')) is distinct from lower(trim(changes->>'email')) then raise exception 'Neue E-Mail-Adresse muss bestätigt werden.'; end if;
      select m.id into eligible from public.club_members m where m.club_id=p.club_id and m.email=lower(trim(changes->>'email')) and m.is_active for share;
      if eligible is null then raise exception 'Neue E-Mail-Adresse ist keinem aktiven Mitglied zugeordnet.'; end if;
    end if;
    if (to_jsonb(p) @> changes) then return to_jsonb(p); end if;
    update public.participants set firstname=changes->>'firstname', lastname=changes->>'lastname', email=changes->>'email',
      street=changes->>'street', housenumber=changes->>'housenumber', zipcode=changes->>'zipcode', city=changes->>'city',
      phone=changes->>'phone', tsk_number=changes->>'tsk_number', animal_type=changes->>'animal_type',
      animal_count=(changes->>'animal_count')::integer, chicken_count=(changes->>'chicken_count')::integer,
      bantam_count=(changes->>'bantam_count')::integer, turkey_count=(changes->>'turkey_count')::integer,
      tariff_verified_email=case when p.tariff_source='verified_member' then lower(trim(changes->>'email')) else p.tariff_verified_email end,
      mail_revision=mail_revision+1 where id=target_id returning * into p;
    k := 'changed';
  else raise exception 'Ungültige Aktion.';
  end if;
  insert into public.mail_deliveries(event_key, club_id, appointment_id, participant_id, kind, recipient, payload)
    values(k || ':' || p.id || ':' || p.mail_revision, p.club_id, p.vaccination_date_id, p.id, k, lower(trim(p.email)),
      jsonb_build_object('participant', to_jsonb(p), 'appointment', a));
  return to_jsonb(p);
end;
$$;


revoke all on function public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text),public.register_with_tariff_confirmation(jsonb),public.manage_registration(uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text),public.register_with_tariff_confirmation(jsonb),public.manage_registration(uuid,integer,text,jsonb) to service_role;
notify pgrst,'reload schema';

-- FINAL RESILIENCE OVERRIDES
-- Final registration hardening. Install prerequisites using the complete repair bundle.
-- No historical jobs, participant updates, member deletions or SMTP calls at installation.

alter table public.participants
  add column if not exists confirmation_job_state text,
  add column if not exists confirmation_error_code text,
  add column if not exists tariff_review_required boolean;

-- QR generation must not depend on the installation schema of pgcrypto.
-- Two UUIDv4 values use the database CSPRNG; no existing token is changed.
create or replace function public.assign_participant_checkin_token()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.checkin_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  new.checked_in := false; new.checked_in_at := null; new.checked_in_by := null;
  return new;
end;
$$;
revoke all on function public.assign_participant_checkin_token() from public,anon,authenticated;
drop trigger if exists participants_assign_checkin_token on public.participants;
create trigger participants_assign_checkin_token before insert on public.participants
  for each row execute function public.assign_participant_checkin_token();

create or replace function public.ensure_registration_job(target_participant uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare p public.participants%rowtype; a jsonb; failure_code text; old_timeout text;
begin
  select * into p from public.participants x where x.id=target_participant for update;
  if not found then return false; end if;
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=p.vaccination_date_id and d.club_id=p.club_id;
  if a is null or coalesce((a->>'archived')::boolean,false) or p.registration_status not in ('bar_registered','completed') or p.payment_method is distinct from 'bar' then return false; end if;
  old_timeout := current_setting('lock_timeout');
  perform set_config('lock_timeout','500ms',true);
  begin
    insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
      values('registration:' || p.id,p.club_id,p.vaccination_date_id,p.id,'registration',lower(trim(p.email)),
        jsonb_build_object('participant',to_jsonb(p),'appointment',a)) on conflict(event_key) do nothing;
    if not exists(select 1 from public.mail_deliveries m where m.event_key='registration:' || p.id and m.participant_id=p.id and m.club_id=p.club_id and m.appointment_id=p.vaccination_date_id) then
      raise exception using errcode='23514',message='Bestätigungsauftrag widersprüchlich zugeordnet.';
    end if;
  exception when others then
    get stacked diagnostics failure_code=returned_sqlstate;
  end;
  perform set_config('lock_timeout',old_timeout,true);
  if failure_code is not null then
    update public.participants set confirmation_job_state='pending',confirmation_error_code=failure_code where id=p.id;
    return false;
  end if;
  update public.participants set confirmation_job_state='queued',confirmation_error_code=null where id=p.id;
  return true;
end;
$$;

create or replace function public.queue_registration_mail()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.payment_method='bar' and new.registration_status='bar_registered' then
    perform public.ensure_registration_job(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists participants_queue_registration_mail on public.participants;
create trigger participants_queue_registration_mail after insert on public.participants
  for each row execute function public.queue_registration_mail();

create or replace function public.reconcile_registration_confirmations(target_club uuid default null,target_participant uuid default null,batch_limit integer default 100)
returns integer language plpgsql security definer set search_path=public as $$
declare item record; added integer:=0;
begin
  for item in select p.id from public.participants p where p.confirmation_job_state='pending'
    and (target_club is null or p.club_id=target_club) and (target_participant is null or p.id=target_participant)
    order by p.created_at,p.id limit greatest(1,least(coalesce(batch_limit,100),500)) for update skip locked
  loop
    if public.ensure_registration_job(item.id) then added:=added+1; end if;
  end loop;
  return added;
end;
$$;

-- REGISTRATION_FUNCTIONS: generated by scripts/build-registration-repair.mjs.
create or replace function public.register_with_confirmation(registration jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants%rowtype; input public.participants%rowtype; a jsonb;
begin
  input := jsonb_populate_record(null::public.participants,registration);
  if input.payment_method is distinct from 'bar' or input.registration_status is distinct from 'bar_registered' then
    raise exception using errcode='22023',message='Ungültige Baranmeldung.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(input.vaccination_date_id::text || ':' || lower(trim(input.email)),0));
  select to_jsonb(d) into a from public.vaccination_dates d
    where d.id=input.vaccination_date_id and d.club_id=input.club_id for share;
  if a is null or not public.mail_appointment_open(a) then raise exception using errcode='55000',message='Die Anmeldung ist geschlossen.'; end if;
  if exists(select 1 from public.participants existing where existing.vaccination_date_id=input.vaccination_date_id
    and lower(trim(existing.email))=lower(trim(input.email)) and existing.registration_status in ('bar_registered','completed','pending_payment')) then
    raise exception using errcode='23505',message='Für diese Adresse besteht bereits eine Anmeldung.';
  end if;
  -- Explicit allowlist: ids, check-in tokens, receipt/payment markers and timestamps
  -- cannot be supplied by the caller. Existing defaults and protection triggers apply.
  insert into public.participants(firstname,lastname,street,housenumber,zipcode,city,email,phone,tsk_number,
    vaccine,animal_type,animal_count,chicken_count,bantam_count,turkey_count,vaccination_date_id,club_id,
    is_member,payment_status,payment_amount,payment_method,registration_status,confirmation_job_state,tariff_review_required)
  values(input.firstname,input.lastname,input.street,input.housenumber,input.zipcode,input.city,lower(trim(input.email)),input.phone,input.tsk_number,
    input.vaccine,input.animal_type,input.animal_count,input.chicken_count,input.bantam_count,input.turkey_count,input.vaccination_date_id,input.club_id,
    input.is_member,input.payment_status,input.payment_amount,input.payment_method,input.registration_status,'pending',false)
  returning * into p;
  if nullif(p.checkin_token,'') is null then raise exception using errcode='55000',message='Die Check-in-Grundlage fehlt.'; end if;
  perform public.ensure_registration_job(p.id);
  select * into p from public.participants x where x.id=p.id;
  return jsonb_build_object('id',p.id,'payment_amount',p.payment_amount,'confirmation_job_state',p.confirmation_job_state,'tariff_review_required',coalesce(p.tariff_review_required,false));
end;
$$;

create or replace function public.register_with_tariff_confirmation(registration jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants%rowtype; input public.participants%rowtype; a jsonb; c public.clubs%rowtype; eligible uuid; chosen_source text; verified text; needs_review boolean:=false;
begin
  input := jsonb_populate_record(null::public.participants,registration);
  if input.payment_method is distinct from 'bar' or input.registration_status is distinct from 'bar_registered' then
    raise exception using errcode='22023',message='Ungültige Baranmeldung.';
  end if;
  select * into c from public.clubs where id=input.club_id for share;
  if not found then raise exception 'Verein nicht gefunden.'; end if;
  input.is_member := false; input.payment_amount := coalesce(c.guest_price,10); chosen_source := 'guest';
  verified := lower(trim(registration->>'verified_email'));
  needs_review := coalesce((registration->>'tariff_review_required')::boolean,false);
  if nullif(trim(registration->>'member_code'),'') is not null and nullif(trim(c.member_code),'') is not null
     and upper(trim(registration->>'member_code'))=upper(trim(c.member_code)) then
    input.is_member := true; chosen_source := 'code'; needs_review := false;
  elsif verified=lower(trim(input.email)) then
    begin
      select m.id into eligible from public.club_members m where m.club_id=input.club_id and m.email=verified and m.is_active for share;
      if eligible is not null then input.is_member := true; chosen_source := 'verified_member'; needs_review := false; end if;
    exception when others then needs_review := true;
    end;
  end if;
  if input.is_member then input.payment_amount := coalesce(c.member_price,5); end if;
  if input.payment_amount<0 or input.payment_amount>100000 or input.payment_amount<>round(input.payment_amount,2) then raise exception 'Ungültige Vereinstarife.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(input.vaccination_date_id::text || ':' || lower(trim(input.email)),0));
  select to_jsonb(d) into a from public.vaccination_dates d
    where d.id=input.vaccination_date_id and d.club_id=input.club_id for share;
  if a is null or not public.mail_appointment_open(a) then raise exception using errcode='55000',message='Die Anmeldung ist geschlossen.'; end if;
  if exists(select 1 from public.participants existing where existing.vaccination_date_id=input.vaccination_date_id
    and lower(trim(existing.email))=lower(trim(input.email)) and existing.registration_status in ('bar_registered','completed','pending_payment')) then
    raise exception using errcode='23505',message='Für diese Adresse besteht bereits eine Anmeldung.';
  end if;
  -- Explicit allowlist: ids, check-in tokens, receipt/payment markers and timestamps
  -- cannot be supplied by the caller. Existing defaults and protection triggers apply.
  insert into public.participants(firstname,lastname,street,housenumber,zipcode,city,email,phone,tsk_number,
    vaccine,animal_type,animal_count,chicken_count,bantam_count,turkey_count,vaccination_date_id,club_id,
    is_member,payment_status,payment_amount,payment_method,registration_status,tariff_source,tariff_verified_email,confirmation_job_state,tariff_review_required)
  values(input.firstname,input.lastname,input.street,input.housenumber,input.zipcode,input.city,lower(trim(input.email)),input.phone,input.tsk_number,
    input.vaccine,input.animal_type,input.animal_count,input.chicken_count,input.bantam_count,input.turkey_count,input.vaccination_date_id,input.club_id,
    input.is_member,input.payment_status,input.payment_amount,input.payment_method,input.registration_status,chosen_source,case when chosen_source='verified_member' then verified else null end,'pending',needs_review)
  returning * into p;
  if nullif(p.checkin_token,'') is null then raise exception using errcode='55000',message='Die Check-in-Grundlage fehlt.'; end if;
  perform public.ensure_registration_job(p.id);
  select * into p from public.participants x where x.id=p.id;
  return jsonb_build_object('id',p.id,'payment_amount',p.payment_amount,'confirmation_job_state',p.confirmation_job_state,'tariff_review_required',coalesce(p.tariff_review_required,false));
end;
$$;
revoke all on function public.register_with_confirmation(jsonb),public.register_with_tariff_confirmation(jsonb) from public,anon,authenticated;
grant execute on function public.register_with_confirmation(jsonb),public.register_with_tariff_confirmation(jsonb) to service_role;
-- END_REGISTRATION_FUNCTIONS

revoke all on function public.ensure_registration_job(uuid),public.queue_registration_mail(),public.reconcile_registration_confirmations(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.ensure_registration_job(uuid),public.reconcile_registration_confirmations(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';

-- Membership rate-limit repair
-- Requires 20261106_verified_member_tariffs. No member/registration/tariff DML.

set local lock_timeout='5s';
alter table public.membership_email_challenges
  add column if not exists send_state text check(send_state in ('pending','sent','failed','uncertain'));
-- NULL preserves legacy challenges, whose SMTP outcome is unknown.
create or replace function public.reserve_membership_challenge_v2(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare wait_seconds integer:=0; candidate integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('membership-challenge:'||target_club::text,0));
  if not exists(select 1 from public.vaccination_dates d where d.id=target_appointment and d.club_id=target_club)
    or email_digest is null or otp_digest is null or length(email_digest)<>64 or length(otp_digest)<>64 then
    return jsonb_build_object('allowed',false,'reason','INVALID_SCOPE');
  end if;
  -- Per normalized address + club, across appointments. Definitive SMTP failures
  -- consume neither the resend cooldown nor the three-mail hourly quota.
  select greatest(0,ceil(extract(epoch from max(created_at)+interval '60 seconds'-now()))::integer)
    into candidate from public.membership_email_challenges
    where club_id=target_club and email_hash=email_digest and send_state is distinct from 'failed'
      and created_at>now()-interval '60 seconds';
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  select ceil(extract(epoch from min(created_at)+interval '1 hour'-now()))::integer into candidate
    from (select created_at from public.membership_email_challenges
      where club_id=target_club and email_hash=email_digest and send_state is distinct from 'failed'
        and created_at>now()-interval '1 hour' order by created_at desc offset 2 limit 1) quota;
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  -- Separate protection against endless technical retries: six attempts/10 min.
  select ceil(extract(epoch from created_at+interval '10 minutes'-now()))::integer into candidate
    from public.membership_email_challenges where club_id=target_club and email_hash=email_digest
      and created_at>now()-interval '10 minutes' order by created_at desc offset 5 limit 1;
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  -- High emergency circuit breaker, not the former 200/hour normal-user quota.
  -- Counts reservations, including in-flight/ambiguous results, to bound SMTP load.
  select ceil(extract(epoch from created_at+interval '1 hour'-now()))::integer into candidate
    from public.membership_email_challenges where club_id=target_club
      and created_at>now()-interval '1 hour' order by created_at desc offset 999 limit 1;
  if coalesce(candidate,0)>0 then
    return jsonb_build_object('allowed',false,'reason','CLUB_SAFETY_LIMIT','retryAfter',greatest(wait_seconds,candidate));
  end if;
  if wait_seconds>0 then return jsonb_build_object('allowed',false,'reason','ADDRESS_LIMIT','retryAfter',wait_seconds); end if;
  insert into public.membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,send_state)
    values(challenge_id,target_club,target_appointment,email_digest,otp_digest,'pending');
  return jsonb_build_object('allowed',true);
end;
$$;

create or replace function public.finish_membership_challenge(challenge_id uuid,target_club uuid,outcome text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if outcome not in ('sent','failed','uncertain') or outcome is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('membership-challenge:'||target_club::text,0));
  update public.membership_email_challenges set send_state=outcome
    where id=challenge_id and club_id=target_club and send_state='pending';
  return found;
end;
$$;
-- Compatibility for a rolling deployment: old servers still reserve conservatively.
create or replace function public.reserve_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  return (public.reserve_membership_challenge_v2(challenge_id,target_club,target_appointment,email_digest,otp_digest)->>'allowed')::boolean;
end;
$$;
-- Failed reservations cannot be used to verify an address. Existing pending/legacy
-- codes remain usable, even if SMTP succeeded but recording its outcome failed.
create or replace function public.verify_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
declare challenge public.membership_email_challenges%rowtype;
begin
  select * into challenge from public.membership_email_challenges c where c.id=challenge_id
    and c.club_id=target_club and c.appointment_id=target_appointment and c.email_hash=email_digest for update;
  if not found or challenge.send_state='failed' or challenge.expires_at<=now()
    or challenge.consumed_at is not null or challenge.attempts>=5 then return false; end if;
  update public.membership_email_challenges set attempts=attempts+1 where id=challenge.id;
  if challenge.code_hash<>otp_digest then return false; end if;
  update public.membership_email_challenges set consumed_at=now() where id=challenge.id;
  return true;
end;
$$;
revoke all on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.finish_membership_challenge(uuid,uuid,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.finish_membership_challenge(uuid,uuid,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';

grant select on public.club_members to service_role;
notify pgrst,'reload schema';
commit;
