-- Requires 20261103_complete_mail_queue_repair.sql and the existing check-in/participant foundation.
-- No historical participant changes, no automatic historical mail jobs, no SMTP calls.
begin;
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
commit;
