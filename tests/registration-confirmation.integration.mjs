// Registration API -> real PostgreSQL transaction/outbox -> fake SMTP -> admin retry.
// Never loads .env or uses network connections.
import { PGlite } from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createRegistrationHandler } from '../api/create-registration.js'
import { createMailHandler } from '../api/send-reminder-emails.js'
import { drainMail } from '../server/mail-delivery.js'
import { runReminderCron } from '../server/mail-workflows.js'
import { reconcileRegistrationConfirmations } from '../server/registration-confirmation.js'
import { makeMembershipProof } from '../server/membership-tariff.js'
import { managementToken } from '../server/mail-rules.js'
import { pgMailClient } from './pg-mail-client.mjs'
const pg=new PGlite()
const migration=name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const club='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0])[0]
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-secret-only'
process.env.APP_URL='https://example.invalid'
let sent=[]
const transport={async sendMail(mail){sent.push(mail);return {messageId:'fake-accepted'}}}
const db=pgMailClient(pg,club)
const handler=createRegistrationHandler({createDb:()=>db,transport})
const admin=createMailHandler({createDb:()=>db,transport})
async function request(handler,body,authenticated=false) {
  const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}
  await handler({method:'POST',headers:authenticated?{authorization:'Bearer fixture-admin'}:{},body},res)
  return res
}
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table clubs(id uuid primary key,slug text,member_code text,member_price numeric default 5,guest_price numeric default 10);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    insert into clubs(id,slug,member_code) values('${club}','fixture-club','KEEP-CODE'),('${other}','other','OTHER');
    insert into club_admin_memberships values('${club}','${club}','clubadmin',true);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid,title text,date date,archived boolean default false);`)
  const base=await readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8')
  await pg.exec(base.split('alter table participants')[0])
  await pg.exec(`alter table participants add column club_id uuid,add column vaccination_date_id uuid,
    add column registration_status text,add column animal_type text,add column chicken_count integer,add column bantam_count integer,add column turkey_count integer,
    add column checkin_token text default gen_random_uuid()::text,add column checked_in boolean default false,add column is_member boolean;`)
  await pg.exec(await migration('20261101_repair_vaccination_date_save_fields'))
  await pg.exec(await migration('20261103_complete_mail_queue_repair'))
  const date=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'ND Impfung Winter','2027-01-10','10:00') returning id",[club])
  const old=await scalar("insert into participants(firstname,lastname,email,tsk_number,animal_count,vaccine,club_id,vaccination_date_id,payment_method,registration_status) values('Old','Fixture','old@example.invalid','FIXTURE',1,'Newcastle',$1,$2,'bar','bar_registered') returning id",[club,date])
  const oldSnapshot=await scalar('select to_jsonb(p) from participants p where id=$1',[old])
  // Exact reported failure path: queue exists but no registration trigger.
  assert.equal((await drainMail({db,participantId:old,transport})).sent,0)
  assert.equal(await scalar('select count(*)::int from mail_deliveries'),0)
  const body={vaccination_date_id:date,firstname:'New',lastname:'Fixture',email:'new@example.invalid',tsk_number:'FIXTURE',chicken_count:2,bantam_count:0,turkey_count:0,member_code:'KEEP-CODE'}
  assert.equal((await request(handler,body)).code,503)
  assert.equal(await scalar('select count(*)::int from participants'),1)
  const repair=await readFile(new URL('../supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql',import.meta.url),'utf8')
  await pg.exec(repair);await pg.exec(repair)
  await pg.exec(await migration('20261107_safe_participant_delete'))
  const deleteDefinition=await scalar("select pg_get_functiondef('delete_participant_registration(uuid,uuid)'::regprocedure)")
  await pg.exec(repair)
  assert.equal(await scalar("select pg_get_functiondef('delete_participant_registration(uuid,uuid)'::regprocedure)"),deleteDefinition)
  assert.equal(await scalar('select count(*)::int from mail_deliveries'),0) // no historical backfill
  // Actual 5/10 euro flow with a legacy mixed-case member address and fresh OTP.
  await pg.exec(`alter table club_members disable trigger club_members_normalize;
    insert into club_members(club_id,firstname,lastname,email,is_active) values('${club}','Fixture','Member','Verified-Member@Example.Invalid',true);
    alter table club_members enable trigger club_members_normalize;`)
  const memberEmail='verified-member@example.invalid'
  const challenge=await request(handler,{action:'membership-challenge',email:memberEmail,vaccinationDateId:date})
  assert.equal(challenge.code,200)
  const otp=sent.at(-1).text.match(/\b\d{8}\b/)[0]
  const verified=await request(handler,{action:'membership-verify',email:memberEmail,vaccinationDateId:date,challengeId:challenge.body.challengeId,code:otp})
  assert.equal(verified.code,200)
  const quote=await request(handler,{action:'registration-price',email:memberEmail,vaccinationDateId:date,proof:verified.body.token})
  assert.equal(quote.body.amount,5)
  const memberSignup=await request(handler,{...body,email:memberEmail,member_code:'',membership_proof:verified.body.token})
  assert.equal(memberSignup.code,201);assert.equal(memberSignup.body.paymentAmount,5)
  assert.match(sent.at(-1).html,/5,00/)
  assert.equal(Number(await scalar('select payment_amount from participants where id=$1',[memberSignup.body.participantId])),5)
  const memberReload=await request(handler,{action:'manage-registration',operation:'view',token:managementToken(memberSignup.body.participantId)})
  assert.equal(Number(memberReload.body.participant.payment_amount),5);assert.equal(memberReload.body.participant.is_member,true)
  sent.length=0 // assertions below count subsequent simulated sends only
  let result=await request(handler,body)
  assert.equal(result.code,201);assert.equal(result.body.emailSent,true);assert.equal(result.body.paymentAmount,5)
  assert.equal(sent.length,1);assert.equal(sent[0].to,'new@example.invalid')
  assert.match(sent[0].html,/10\.01\.2027/);assert.match(sent[0].html,/#manage=/)
  assert.equal(sent[0].attachments[0].content.subarray(1,4).toString(),'PNG')
  assert.equal((await request(handler,body)).code,409);assert.equal(sent.length,1)
  // Lost trigger after partial deployment: the RPC still guarantees the outbox.
  await pg.exec('alter table participants disable trigger participants_queue_registration_mail')
  result=await request(handler,{...body,email:'fallback@example.invalid',member_code:''})
  assert.equal(result.code,201);assert.equal(result.body.emailSent,true);assert.equal(result.body.paymentAmount,10)
  await pg.exec('alter table participants enable trigger participants_queue_registration_mail')
  const failing=createRegistrationHandler({createDb:()=>db,transport:{async sendMail(){throw Object.assign(new Error('private SMTP response'),{code:'EAUTH'})}}})
  result=await request(failing,{...body,email:'failed@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.emailStatus,'failed');assert.equal(result.body.emailSent,false)
  const failed=await scalar("select id from mail_deliveries where recipient='failed@example.invalid'")
  await pg.query('update mail_deliveries set attempts=5 where id=$1',[failed])
  result=await request(admin,{action:'mail-status',clubId:club},true)
  assert.match(result.body.deliveries.find(j=>j.id===failed).error,/SMTP_USER/)
  assert.equal((await request(admin,{action:'retry-delivery',clubId:other,deliveryId:failed},true)).code,403)
  assert.equal((await request(admin,{action:'retry-delivery',clubId:club,deliveryId:failed})).code,403)
  const beforeRetry=sent.length
  assert.equal((await request(admin,{action:'retry-delivery',clubId:club,deliveryId:failed},true)).body.sent,1)
  assert.equal(sent.length,beforeRetry+1)
  assert.equal(await scalar('select previous_attempts from mail_delivery_retries where delivery_id=$1',[failed]),5)
  assert.equal((await request(admin,{action:'retry-delivery',clubId:club,deliveryId:failed},true)).code,409)
  // Existing registration can be recovered explicitly once, without editing it.
  assert.equal((await request(admin,{action:'recover-confirmation',clubId:club,participantId:old},true)).body.sent,1)
  const afterRecovery=sent.length
  assert.equal((await request(admin,{action:'recover-confirmation',clubId:club,participantId:old},true)).body.unchanged,true)
  assert.equal(sent.length,afterRecovery)
  const oldAfter=await scalar('select to_jsonb(p) from participants p where id=$1',[old])
  for(const [key,value] of Object.entries(oldSnapshot))assert.deepEqual(oldAfter[key],value)
  // Missing reminder function does not prevent the cron from delivering confirmations.
  await pg.query("insert into participants(firstname,lastname,email,tsk_number,animal_count,vaccine,club_id,vaccination_date_id,payment_method,registration_status) values('Cron','Fixture','cron@example.invalid','FIXTURE',1,'Newcastle',$1,$2,'bar','bar_registered')",[club,date])
  const cron=await runReminderCron(db,{transport})
  assert.equal(cron.sent,1);assert.ok(cron.reminderError)
  const unclear=createRegistrationHandler({createDb:()=>db,transport:{async sendMail(){throw Object.assign(new Error('lost after DATA'),{code:'ETIMEDOUT',command:'DATA'})}}})
  result=await request(unclear,{...body,email:'unclear@example.invalid'})
  assert.equal(result.body.emailStatus,'uncertain')
  const unclearId=await scalar("select id from mail_deliveries where recipient='unclear@example.invalid'")
  assert.equal((await request(admin,{action:'retry-delivery',clubId:club,deliveryId:unclearId},true)).code,409)
  // Regression: mail URL configuration must not prevent committing the signup.
  const urlKeys=['APP_URL','PUBLIC_APP_URL','SITE_URL','VITE_APP_URL','VERCEL_PROJECT_PRODUCTION_URL']
  const originalUrls=Object.fromEntries(urlKeys.map(key=>[key,process.env[key]]))
  const beforeMissingUrl=sent.length
  let missingUrlId
  try {
    for(const key of urlKeys)delete process.env[key]
    result=await request(handler,{...body,email:'missing-url@example.invalid'})
    assert.equal(result.code,201);assert.equal(result.body.emailSent,false);assert.equal(result.body.emailStatus,'failed')
    missingUrlId=await scalar("select id from mail_deliveries where recipient='missing-url@example.invalid'")
    assert.equal(await scalar('select error_code from mail_deliveries where id=$1',[missingUrlId]),'APP_URL_CONFIG')
    assert.equal(sent.length,beforeMissingUrl) // builder rejects before SMTP is contacted
    assert.equal((await request(handler,{...body,email:'missing-url@example.invalid'})).code,409)
    assert.equal(await scalar("select count(*)::int from participants where email='missing-url@example.invalid'"),1)
  } finally {
    for(const key of urlKeys){if(originalUrls[key]===undefined)delete process.env[key];else process.env[key]=originalUrls[key]}
  }
  assert.equal((await request(admin,{action:'retry-delivery',clubId:club,deliveryId:missingUrlId},true)).body.sent,1)
  assert.equal(sent.length,beforeMissingUrl+1)
  // A partially deployed RPC must expose a schema error and roll back both records.
  await pg.exec('alter table participants rename column tariff_source to fixture_missing_tariff_source')
  try {
    result=await request(handler,{...body,email:'missing-column@example.invalid'})
    assert.equal(result.code,503);assert.match(result.body.error,/Datenbank.*nicht vollständig eingerichtet/)
    assert.ok(result.body.reference)
    assert.equal(await scalar("select count(*)::int from participants where email='missing-column@example.invalid'"),0)
    assert.equal(await scalar("select count(*)::int from mail_deliveries where recipient='missing-column@example.invalid'"),0)
  } finally {await pg.exec('alter table participants rename column fixture_missing_tariff_source to tariff_source')}
  // Outbox constraint failure must never roll back the binding registration.
  await pg.exec("alter table mail_deliveries add constraint fixture_failure check (recipient <> 'rollback@example.invalid')")
  result=await request(handler,{...body,email:'rollback@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.emailSent,false)
  assert.equal(await scalar("select confirmation_job_state from participants where email='rollback@example.invalid'"),'pending')
  assert.equal(await scalar("select confirmation_error_code from participants where email='rollback@example.invalid'"),'23514')
  const pendingStatus=await request(admin,{action:'mail-status',clubId:club},true)
  assert.equal(pendingStatus.body.pendingConfirmations,1)
  assert.equal((await request(handler,{...body,email:'rollback@example.invalid'})).code,409)
  await pg.exec('alter table mail_deliveries drop constraint fixture_failure')
  assert.equal((await reconcileRegistrationConfirmations(db,{clubId:other})).reconciled,0)
  await reconcileRegistrationConfirmations(db,{clubId:club})
  const recovered=await drainMail({db,transport})
  assert.equal(recovered.sent,1)
  await reconcileRegistrationConfirmations(db,{clubId:club})
  assert.equal((await drainMail({db,transport})).sent,0)
  assert.equal(await scalar("select count(*)::int from participants where email='rollback@example.invalid'"),1)
  // Both JavaScript and SQL membership lookups fail without blocking signup.
  await pg.exec('alter table club_members rename column is_active to fixture_active')
  result=await request(handler,{...body,email:'membership-outage@example.invalid',member_code:'',membership_proof:makeMembershipProof(club,date,'membership-outage@example.invalid').token})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,10);assert.equal(result.body.tariffReviewRequired,true)
  assert.match(result.body.notice,/vorläufig/)
  assert.match(sent.at(-1).html,/vorläufig/)
  result=await request(handler,{...body,email:'code-during-outage@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,5);assert.equal(result.body.tariffReviewRequired,false)
  await pg.exec('alter table club_members rename column fixture_active to is_active')
  // A missing outbox column is also recoverable after repair.
  await pg.exec('alter table mail_deliveries rename column event_key to fixture_event_key')
  result=await request(handler,{...body,email:'missing-outbox@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.emailSent,false)
  await pg.exec('alter table mail_deliveries rename column fixture_event_key to event_key')
  await reconcileRegistrationConfirmations(db,{clubId:club})
  assert.equal((await drainMail({db,transport})).sent,1)
  // Concurrent retries serialize and leave exactly one participant and one job.
  const simultaneous=await Promise.all([request(handler,{...body,email:'concurrent@example.invalid'}),request(handler,{...body,email:'concurrent@example.invalid'})])
  assert.deepEqual(simultaneous.map(r=>r.code).sort(),[201,409])
  assert.equal(await scalar("select count(*)::int from participants where email='concurrent@example.invalid'"),1)
  assert.equal(await scalar("select count(*)::int from mail_deliveries where recipient='concurrent@example.invalid'"),1)
  const saved=await scalar("select to_jsonb(p) from participants p where email='concurrent@example.invalid'")
  assert.equal(Number(saved.payment_amount),5);assert.equal(saved.tariff_source,'code');assert.equal(saved.registration_status,'bar_registered')
  const reloaded=await request(handler,{action:'manage-registration',operation:'view',token:managementToken(saved.id)})
  assert.equal(reloaded.code,200);assert.equal(Number(reloaded.body.participant.payment_amount),5)
  assert.equal(reloaded.body.participant.email,'concurrent@example.invalid')
  await pg.exec('set role service_role')
  const serverRole=await request(handler,{...body,email:'server-role@example.invalid'})
  assert.equal(serverRole.code,201);assert.equal(serverRole.body.emailSent,true)
  await pg.exec('reset role')
  await pg.exec('set role authenticated')
  await assert.rejects(scalar('select register_with_confirmation($1)',[JSON.stringify(body)]),e=>e.code==='42501')
  await pg.exec('reset role')
  const protocols=await scalar('select jsonb_agg(d order by id) from mail_deliveries d')
  const snapshot=await scalar('select jsonb_agg(p order by id) from participants p')
  const datesSnapshot=await scalar('select jsonb_agg(d order by id) from vaccination_dates d')
  await pg.exec(repair)
  assert.deepEqual(await scalar('select jsonb_agg(d order by id) from mail_deliveries d'),protocols)
  assert.deepEqual(await scalar('select jsonb_agg(p order by id) from participants p'),snapshot)
  assert.deepEqual(await scalar('select jsonb_agg(d order by id) from vaccination_dates d'),datesSnapshot)
  assert.equal(await scalar('select member_code from clubs where id=$1',[club]),'KEEP-CODE')
  console.log('PASS: complete SQL bundle repeated; API/storage/reload/tariffs; outbox and membership outage recovery; SMTP retries; concurrent duplicates; scope/permissions; unchanged deletion function and historical data. No real emails.')
}finally{await pg.close()}
