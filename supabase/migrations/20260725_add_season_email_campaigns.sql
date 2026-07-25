create table if not exists public.season_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_year integer not null check (season_year between 2000 and 2200),
  vaccination_date_id uuid not null references public.vaccination_dates(id) on delete cascade,
  status text not null check (status in ('sending', 'sent', 'partial', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, season_year)
);

create table if not exists public.season_email_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.season_email_campaigns(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email_normalized)
);

create table if not exists public.season_email_preferences (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  unsubscribed boolean not null default true,
  unsubscribed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (club_id, email_normalized)
);

alter table public.season_email_campaigns enable row level security;
alter table public.season_email_recipients enable row level security;
alter table public.season_email_preferences enable row level security;

revoke all on public.season_email_campaigns from anon, authenticated;
revoke all on public.season_email_recipients from anon, authenticated;
revoke all on public.season_email_preferences from anon, authenticated;
