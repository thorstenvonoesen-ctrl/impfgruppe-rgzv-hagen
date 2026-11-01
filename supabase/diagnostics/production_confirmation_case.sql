-- READ ONLY. First run production_confirmation_readiness.sql.
-- Run the two sections separately. No mail is queued, retried or sent.

-- 1. Identify the exact club and appointment; do not guess UUIDs.
select c.id as club_id,c.slug,d.id as appointment_id,d.title,d.date
from public.clubs c join public.vaccination_dates d on d.club_id=c.id
where c.slug='rgzv-hagen' and d.date=date '2027-01-10'
order by d.title,d.id;

-- 2. Fill the THREE values below locally with the IDs above and the actual
-- registration address. Do not share passwords, tokens or the full email address.
with parameters as (
  select '00000000-0000-0000-0000-000000000000'::uuid as club_id,
         '00000000-0000-0000-0000-000000000000'::uuid as appointment_id,
         'HIER-TEILNEHMER-EMAIL-EINTRAGEN'::text as participant_email
)
select p.id as participant_id,p.created_at as registered_at,p.registration_status,
       p.payment_method,nullif(p.checkin_token,'') is not null as qr_token_exists,
       m.id as delivery_id,m.kind,m.status,m.attempts,m.created_at as job_created_at,
       m.claimed_at,m.next_attempt_at,m.sent_at,m.error_code,
       m.club_id=p.club_id as job_club_matches,
       m.appointment_id=p.vaccination_date_id as job_appointment_matches,
       lower(trim(m.recipient))=lower(trim(p.email)) as job_recipient_matches,
       case
         when m.id is null then 'NO_JOB'
         when m.status='sent' then 'SMTP_ACCEPTED_CHECK_RECIPIENT_AND_PROVIDER'
         when m.status='uncertain' then 'DO_NOT_RESEND_CHECK_SMTP_PROTOCOL'
         when m.status='sending' then 'CLAIMED_NOT_PROOF_OF_SMTP_START'
         when m.status='skipped' then 'SKIPPED_CHECK_REGISTRATION_AND_RECIPIENT'
         when m.attempts>=5 then 'ATTEMPT_LIMIT_REQUIRES_EXPLICIT_FAILED_RETRY'
         when m.next_attempt_at>now() then 'WAITING_UNTIL_NEXT_ATTEMPT'
         else 'WAITING_FOR_WORKER'
       end as investigation_hint
from parameters x
join public.participants p on p.club_id=x.club_id and p.vaccination_date_id=x.appointment_id
  and lower(trim(p.email))=lower(trim(x.participant_email))
left join public.mail_deliveries m on m.event_key='registration:' || p.id
order by p.created_at desc;
