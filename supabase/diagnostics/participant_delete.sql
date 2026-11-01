-- READ ONLY. Check the actual production constraints without deleting a participant.
select c.conname,c.conrelid::regclass as referencing_table,c.confrelid::regclass as referenced_table,
  case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
    when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as on_delete,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c where c.contype='f' and (
  c.confrelid=to_regclass('public.participants')
  or c.confrelid=to_regclass('public.mail_deliveries'))
order by referencing_table::text,c.conname;

select to_regprocedure('public.delete_participant_registration(uuid,uuid)') is not null as safe_delete_installed;

select t.tgname,t.tgenabled,t.tgfoid::regprocedure as function_name
from pg_trigger t where t.tgrelid=to_regclass('public.participants') and not t.tgisinternal;
