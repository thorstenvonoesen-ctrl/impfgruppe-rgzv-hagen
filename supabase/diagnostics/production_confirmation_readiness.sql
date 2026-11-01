-- READ ONLY. Run in the Supabase project actually used by the production deployment.
-- No participant reads, mail queue changes, function calls that send/queue mail, or credentials.
select now() as checked_at_utc,
       current_database() as connected_database,
       to_regclass('public.participants') is not null as participants_exists,
       to_regclass('public.mail_deliveries') is not null as queue_exists,
       to_regclass('public.mail_delivery_retries') is not null as retry_audit_exists,
       to_regprocedure('public.claim_mail_delivery(uuid)') is not null as claim_exists,
       to_regprocedure('public.queue_due_reminders()') is not null as reminders_exist;

-- Exact function-body comparison against the locally supplied 20261105 migration.
-- false means missing/different code, not proof that any particular migration ran.
with expected(signature,expected_md5) as (values
    ('public.queue_registration_mail()','67c53f16cefd4d2b3723d6eaf745360a'),
    ('public.guard_cash_registration()','fcbca504da0f5cd579e99568f199dcbb'),
    ('public.register_with_confirmation(jsonb)','b47ed71654b6f2220c644c517aa657d5'),
    ('public.retry_failed_mail_delivery(uuid,uuid)','60628b46306f9f9ea4537c8b536ebb8a'),
    ('public.ensure_registration_confirmation(uuid,uuid)','f10f543440886323c90aa1266171cb94')
)
select e.signature, p.oid is not null as exists,
       coalesce(md5(btrim(replace(p.prosrc,E'\r\n',E'\n'),E' \t\n\r'))=e.expected_md5,false) as matches_supplied_migration,
       p.prosecdef as security_definer,
       has_function_privilege('service_role',p.oid,'EXECUTE') as server_can_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as browser_user_can_execute
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature);

select t.tgname,t.tgenabled,t.tgfoid::regprocedure as function_name
from pg_trigger t where t.tgrelid=to_regclass('public.participants') and not t.tgisinternal
  and t.tgname in ('participants_queue_registration_mail','participants_guard_cash_registration','participants_assign_checkin_token');

select c.relname,c.relrowsecurity as rls_enabled,
       has_table_privilege('service_role',c.oid,'SELECT') as server_can_select,
       has_table_privilege('service_role',c.oid,'INSERT') as server_can_insert,
       has_table_privilege('service_role',c.oid,'UPDATE') as server_can_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('participants','vaccination_dates','clubs','mail_deliveries','mail_delivery_retries');
