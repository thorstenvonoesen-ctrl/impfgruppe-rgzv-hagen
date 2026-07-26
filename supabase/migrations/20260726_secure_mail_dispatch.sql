alter table public.participants
  add column if not exists payment_email_sent_at timestamptz,
  add column if not exists payment_email_reference text;

create index if not exists participants_payment_email_reference_idx
  on public.participants (payment_email_reference)
  where payment_email_reference is not null;

create table if not exists public.mail_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  vaccination_date_id uuid not null references public.vaccination_dates(id) on delete cascade,
  event_type text not null check (event_type in ('appointment-time', 'appointment-meeting-point')),
  event_key text not null unique,
  status text not null default 'sending' check (status in ('sending', 'completed', 'partial')),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists mail_dispatch_events_club_date_idx
  on public.mail_dispatch_events (club_id, vaccination_date_id, created_at desc);

alter table public.mail_dispatch_events enable row level security;

revoke all on public.mail_dispatch_events from anon, authenticated;
