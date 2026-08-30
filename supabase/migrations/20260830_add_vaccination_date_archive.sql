-- Archive completed vaccination dates without moving or deleting historical data.
alter table public.vaccination_dates
  add column if not exists archived boolean;

-- A pre-existing nullable column is possible when archive support was partially
-- deployed. Existing dates must always remain active unless explicitly archived.
update public.vaccination_dates
set archived = false
where archived is null;

alter table public.vaccination_dates
  alter column archived set default false,
  alter column archived set not null;

create index if not exists vaccination_dates_club_archived_date_idx
  on public.vaccination_dates (club_id, archived, date desc);

create or replace function public.protect_archived_vaccination_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.archived then
    raise exception using
      errcode = '55000',
      message = 'Archived vaccination dates are read-only.';
  end if;

  if tg_op = 'UPDATE' and (old.archived or new.archived) then
    if (to_jsonb(new) - 'archived') is distinct from (to_jsonb(old) - 'archived') then
      raise exception using
        errcode = '55000',
        message = 'Only the archive status may be changed while archiving or restoring a vaccination date.';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.archived is distinct from new.archived
     and not exists (
       select 1
       from public.club_admin_memberships membership
       where membership.user_id = auth.uid()
         and membership.active = true
         and (
           membership.role = 'superadmin'
           or (membership.role = 'clubadmin' and membership.club_id = old.club_id)
         )
     ) then
    raise exception using
      errcode = '42501',
      message = 'Only authorized club administrators may archive or restore vaccination dates.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists vaccination_dates_protect_archive on public.vaccination_dates;
create trigger vaccination_dates_protect_archive
  before update or delete on public.vaccination_dates
  for each row execute function public.protect_archived_vaccination_date();

create or replace function public.protect_archived_participant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_date_id uuid;
begin
  target_date_id := case when tg_op = 'DELETE' then old.vaccination_date_id else new.vaccination_date_id end;

  if exists (
    select 1
    from public.vaccination_dates
    where id = target_date_id
      and archived = true
  ) then
    raise exception using
      errcode = '55000',
      message = 'Participants of archived vaccination dates are read-only.';
  end if;

  if tg_op = 'UPDATE'
     and old.vaccination_date_id is distinct from new.vaccination_date_id
     and exists (
       select 1 from public.vaccination_dates
       where id = old.vaccination_date_id and archived = true
     ) then
    raise exception using
      errcode = '55000',
      message = 'Participants cannot be moved out of archived vaccination dates.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists participants_protect_archived_date on public.participants;
create trigger participants_protect_archived_date
  before insert or update or delete on public.participants
  for each row execute function public.protect_archived_participant();
