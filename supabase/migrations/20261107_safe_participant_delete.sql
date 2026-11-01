-- Single-registration deletion with scoped outbox cleanup.
-- Installing this migration does NOT delete any rows or send emails.
begin;
set local lock_timeout='5s';
create or replace function public.delete_participant_registration(target_club uuid,target_participant uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.participants%rowtype; archived boolean; mail_count integer:=0; retry_count integer:=0; removed integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.club_admin_memberships m where m.user_id=auth.uid() and m.active
      and (m.role='superadmin' or (m.role='clubadmin' and m.club_id=target_club))
  ) then raise exception using errcode='42501',message='Keine Berechtigung für diesen Verein.'; end if;

  select * into p from public.participants existing where existing.id=target_participant and existing.club_id=target_club for update;
  if not found then raise exception using errcode='P0002',message='Anmeldung nicht gefunden.'; end if;
  select coalesce((to_jsonb(d)->>'archived')::boolean,false) into archived
    from public.vaccination_dates d where d.id=p.vaccination_date_id and d.club_id=target_club for share;
  if not found then raise exception using errcode='23514',message='Terminzuordnung ist nicht gültig.'; end if;
  if archived then raise exception using errcode='55000',message='Archivierte Anmeldungen sind schreibgeschützt.'; end if;

  if to_regclass('public.mail_deliveries') is not null then
    -- Lock all linked jobs in a fixed order before cleanup. claim_mail_delivery
    -- waits on these locks and cannot claim a job after it has been removed.
    perform 1 from public.mail_deliveries d where d.participant_id=p.id order by d.id for update;
    if exists(select 1 from public.mail_deliveries d where d.participant_id=p.id and d.club_id is distinct from target_club) then
      raise exception using errcode='23514',message='Versanddaten sind widersprüchlich zugeordnet.';
    end if;
    if exists(select 1 from public.mail_deliveries d where d.participant_id=p.id and d.status='sending') then
      raise exception using errcode='55006',message='Für diese Anmeldung läuft gerade ein E-Mail-Versand.';
    end if;
    if to_regclass('public.mail_delivery_retries') is not null then
      if exists(select 1 from public.mail_delivery_retries r join public.mail_deliveries d on d.id=r.delivery_id
        where d.participant_id=p.id and r.club_id is distinct from target_club) then
        raise exception using errcode='23514',message='Versandprotokolle sind widersprüchlich zugeordnet.';
      end if;
      delete from public.mail_delivery_retries r using public.mail_deliveries d
        where r.delivery_id=d.id and d.participant_id=p.id and d.club_id=target_club and r.club_id=target_club;
      get diagnostics retry_count=row_count;
    end if;
    delete from public.mail_deliveries d where d.participant_id=p.id and d.club_id=target_club;
    get diagnostics mail_count=row_count;
  end if;
  -- Keep existing participant protection triggers intact. Unknown dependencies
  -- fail here and roll back ALL cleanup instead of leaving a partial deletion.
  delete from public.participants existing where existing.id=p.id and existing.club_id=target_club;
  get diagnostics removed=row_count;
  if removed<>1 then raise exception using errcode='P0002',message='Anmeldung konnte nicht eindeutig gelöscht werden.'; end if;
  return jsonb_build_object('deleted',true,'participantId',p.id,'deletedDeliveries',mail_count,'deletedRetryLogs',retry_count);
end;
$$;
revoke all on function public.delete_participant_registration(uuid,uuid) from public,anon;
grant execute on function public.delete_participant_registration(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
