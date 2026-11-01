-- Vollständige, wiederholbare Reparatur für den administrativen Mail-Rundversand.
-- Im SQL Editor des tatsächlich verwendeten Supabase-Projekts als postgres ausführen.
-- Kein Versand, keine Datenlöschung, kein UPDATE von Teilnehmern/Terminen/Versandprotokollen.
-- Unvollständige historische Pflichtdaten oder widersprüchliche Typen führen zum
-- sicheren Abbruch der gesamten Transaktion; sie werden niemals geraten/überschrieben.
begin;
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
commit;

-- Erfolgskontrolle ohne personenbezogene Daten oder Versand:
select to_regclass('public.mail_batches') is not null as mail_batches_ready,
       to_regclass('public.mail_deliveries') is not null as mail_deliveries_ready,
       to_regprocedure('public.create_mail_batch(text,uuid,uuid,text,jsonb)') is not null as batch_function_ready,
       to_regprocedure('public.claim_mail_delivery(uuid)') is not null as claim_function_ready;
