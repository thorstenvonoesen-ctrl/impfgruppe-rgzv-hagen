-- Nicht-destruktive Live-Auswertung saisonaler Erinnerungsmails.
alter table public.participants
  add column if not exists email_normalized text
  generated always as (lower(btrim(coalesce(email, '')))) stored;

alter table public.season_email_recipients
  add column if not exists returned_at timestamptz,
  add column if not exists registration_id uuid references public.participants(id) on delete set null;

create index if not exists participants_campaign_email_lookup_idx
  on public.participants (club_id, email_normalized, vaccination_date_id);

create index if not exists season_email_recipients_campaign_status_idx
  on public.season_email_recipients (campaign_id, status, email_normalized);

create index if not exists season_email_campaigns_club_year_status_idx
  on public.season_email_campaigns (club_id, season_year, status);

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

  if campaign_id_value is null then
    return new;
  end if;

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

drop trigger if exists participants_mark_season_campaign_return
  on public.participants;
create trigger participants_mark_season_campaign_return
  after insert or update of email, vaccination_date_id, club_id
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
    select
      recipient.id as recipient_id,
      participant.id as registration_id,
      participant.created_at as registered_at,
      row_number() over (
        partition by recipient.id
        order by participant.created_at asc
      ) as match_rank
    from public.season_email_recipients recipient
    join public.season_email_campaigns campaign
      on campaign.id = recipient.campaign_id
    join public.participants participant
      on participant.club_id = campaign.club_id
     and participant.email_normalized = recipient.email_normalized
    join public.vaccination_dates appointment
      on appointment.id = participant.vaccination_date_id
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

create or replace function public.season_campaign_summary(target_club_id uuid)
returns table (
  campaign_id uuid,
  season_year integer,
  campaign_status text,
  vaccination_date_id uuid,
  finished_at timestamptz,
  sent_count bigint,
  returned_count bigint,
  open_count bigint,
  failed_count bigint,
  response_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    campaign.id,
    campaign.season_year,
    campaign.status,
    campaign.vaccination_date_id,
    campaign.finished_at,
    count(recipient.id) filter (where recipient.status = 'sent') as sent_count,
    count(recipient.id) filter (
      where recipient.status = 'sent' and recipient.returned_at is not null
    ) as returned_count,
    count(recipient.id) filter (
      where recipient.status = 'sent' and recipient.returned_at is null
    ) as open_count,
    count(recipient.id) filter (where recipient.status = 'failed') as failed_count,
    case
      when count(recipient.id) filter (where recipient.status = 'sent') = 0 then null
      else round(
        100.0 * count(recipient.id) filter (
          where recipient.status = 'sent' and recipient.returned_at is not null
        ) / count(recipient.id) filter (where recipient.status = 'sent'),
        1
      )
    end as response_rate
  from public.season_email_campaigns campaign
  left join public.season_email_recipients recipient
    on recipient.campaign_id = campaign.id
  where campaign.club_id = target_club_id
  group by campaign.id
  order by campaign.season_year desc;
$$;

create or replace function public.season_campaign_detail(
  target_campaign_id uuid,
  target_club_id uuid
)
returns table (
  email_normalized text,
  firstname text,
  lastname text,
  returned_at timestamptz,
  registration_id uuid,
  last_participation_year integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    recipient.email_normalized,
    previous_participant.firstname,
    previous_participant.lastname,
    recipient.returned_at,
    recipient.registration_id,
    extract(year from previous_appointment.date)::integer
  from public.season_email_recipients recipient
  join public.season_email_campaigns campaign
    on campaign.id = recipient.campaign_id
   and campaign.club_id = target_club_id
  left join public.participants previous_participant
    on previous_participant.id = recipient.participant_id
  left join public.vaccination_dates previous_appointment
    on previous_appointment.id = previous_participant.vaccination_date_id
  where recipient.campaign_id = target_campaign_id
    and recipient.status = 'sent'
  order by recipient.returned_at nulls last,
           previous_participant.lastname,
           previous_participant.firstname;
$$;

do $$
declare
  campaign record;
begin
  for campaign in select id from public.season_email_campaigns loop
    perform public.sync_season_campaign_returns(campaign.id);
  end loop;
end;
$$;

revoke all on function public.mark_season_campaign_return() from public, anon, authenticated;
revoke all on function public.sync_season_campaign_returns(uuid) from public, anon, authenticated;
revoke all on function public.season_campaign_summary(uuid) from public, anon, authenticated;
revoke all on function public.season_campaign_detail(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_season_campaign_returns(uuid) to service_role;
grant execute on function public.season_campaign_summary(uuid) to service_role;
grant execute on function public.season_campaign_detail(uuid, uuid) to service_role;
