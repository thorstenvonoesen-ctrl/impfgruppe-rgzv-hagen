-- Replace the 10-day / 48-hour schedule with 7-day / 24-hour reminders.
-- Only the reminder queueing function and its grants are changed.
create or replace function public.queue_due_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare added integer;
begin
  with dates as (
    select d.*,
      coalesce(nullif(to_jsonb(d)->>'time','')::time,
        substring(d.title from '(?:[01]?[0-9]|2[0-3]):[0-5][0-9]')::time) as event_time
    from public.vaccination_dates d
    where not coalesce(d.archived,false)
      and not coalesce((to_jsonb(d)->>'is_test')::boolean,false)
      and not exists(select 1 from jsonb_each_text(to_jsonb(d)) kv where kv.value ilike '%test%')
  ), events as (
    select d.*, ((d.date::date + d.event_time) at time zone 'Europe/Berlin') as event_at
    from dates d where d.event_time is not null and d.date is not null
  ), due as (
    select e.id, e.club_id, e.event_at, k.kind,
      case when k.kind='reminder-7d'
        then ((e.date::date - 7 + e.event_time) at time zone 'Europe/Berlin')
        else e.event_at - interval '24 hours' end as due_at
    from events e cross join (values ('reminder-7d'), ('reminder-24h')) k(kind)
  )
  insert into public.mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload)
    select due.kind || ':' || p.id,p.club_id,p.vaccination_date_id,p.id,due.kind,lower(trim(p.email)),
      jsonb_build_object('participant',to_jsonb(p),'appointment',to_jsonb(d))
    from due
    join public.participants p on p.vaccination_date_id=due.id and p.club_id=due.club_id
    join public.vaccination_dates d on d.id=due.id
    -- Daily Hobby Cron can be late; catch up a due reminder while the event is still future.
    where now() >= due.due_at and now() < due.event_at
      and p.registration_status in ('completed','bar_registered')
      and not exists(
        select 1 from public.mail_deliveries m
        where m.event_key=due.kind || ':' || p.id and m.status <> 'skipped'
      )
    order by due.due_at,p.id
    limit 1000
    on conflict(event_key) do update
      set status='pending', payload=excluded.payload, recipient=excluded.recipient,
          next_attempt_at=now(), attempts=0
      where mail_deliveries.status='skipped';
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.queue_due_reminders() from public, anon, authenticated;
grant execute on function public.queue_due_reminders() to service_role;
