-- Apply before the matching application release. No emails are sent by this migration.
alter table public.participants add column if not exists mail_revision integer not null default 0;
alter table public.vaccination_dates
  add column if not exists time time,
  add column if not exists registration_closes_at timestamptz,
  add column if not exists registration_closed boolean not null default false;

create table if not exists public.mail_batches (
  id text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  appointment_id uuid not null references public.vaccination_dates(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.mail_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  club_id uuid not null references public.clubs(id) on delete cascade,
  appointment_id uuid references public.vaccination_dates(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  kind text not null,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','uncertain','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists mail_deliveries_pending_idx on public.mail_deliveries(next_attempt_at) where status in ('pending','failed');
alter table public.mail_batches enable row level security;
alter table public.mail_deliveries enable row level security;
revoke all on public.mail_batches, public.mail_deliveries from anon, authenticated;
grant all on public.mail_batches, public.mail_deliveries to service_role;

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

-- Creation and its notification are committed together; no historical backfill.
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

-- The server verifies the unguessable management link before invoking this RPC.
-- Row locks enforce the deadline and prevent concurrent edits/cancellations.
create or replace function public.manage_registration(target_id uuid, expected_revision integer, operation text, changes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.participants; a jsonb; k text;
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
    if (to_jsonb(p) @> changes) then return to_jsonb(p); end if;
    update public.participants set firstname=changes->>'firstname', lastname=changes->>'lastname', email=changes->>'email',
      street=changes->>'street', housenumber=changes->>'housenumber', zipcode=changes->>'zipcode', city=changes->>'city',
      phone=changes->>'phone', tsk_number=changes->>'tsk_number', animal_type=changes->>'animal_type',
      animal_count=(changes->>'animal_count')::integer, chicken_count=(changes->>'chicken_count')::integer,
      bantam_count=(changes->>'bantam_count')::integer, turkey_count=(changes->>'turkey_count')::integer,
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
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=target_appointment and d.club_id=target_club for share;
  if a is null or coalesce((a->>'archived')::boolean,false) or coalesce((a->>'is_test')::boolean,false)
      or exists(select 1 from jsonb_each_text(a) kv where kv.value ilike '%test%') then raise exception 'Kein Rundversand für diesen Termin.'; end if;
  if mail_kind = 'new-appointment' and not public.mail_appointment_open(a) then raise exception 'Anmeldung geschlossen.'; end if;
  if deliveries->0->'payload'->'appointment' is distinct from a then raise exception 'Termindaten geändert. Vorschau neu laden.'; end if;
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

revoke all on function public.mail_appointment_open(jsonb), public.queue_registration_mail(), public.manage_registration(uuid,integer,text,jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mail_appointment_open(jsonb), public.manage_registration(uuid,integer,text,jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) to service_role;
revoke all on function public.guard_cash_registration() from public, anon, authenticated;

create or replace function public.queue_due_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare added integer;
begin
  with dates as (
    select d.*, coalesce(nullif(to_jsonb(d)->>'time','')::time,
      substring(d.title from '(?:[01]?[0-9]|2[0-3]):[0-5][0-9]')::time) as event_time
    from public.vaccination_dates d where not coalesce(d.archived,false)
      and not coalesce((to_jsonb(d)->>'is_test')::boolean,false)
      and not exists(select 1 from jsonb_each_text(to_jsonb(d)) kv where kv.value ilike '%test%')
  ), due as (
    select d.id, d.club_id, k.kind,
      case when k.kind='reminder-7d' then ((d.date::date - 7) + d.event_time) at time zone 'Europe/Berlin'
      else ((d.date::date + d.event_time) at time zone 'Europe/Berlin') - interval '24 hours' end as due_at
    from dates d cross join (values ('reminder-7d'), ('reminder-24h')) k(kind) where d.event_time is not null
  )
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    select due.kind || ':' || p.id,p.club_id,p.vaccination_date_id,p.id,due.kind,lower(trim(p.email)),
      jsonb_build_object('participant',to_jsonb(p),'appointment',to_jsonb(d))
    from due join public.participants p on p.vaccination_date_id=due.id and p.club_id=due.club_id
      join public.vaccination_dates d on d.id=due.id
    where now() >= due.due_at and now() < due.due_at + interval '6 hours'
      and p.registration_status in ('completed','bar_registered')
      and not exists(select 1 from public.mail_deliveries m where m.event_key=due.kind || ':' || p.id and m.status <> 'skipped')
    order by due.due_at,p.id limit 1000 on conflict(event_key) do update
      set status='pending', payload=excluded.payload, recipient=excluded.recipient, next_attempt_at=now(), attempts=0
      where mail_deliveries.status='skipped';
  get diagnostics added = row_count;
  return added;
end;
$$;
revoke all on function public.queue_due_reminders() from public, anon, authenticated;
grant execute on function public.queue_due_reminders() to service_role;
