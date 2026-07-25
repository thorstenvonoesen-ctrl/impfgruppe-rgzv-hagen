-- Nicht-destruktiver Versandstatus für die intelligente Vereins-Ampel.
alter table public.vaccination_dates
  add column if not exists vet_certificate_generated_at timestamptz,
  add column if not exists vet_certificate_sent_at timestamptz;

create index if not exists vaccination_dates_club_date_vet_status_idx
  on public.vaccination_dates (club_id, date, vet_certificate_sent_at);
