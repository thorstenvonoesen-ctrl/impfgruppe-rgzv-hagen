-- Öffentliche Freigabe der optionalen Veranstaltungsadresse pro Impftermin.
-- Standardmäßig bleibt jede Adresse privat.
alter table public.vaccination_dates
  add column if not exists address_public boolean not null default false;
