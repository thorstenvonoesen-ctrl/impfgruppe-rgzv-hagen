-- No bulk repricing. Existing participant/member data is untouched on installation.
begin;
set local lock_timeout='5s';
create or replace function public.active_club_member_matches(target_club uuid,verified_email text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.club_members m where m.club_id=target_club
    and m.is_active and lower(trim(m.email))=lower(trim(verified_email)));
$$;
revoke all on function public.active_club_member_matches(uuid,text) from public,anon,authenticated;
grant execute on function public.active_club_member_matches(uuid,text) to service_role;
grant select on public.club_members to service_role;

-- Patch only the comparison, retaining the installed registration/outbox behavior.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.register_with_tariff_confirmation(jsonb)'::regprocedure) into definition;
  if position('m.email=verified' in definition)>0 then
    execute replace(definition,'m.email=verified','lower(trim(m.email))=verified');
  elsif position('lower(trim(m.email))=verified' in definition)=0 then
    raise exception 'Unbekannte Tarif-RPC. Vollständiges Reparaturpaket verwenden.';
  end if;
  select pg_get_functiondef('public.manage_registration(uuid,integer,text,jsonb)'::regprocedure) into definition;
  if position('m.email=lower(trim(changes->>''email''))' in definition)>0 then
    execute replace(definition,'m.email=lower(trim(changes->>''email''))','lower(trim(m.email))=lower(trim(changes->>''email''))');
  elsif position('lower(trim(m.email))=lower(trim(changes->>''email''))' in definition)=0 then
    raise exception 'Unbekannte Verwaltungs-RPC. Vollständiges Reparaturpaket verwenden.';
  end if;
end;
$$;

-- No FK on participants: leaves the working individual-deletion routine unchanged.
create table if not exists public.member_tariff_corrections(
  id uuid primary key default gen_random_uuid(),club_id uuid not null,
  participant_id uuid not null unique,member_id uuid not null,
  previous_amount numeric not null,corrected_amount numeric not null,
  evidence text not null check(evidence='fresh_email_otp'),created_at timestamptz not null default now()
);
alter table public.member_tariff_corrections enable row level security;
revoke all on public.member_tariff_corrections from public,anon,authenticated;
grant select on public.member_tariff_corrections to service_role;
create or replace function public.correct_verified_member_tariff(target_id uuid,target_club uuid,verified_email text,expected_amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.participants%rowtype;c public.clubs%rowtype;a jsonb;member_id uuid;old_amount numeric;
begin
  select * into p from public.participants x where x.id=target_id and x.club_id=target_club for update;
  if not found or lower(trim(p.email)) is distinct from lower(trim(verified_email)) or verified_email is null then
    raise exception using errcode='42501',message='Bestätigte Adresse passt nicht zur Anmeldung.';
  end if;
  select m.id into member_id from public.club_members m where m.club_id=target_club
    and m.is_active and lower(trim(m.email))=lower(trim(verified_email)) limit 1 for share;
  if member_id is null then raise exception using errcode='42501',message='Keine aktive Mitgliedschaft.';end if;
  select * into c from public.clubs x where x.id=target_club for share;
  if not found then raise exception 'Verein nicht gefunden.';end if;
  select to_jsonb(d) into a from public.vaccination_dates d where d.id=p.vaccination_date_id and d.club_id=p.club_id for share;
  if a is null or not public.mail_appointment_open(a) or p.checked_in
    or p.registration_status is distinct from 'bar_registered' or p.payment_method is distinct from 'bar'
    or p.payment_status is distinct from 'offen' then
    raise exception using errcode='55000',message='Diese Anmeldung benötigt eine manuelle Abrechnungsprüfung.';
  end if;
  if p.tariff_source='verified_member' and p.is_member and p.payment_amount=coalesce(c.member_price,5) then return to_jsonb(p);end if;
  if p.payment_amount is distinct from expected_amount or p.payment_amount is distinct from coalesce(c.guest_price,10)
    or coalesce(c.member_price,5)<0 or coalesce(c.member_price,5)>p.payment_amount then
    raise exception using errcode='55000',message='Betrag zwischenzeitlich geändert oder kein regulärer Gasttarif.';
  end if;
  old_amount:=p.payment_amount;
  update public.participants set payment_amount=coalesce(c.member_price,5),is_member=true,
    tariff_source='verified_member',tariff_verified_email=lower(trim(verified_email)),tariff_review_required=false
    where id=p.id returning * into p;
  insert into public.member_tariff_corrections(club_id,participant_id,member_id,previous_amount,corrected_amount,evidence)
    values(p.club_id,p.id,member_id,old_amount,p.payment_amount,'fresh_email_otp');
  return to_jsonb(p);
end;
$$;
revoke all on function public.correct_verified_member_tariff(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.correct_verified_member_tariff(uuid,uuid,text,numeric) to service_role;
notify pgrst,'reload schema';
commit;
