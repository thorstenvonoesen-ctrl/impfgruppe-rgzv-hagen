-- Requires 20261109. Removes every reservation quota without modifying old rows.
begin;
set local lock_timeout='5s';
create or replace function public.reserve_membership_challenge_v2(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if challenge_id is null or not exists(select 1 from public.vaccination_dates d
    where d.id=target_appointment and d.club_id=target_club)
    or email_digest is null or otp_digest is null
    or email_digest !~ '^[0-9a-f]{64}$' or otp_digest !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('allowed',false,'reason','INVALID_SCOPE');
  end if;
  -- No timestamps/counters/IP/shared-club budgets are consulted. Historic attempts
  -- therefore cannot block new requests. Each request receives a fresh identifier.
  insert into public.membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,send_state)
    values(challenge_id,target_club,target_appointment,email_digest,otp_digest,'pending');
  return jsonb_build_object('allowed',true);
end;
$$;
-- Old and current application versions both use the unrestricted implementation.
create or replace function public.reserve_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  return (public.reserve_membership_challenge_v2(challenge_id,target_club,target_appointment,email_digest,otp_digest)->>'allowed')::boolean;
end;
$$;
revoke all on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
