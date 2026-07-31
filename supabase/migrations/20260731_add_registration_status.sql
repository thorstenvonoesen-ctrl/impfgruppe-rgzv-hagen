alter table public.participants
  add column if not exists registration_status text;

update public.participants
set registration_status = case
  when payment_status = 'bezahlt' then 'completed'
  when payment_method = 'bar' and payment_status = 'offen' then 'bar_registered'
  else 'pending_payment'
end
where registration_status is null
   or registration_status not in (
     'pending_payment', 'completed', 'bar_registered',
     'cancelled', 'expired', 'payment_failed'
   );

alter table public.participants
  alter column registration_status set default 'pending_payment',
  alter column registration_status set not null;

alter table public.participants
  drop constraint if exists participants_registration_status_check;

alter table public.participants
  add constraint participants_registration_status_check
  check (registration_status in (
    'pending_payment', 'completed', 'bar_registered',
    'cancelled', 'expired', 'payment_failed'
  ));

create index if not exists participants_registration_status_lookup_idx
  on public.participants (club_id, vaccination_date_id, registration_status);

create or replace function public.mark_season_campaign_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment public.vaccination_dates%rowtype;
  campaign_id_value uuid;
begin
  if new.registration_status not in ('completed', 'bar_registered') then
    return new;
  end if;

  select * into appointment
  from public.vaccination_dates
  where id = new.vaccination_date_id;

  if not found
    or appointment.club_id <> new.club_id
    or to_jsonb(appointment)::text ilike '%test%'
    or new.email_normalized = '' then
    return new;
  end if;

  select campaign.id into campaign_id_value
  from public.season_email_campaigns campaign
  where campaign.club_id = new.club_id
    and campaign.season_year = extract(year from appointment.date)::integer
    and campaign.status in ('sending', 'sent', 'partial')
  limit 1;

  if campaign_id_value is null then return new; end if;

  update public.season_email_recipients recipient
  set returned_at = coalesce(recipient.returned_at, new.created_at, now()),
      registration_id = coalesce(recipient.registration_id, new.id)
  where recipient.campaign_id = campaign_id_value
    and recipient.email_normalized = new.email_normalized
    and recipient.status = 'sent'
    and recipient.returned_at is null;

  return new;
end;
$$;

drop trigger if exists participants_mark_season_campaign_return on public.participants;
create trigger participants_mark_season_campaign_return
  after insert or update of email, vaccination_date_id, club_id, registration_status
  on public.participants
  for each row execute function public.mark_season_campaign_return();

create or replace function public.sync_season_campaign_returns(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with matches as (
    select recipient.id as recipient_id,
           participant.id as registration_id,
           participant.created_at as registered_at,
           row_number() over (
             partition by recipient.id order by participant.created_at asc
           ) as match_rank
    from public.season_email_recipients recipient
    join public.season_email_campaigns campaign on campaign.id = recipient.campaign_id
    join public.participants participant
      on participant.club_id = campaign.club_id
     and participant.email_normalized = recipient.email_normalized
     and participant.registration_status in ('completed', 'bar_registered')
    join public.vaccination_dates appointment on appointment.id = participant.vaccination_date_id
    where campaign.id = target_campaign_id
      and recipient.status = 'sent'
      and recipient.returned_at is null
      and extract(year from appointment.date)::integer = campaign.season_year
      and not (to_jsonb(appointment)::text ilike '%test%')
  )
  update public.season_email_recipients recipient
  set registration_id = matches.registration_id,
      returned_at = matches.registered_at
  from matches
  where recipient.id = matches.recipient_id
    and matches.match_rank = 1;
end;
$$;
