-- Additive check-in prerequisites; never changes an existing QR or attendance flag.
begin;
set local lock_timeout='5s';
alter table public.participants
  add column if not exists checkin_method text check(checkin_method is null or checkin_method in ('qr','manual'));
-- Fail safely on duplicate old tokens instead of silently choosing a participant.
create unique index if not exists participants_checkin_token_key
  on public.participants(checkin_token) where checkin_token is not null;
create index if not exists participants_checkin_search_date_idx
  on public.participants(club_id,vaccination_date_id);
notify pgrst,'reload schema';
commit;
