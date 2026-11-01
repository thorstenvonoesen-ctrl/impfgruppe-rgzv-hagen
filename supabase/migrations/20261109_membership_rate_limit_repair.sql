-- Requires 20261106_verified_member_tariffs. No member/registration/tariff DML.
begin;
set local lock_timeout='5s';
alter table public.membership_email_challenges
  add column if not exists send_state text check(send_state in ('pending','sent','failed','uncertain'));
-- NULL preserves legacy challenges, whose SMTP outcome is unknown.
create or replace function public.reserve_membership_challenge_v2(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare wait_seconds integer:=0; candidate integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('membership-challenge:'||target_club::text,0));
  if not exists(select 1 from public.vaccination_dates d where d.id=target_appointment and d.club_id=target_club)
    or email_digest is null or otp_digest is null or length(email_digest)<>64 or length(otp_digest)<>64 then
    return jsonb_build_object('allowed',false,'reason','INVALID_SCOPE');
  end if;
  -- Per normalized address + club, across appointments. Definitive SMTP failures
  -- consume neither the resend cooldown nor the three-mail hourly quota.
  select greatest(0,ceil(extract(epoch from max(created_at)+interval '60 seconds'-now()))::integer)
    into candidate from public.membership_email_challenges
    where club_id=target_club and email_hash=email_digest and send_state is distinct from 'failed'
      and created_at>now()-interval '60 seconds';
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  select ceil(extract(epoch from min(created_at)+interval '1 hour'-now()))::integer into candidate
    from (select created_at from public.membership_email_challenges
      where club_id=target_club and email_hash=email_digest and send_state is distinct from 'failed'
        and created_at>now()-interval '1 hour' order by created_at desc offset 2 limit 1) quota;
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  -- Separate protection against endless technical retries: six attempts/10 min.
  select ceil(extract(epoch from created_at+interval '10 minutes'-now()))::integer into candidate
    from public.membership_email_challenges where club_id=target_club and email_hash=email_digest
      and created_at>now()-interval '10 minutes' order by created_at desc offset 5 limit 1;
  wait_seconds:=greatest(wait_seconds,coalesce(candidate,0));
  -- High emergency circuit breaker, not the former 200/hour normal-user quota.
  -- Counts reservations, including in-flight/ambiguous results, to bound SMTP load.
  select ceil(extract(epoch from created_at+interval '1 hour'-now()))::integer into candidate
    from public.membership_email_challenges where club_id=target_club
      and created_at>now()-interval '1 hour' order by created_at desc offset 999 limit 1;
  if coalesce(candidate,0)>0 then
    return jsonb_build_object('allowed',false,'reason','CLUB_SAFETY_LIMIT','retryAfter',greatest(wait_seconds,candidate));
  end if;
  if wait_seconds>0 then return jsonb_build_object('allowed',false,'reason','ADDRESS_LIMIT','retryAfter',wait_seconds); end if;
  insert into public.membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,send_state)
    values(challenge_id,target_club,target_appointment,email_digest,otp_digest,'pending');
  return jsonb_build_object('allowed',true);
end;
$$;

create or replace function public.finish_membership_challenge(challenge_id uuid,target_club uuid,outcome text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if outcome not in ('sent','failed','uncertain') or outcome is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('membership-challenge:'||target_club::text,0));
  update public.membership_email_challenges set send_state=outcome
    where id=challenge_id and club_id=target_club and send_state='pending';
  return found;
end;
$$;
-- Compatibility for a rolling deployment: old servers still reserve conservatively.
create or replace function public.reserve_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  return (public.reserve_membership_challenge_v2(challenge_id,target_club,target_appointment,email_digest,otp_digest)->>'allowed')::boolean;
end;
$$;
-- Failed reservations cannot be used to verify an address. Existing pending/legacy
-- codes remain usable, even if SMTP succeeded but recording its outcome failed.
create or replace function public.verify_membership_challenge(challenge_id uuid,target_club uuid,target_appointment uuid,email_digest text,otp_digest text)
returns boolean language plpgsql security definer set search_path=public as $$
declare challenge public.membership_email_challenges%rowtype;
begin
  select * into challenge from public.membership_email_challenges c where c.id=challenge_id
    and c.club_id=target_club and c.appointment_id=target_appointment and c.email_hash=email_digest for update;
  if not found or challenge.send_state='failed' or challenge.expires_at<=now()
    or challenge.consumed_at is not null or challenge.attempts>=5 then return false; end if;
  update public.membership_email_challenges set attempts=attempts+1 where id=challenge.id;
  if challenge.code_hash<>otp_digest then return false; end if;
  update public.membership_email_challenges set consumed_at=now() where id=challenge.id;
  return true;
end;
$$;
revoke all on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.finish_membership_challenge(uuid,uuid,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text),public.finish_membership_challenge(uuid,uuid,text),public.reserve_membership_challenge(uuid,uuid,uuid,text,text),public.verify_membership_challenge(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
