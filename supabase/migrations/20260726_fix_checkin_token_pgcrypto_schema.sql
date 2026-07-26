-- Resolve pgcrypto explicitly from Supabase's extensions schema.
-- Existing check-in tokens are preserved; only missing tokens are backfilled.
create or replace function public.assign_participant_checkin_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Always replace a browser-supplied token with cryptographically secure server data.
  new.checkin_token := encode(extensions.gen_random_bytes(32), 'hex');
  new.checked_in := false;
  new.checked_in_at := null;
  new.checked_in_by := null;
  return new;
end;
$$;

update public.participants
set checkin_token = encode(extensions.gen_random_bytes(32), 'hex')
where checkin_token is null;
