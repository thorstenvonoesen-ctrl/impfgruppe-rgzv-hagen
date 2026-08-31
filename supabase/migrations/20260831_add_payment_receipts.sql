-- Immutable payment receipts issued only after payment and check-in are complete.
create sequence if not exists public.payment_receipt_number_seq;

alter table public.participants
  add column if not exists receipt_number text,
  add column if not exists receipt_issued_at timestamptz,
  add column if not exists receipt_snapshot jsonb,
  add column if not exists receipt_email_sent_at timestamptz;

-- PDFs are regenerated from the immutable snapshot so participant list queries
-- never have to transfer large encoded documents.
alter table public.participants drop column if exists receipt_pdf_base64;

create unique index if not exists participants_receipt_number_key
  on public.participants (receipt_number)
  where receipt_number is not null;

revoke update (receipt_number, receipt_issued_at, receipt_snapshot, receipt_email_sent_at)
  on public.participants from authenticated;

drop function if exists public.issue_payment_receipt(uuid);
create or replace function public.issue_payment_receipt(target_participant_id uuid)
returns table (
  receipt_number text,
  receipt_issued_at timestamptz,
  receipt_snapshot jsonb,
  receipt_email_sent_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_record record;
  issued_at timestamptz := now();
  next_number bigint;
  generated_number text;
begin
  select
    participant.*,
    vaccination_date.title as appointment_title,
    vaccination_date.date as appointment_date,
    club.name as club_name
  into participant_record
  from public.participants participant
  join public.vaccination_dates vaccination_date on vaccination_date.id = participant.vaccination_date_id
  join public.clubs club on club.id = participant.club_id
  where participant.id = target_participant_id
  for update of participant;

  if not found then
    raise exception 'Participant not found.' using errcode = 'P0002';
  end if;

  if participant_record.payment_status <> 'bezahlt' or participant_record.payment_date is null then
    raise exception 'A receipt requires a completed payment.' using errcode = '55000';
  end if;

  if participant_record.checked_in is not true or participant_record.checked_in_at is null then
    raise exception 'A receipt requires a completed check-in.' using errcode = '55000';
  end if;

  if participant_record.receipt_number is null then
    next_number := nextval('public.payment_receipt_number_seq');
    generated_number := 'Q-' || to_char(timezone('Europe/Berlin', issued_at), 'YYYY') || '-' || lpad(next_number::text, 6, '0');

    update public.participants
    set
      receipt_number = generated_number,
      receipt_issued_at = issued_at,
      receipt_snapshot = jsonb_build_object(
        'participantId', participant_record.id,
        'participantName', trim(concat_ws(' ', participant_record.firstname, participant_record.lastname)),
        'participantEmail', participant_record.email,
        'amount', participant_record.payment_amount,
        'paymentMethod', coalesce(participant_record.payment_method, 'bar'),
        'paymentDate', participant_record.payment_date,
        'appointmentId', participant_record.vaccination_date_id,
        'appointmentTitle', participant_record.appointment_title,
        'appointmentDate', participant_record.appointment_date,
        'clubId', participant_record.club_id,
        'clubName', participant_record.club_name,
        'issuedAt', issued_at
      )
    where id = target_participant_id;
  end if;

  return query
  select
    participant.receipt_number,
    participant.receipt_issued_at,
    participant.receipt_snapshot,
    participant.receipt_email_sent_at
  from public.participants participant
  where participant.id = target_participant_id;
end;
$$;

revoke all on function public.issue_payment_receipt(uuid) from public, anon, authenticated;
grant execute on function public.issue_payment_receipt(uuid) to service_role;
