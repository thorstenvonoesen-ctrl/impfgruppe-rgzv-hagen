-- Standalone campaign queue repair. No historical backfill, participant updates or mail sending.
-- Requires existing clubs/vaccination_dates/participants tables and registration status/check-in foundation.
begin;
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


revoke all on function public.mail_appointment_open(jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mail_appointment_open(jsonb), public.claim_mail_delivery(uuid), public.create_mail_batch(text,uuid,uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
