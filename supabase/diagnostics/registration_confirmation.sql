-- Read-only diagnosis. Does not queue or send any mail, and does not display addresses.
select to_regclass('public.mail_deliveries') is not null as queue_exists,
       to_regprocedure('public.register_with_confirmation(jsonb)') is not null as atomic_registration_exists,
       to_regprocedure('public.claim_mail_delivery(uuid)') is not null as claim_exists,
       to_regprocedure('public.queue_due_reminders()') is not null as reminder_function_exists,
       exists(select 1 from pg_trigger where tgrelid='public.participants'::regclass
         and tgname='participants_queue_registration_mail' and tgenabled in ('O','A')) as registration_trigger_enabled;

-- Run the following query after confirming queue_exists=true.
-- Adjust club slug only if the production club uses a different one.
select count(*) as active_registrations,
  count(*) filter(where m.id is null) as without_confirmation_job,
  count(*) filter(where m.status='pending') as pending,
  count(*) filter(where m.status='failed') as failed,
  count(*) filter(where m.status='uncertain') as uncertain,
  count(*) filter(where m.status='sent') as accepted_by_smtp
from public.participants p
join public.clubs c on c.id=p.club_id
join public.vaccination_dates d on d.id=p.vaccination_date_id and d.club_id=p.club_id
left join public.mail_deliveries m on m.event_key='registration:' || p.id and m.club_id=p.club_id
where c.slug='rgzv-hagen' and d.date=date '2027-01-10' and d.title='ND Impfung Winter'
  and p.registration_status in ('bar_registered','completed');
