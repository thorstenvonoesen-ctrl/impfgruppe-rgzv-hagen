-- Authenticated administrator presence without exposing membership or auth IDs.
alter table public.club_admin_memberships
  add column if not exists presence_name text,
  add column if not exists presence_email text,
  add column if not exists is_online boolean not null default false,
  add column if not exists last_seen_at timestamptz;

create index if not exists club_admin_memberships_presence_active_idx
  on public.club_admin_memberships (club_id, active, last_seen_at desc);

create or replace function public.touch_admin_presence(p_online boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_name text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.club_admin_memberships membership
    where membership.user_id = caller_id
      and membership.active = true
  ) then
    raise exception 'active administrator membership required' using errcode = '42501';
  end if;

  select
    lower(auth_user.email),
    coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(concat_ws(
        ' ',
        auth_user.raw_user_meta_data ->> 'first_name',
        auth_user.raw_user_meta_data ->> 'last_name'
      )), ''),
      nullif(split_part(auth_user.email, '@', 1), ''),
      'Administrator'
    )
  into caller_email, caller_name
  from auth.users auth_user
  where auth_user.id = caller_id;

  update public.club_admin_memberships
  set
    presence_name = caller_name,
    presence_email = caller_email,
    is_online = p_online,
    last_seen_at = now()
  where user_id = caller_id
    and active = true;
end;
$$;

create or replace function public.get_admin_presence()
returns table (
  admin_name text,
  admin_email text,
  online boolean,
  last_activity timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_is_superadmin boolean;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.club_admin_memberships membership
    where membership.user_id = caller_id
      and membership.active = true
      and membership.role = 'superadmin'
  ) into caller_is_superadmin;

  if not caller_is_superadmin and not exists (
    select 1
    from public.club_admin_memberships membership
    where membership.user_id = caller_id
      and membership.active = true
  ) then
    raise exception 'active administrator membership required' using errcode = '42501';
  end if;

  return query
  with visible_memberships as (
    select membership.*
    from public.club_admin_memberships membership
    where membership.active = true
      and (
        caller_is_superadmin
        or membership.club_id in (
          select own_membership.club_id
          from public.club_admin_memberships own_membership
          where own_membership.user_id = caller_id
            and own_membership.active = true
        )
      )
  ),
  visible_admins as (
    select
      membership.user_id,
      coalesce(
        max(nullif(membership.presence_name, '')),
        max(nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), '')),
        max(nullif(trim(concat_ws(
          ' ',
          auth_user.raw_user_meta_data ->> 'first_name',
          auth_user.raw_user_meta_data ->> 'last_name'
        )), '')),
        max(nullif(split_part(auth_user.email, '@', 1), '')),
        'Administrator'
      ) as resolved_name,
      coalesce(
        max(nullif(membership.presence_email, '')),
        lower(max(auth_user.email))
      ) as resolved_email,
      bool_or(
        membership.is_online = true
        and membership.last_seen_at >= now() - interval '3 minutes'
      ) as resolved_online,
      max(membership.last_seen_at) as resolved_last_activity
    from visible_memberships membership
    join auth.users auth_user on auth_user.id = membership.user_id
    group by membership.user_id
  )
  select
    visible_admins.resolved_name,
    visible_admins.resolved_email,
    visible_admins.resolved_online,
    visible_admins.resolved_last_activity
  from visible_admins
  order by
    visible_admins.resolved_online desc,
    visible_admins.resolved_name asc;
end;
$$;

revoke all on function public.touch_admin_presence(boolean) from public, anon;
revoke all on function public.get_admin_presence() from public, anon;
grant execute on function public.touch_admin_presence(boolean) to authenticated;
grant execute on function public.get_admin_presence() to authenticated;

-- Existing RLS remains unchanged: authenticated users can still select only their
-- own membership row, while presence data is exposed solely through the limited RPC.
