-- READ ONLY. No registration, mail job, deletion or retry is executed.
-- Run in the Supabase project used by the production API.
with required(signature) as (values
  ('public.register_with_tariff_confirmation(jsonb)'),
  ('public.register_with_confirmation(jsonb)'),
  ('public.mail_appointment_open(jsonb)'),
  ('public.claim_mail_delivery(uuid)'))
select r.signature,p.oid is not null as exists,p.proargnames as parameter_names,
       p.prorettype::regtype as return_type,p.prosecdef as security_definer,
       has_function_privilege('service_role',p.oid,'EXECUTE') as server_can_execute
from required r left join pg_proc p on p.oid=to_regprocedure(r.signature);

with required(table_name,column_name) as (values
  ('participants','id'),('participants','club_id'),('participants','vaccination_date_id'),
  ('participants','firstname'),('participants','lastname'),('participants','email'),('participants','tsk_number'),
  ('participants','animal_type'),('participants','animal_count'),('participants','chicken_count'),
  ('participants','bantam_count'),('participants','turkey_count'),('participants','vaccine'),
  ('participants','is_member'),('participants','payment_status'),('participants','payment_method'),
  ('participants','payment_amount'),('participants','registration_status'),('participants','checkin_token'),
  ('participants','tariff_source'),('participants','tariff_verified_email'),
  ('mail_deliveries','id'),('mail_deliveries','event_key'),('mail_deliveries','club_id'),
  ('mail_deliveries','participant_id'),('mail_deliveries','appointment_id'),('mail_deliveries','kind'),
  ('mail_deliveries','recipient'),('mail_deliveries','payload'),('mail_deliveries','status'),
  ('mail_deliveries','attempts'),('mail_deliveries','next_attempt_at'),('mail_deliveries','claimed_at'),
  ('mail_deliveries','sent_at'),('mail_deliveries','error_code'),
  ('clubs','id'),('clubs','member_code'),('clubs','member_price'),('clubs','guest_price'),
  ('club_members','id'),('club_members','club_id'),('club_members','email'),('club_members','is_active'))
select r.table_name,r.column_name,c.column_name is not null as exists,c.data_type,c.is_nullable
from required r left join information_schema.columns c on c.table_schema='public'
  and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;

select t.tgname,t.tgenabled,t.tgfoid::regprocedure as function_name
from pg_trigger t where t.tgrelid=to_regclass('public.participants') and not t.tgisinternal;

-- Only inspect the generator's existence; never generate a token or change rows.
select case when to_regnamespace('extensions') is not null
  then to_regprocedure('extensions.gen_random_bytes(integer)') is not null else false end as extension_generator_exists,
  to_regprocedure('public.gen_random_bytes(integer)') is not null as public_generator_exists;
