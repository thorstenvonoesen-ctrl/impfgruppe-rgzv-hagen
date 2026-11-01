-- Adds email proof and automatic tariffs for NEW registrations only.
-- Requires member directory (20261104), confirmation outbox (20261105) and its prerequisites.
-- No existing participant, member, amount or code is updated; no email is sent.
begin;
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
commit;
