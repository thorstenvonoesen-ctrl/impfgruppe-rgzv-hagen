-- Optionale Veranstaltungsadresse pro Impftermin.
-- Bestehende Termine bleiben unverändert und funktionieren weiterhin ohne Adresse.
alter table public.vaccination_dates
  add column if not exists venue_name text,
  add column if not exists street text,
  add column if not exists house_number text,
  add column if not exists postal_code text,
  add column if not exists city text;
