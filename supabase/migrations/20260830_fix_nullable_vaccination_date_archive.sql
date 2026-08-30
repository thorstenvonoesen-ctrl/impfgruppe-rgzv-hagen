-- Repair installations where the archive column was created nullable before the
-- final archive migration. No appointment or participant data is removed.
alter table public.vaccination_dates
  add column if not exists archived boolean;

update public.vaccination_dates
set archived = false
where archived is null;

alter table public.vaccination_dates
  alter column archived set default false,
  alter column archived set not null;

create index if not exists vaccination_dates_club_archived_date_idx
  on public.vaccination_dates (club_id, archived, date desc);
