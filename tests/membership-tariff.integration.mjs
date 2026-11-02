// End-to-end server API, OTP, tariffs, PostgreSQL/RLS, confirmation and edits.
// All SMTP is injected and simulated. No credentials or production data are loaded.
import {PGlite} from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createRegistrationHandler} from '../api/create-registration.js'
import {pgMailClient} from './pg-mail-client.mjs'
import {managementToken} from '../server/mail-rules.js'
import {makeMembershipProof} from '../server/membership-tariff.js'
const pg=new PGlite(),club='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const migration=name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0])[0]
const db=pgMailClient(pg,club),mails=[]
const transport={async sendMail(mail){mails.push(mail);return {messageId:'fake-only'}}}
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only-secret';process.env.APP_URL='https://example.invalid'
const handler=createRegistrationHandler({createDb:()=>db,transport})
async function request(body){const res={setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}};await handler({method:'POST',headers:{},body},res);return res}
let date
async function verify(email){
  const challenge=await request({action:'membership-challenge',email,vaccinationDateId:date});assert.equal(challenge.code,200)
  const code=mails.at(-1).text.match(/\b\d{8}\b/)[0]
  const result=await request({action:'membership-verify',email,vaccinationDateId:date,challengeId:challenge.body.challengeId,code})
  assert.equal(result.code,200)
  assert.equal((await request({action:'membership-verify',email,vaccinationDateId:date,challengeId:challenge.body.challengeId,code})).code,400)
  return result.body.token
}
try{
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table clubs(id uuid primary key,slug text,member_code text,member_price numeric,guest_price numeric);
    insert into clubs values('${club}','fixture','KEEP-CODE',6.75,12.25),('${other}','other','OTHER',4,11);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid,title text,date date,archived boolean default false);
    create table club_members(id uuid primary key default gen_random_uuid(),club_id uuid,email text,is_active boolean);
    insert into club_members(club_id,email,is_active) values('${club}','member@example.invalid',true),('${club}','inactive@example.invalid',false),('${other}','foreign@example.invalid',true),('${club}','second@example.invalid',true),('${club}',' Mixed@Example.Invalid ',true);`)
  const base=await readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');await pg.exec(base.split('alter table participants')[0])
  await pg.exec(`alter table participants add column club_id uuid,add column vaccination_date_id uuid,add column registration_status text,add column animal_type text,
    add column chicken_count integer,add column bantam_count integer,add column turkey_count integer,add column checkin_token text default gen_random_uuid()::text,
    add column checked_in boolean default false,add column is_member boolean,add column mail_revision integer not null default 0;`)
  await pg.exec(await migration('20261101_repair_vaccination_date_save_fields'));await pg.exec(await migration('20261103_complete_mail_queue_repair'));await pg.exec(await migration('20261105_registration_confirmation_outbox'))
  date=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'ND Impfung Winter','2099-01-10','10:00') returning id",[club])
  const legacy=await scalar("insert into participants(firstname,lastname,email,tsk_number,animal_count,animal_type,chicken_count,bantam_count,turkey_count,vaccine,club_id,vaccination_date_id,payment_method,registration_status,payment_amount) values('Legacy','Person','legacy@example.invalid','FIXTURE',1,'Hühner',1,0,0,'Newcastle',$1,$2,'bar','bar_registered',4.20) returning id",[club,date])
  const membersBefore=await scalar('select jsonb_agg(m order by id) from club_members m')
  const newMigration=await migration('20261106_verified_member_tariffs');await pg.exec(newMigration);await pg.exec(newMigration)
  await pg.exec('alter table participants add column checked_in_at timestamptz,add column checked_in_by text')
  await pg.exec(await migration('20261108_resilient_registration'))
  await pg.exec(await migration('20261109_membership_rate_limit_repair'))
  await pg.exec(await migration('20261110_remove_membership_request_limits'))
  // Reproduce exact-match failure on a legacy row without rewriting member data.
  assert.equal(await scalar("select exists(select 1 from club_members where club_id=$1 and email='mixed@example.invalid' and is_active)",[club]),false)
  const baseline={firstname:'Mixed',lastname:'Fixture',email:'mixed@example.invalid',tsk_number:'FIXTURE',animal_count:1,chicken_count:1,bantam_count:0,turkey_count:0,vaccine:'Newcastle',club_id:club,vaccination_date_id:date,payment_method:'bar',payment_status:'offen',registration_status:'bar_registered',verified_email:'mixed@example.invalid'}
  const wrong=await scalar('select register_with_tariff_confirmation($1)',[JSON.stringify(baseline)])
  assert.equal(Number(wrong.payment_amount),12.25)
  const normalization=await migration('20261111_normalized_member_tariff')
  await pg.exec(normalization);await pg.exec(normalization)
  assert.equal(Number(await scalar('select payment_amount from participants where id=$1',[legacy])),4.2)
  assert.deepEqual(await scalar('select jsonb_agg(m order by id) from club_members m'),membersBefore)
  const signup={vaccination_date_id:date,firstname:'Fixture',lastname:'Person',tsk_number:'FIXTURE',chicken_count:2,bantam_count:0,turkey_count:0}
  const quote=async(email,proof,memberCode)=>request({action:'registration-price',email,vaccinationDateId:date,proof,memberCode})
  const mixedProof=await verify('mixed@example.invalid')
  assert.equal((await quote(' MIXED@EXAMPLE.INVALID ',mixedProof)).body.amount,6.75)
  const correctTariff=proof=>request({action:'manage-registration',operation:'confirm-member-tariff',token:managementToken(wrong.id),membership_proof:proof,changes:{firstname:'MUST NOT CHANGE',payment_amount:0}})
  assert.equal((await correctTariff(undefined)).code,403)
  const beforeCorrection=await scalar('select to_jsonb(p) from participants p where id=$1',[wrong.id])
  const mailCount=mails.length
  const corrected=await correctTariff(mixedProof)
  assert.equal(corrected.code,200);assert.equal(Number(corrected.body.participant.payment_amount),6.75)
  assert.equal(mails.length,mailCount)
  const afterCorrection=await scalar('select to_jsonb(p) from participants p where id=$1',[wrong.id])
  for(const [key,value] of Object.entries(beforeCorrection))if(!['payment_amount','is_member','tariff_source','tariff_verified_email','tariff_review_required'].includes(key))assert.deepEqual(afterCorrection[key],value)
  assert.equal((await correctTariff(mixedProof)).code,200)
  assert.equal(await scalar('select count(*)::int from member_tariff_corrections'),1)
  const automatic=await migration('20261113_automatic_member_tariff');await pg.exec(automatic);await pg.exec(automatic)
  let result=await quote('member@example.invalid');assert.equal(result.body.amount,6.75) // active directory entry needs no OTP
  const token=await verify('member@example.invalid')
  result=await quote(' MEMBER@EXAMPLE.INVALID ',token);assert.equal(result.body.amount,6.75);assert.equal(result.body.source,'verified_member')
  result=await request({...signup,email:'member@example.invalid',payment_amount:0,is_member:false})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,6.75);const memberId=result.body.participantId
  assert.match(mails.at(-1).html,/6,75/)
  assert.equal((await request({...signup,email:'member@example.invalid',membership_proof:token})).code,409)
  // A different address, purpose/scope or old token cannot transfer the discount.
  assert.equal((await quote('victim@example.invalid',token)).body.amount,12.25)
  const mismatched=await request({...signup,email:'victim@example.invalid',membership_proof:token})
  assert.equal(mismatched.code,201);assert.equal(mismatched.body.paymentAmount,12.25)
  assert.equal(mismatched.body.tariffReviewRequired,false)
  const expired=makeMembershipProof(club,date,'expired@example.invalid',Date.now()-21*60000).token
  const expiredSignup=await request({...signup,email:'expired@example.invalid',membership_proof:expired})
  assert.equal(expiredSignup.code,201);assert.equal(expiredSignup.body.paymentAmount,12.25)
  assert.equal(expiredSignup.body.tariffReviewRequired,false)
  const inactiveToken=await verify('inactive@example.invalid')
  assert.equal((await quote('inactive@example.invalid',inactiveToken)).body.amount,12.25)
  assert.equal((await request({...signup,email:'inactive@example.invalid',membership_proof:inactiveToken})).body.paymentAmount,12.25)
  const foreignToken=await verify('foreign@example.invalid')
  assert.equal((await request({...signup,email:'foreign@example.invalid',membership_proof:foreignToken})).body.paymentAmount,12.25)
  result=await request({...signup,email:'code@example.invalid',member_code:' keep-code '});assert.equal(result.body.paymentAmount,6.75)
  const codeId=result.body.participantId
  result=await request({...signup,email:'guest@example.invalid',member_code:'wrong',verified_email:'member@example.invalid',is_member:true,payment_amount:0});assert.equal(result.body.paymentAmount,12.25)
  const guestId=result.body.participantId
  await pg.query("update participants set payment_status='bezahlt' where id=$1",[guestId])
  // Verification sends the same generic flow even for nonmembers; bounded guesses.
  const challenge=await request({action:'membership-challenge',email:'guess@example.invalid',vaccinationDateId:date})
  assert.equal(challenge.code,200)
  const correct=mails.at(-1).text.match(/\b\d{8}\b/)[0]
  assert.equal((await request({action:'membership-challenge',email:'guess@example.invalid',vaccinationDateId:date})).code,200)
  for(let i=0;i<5;i++)assert.equal((await request({action:'membership-verify',email:'guess@example.invalid',vaccinationDateId:date,challengeId:challenge.body.challengeId,code:'00000000'})).code,400)
  assert.equal((await request({action:'membership-verify',email:'guess@example.invalid',vaccinationDateId:date,challengeId:challenge.body.challengeId,code:correct})).code,400)
  assert.equal(await scalar('select count(*)::int from membership_email_challenges where code_hash=$1',[correct]),0)
  // Unrelated edits and changes in club prices never reprice existing registrations.
  await pg.query('update clubs set member_price=8.50,guest_price=15 where id=$1',[club])
  const getParticipant=async id=>scalar('select to_jsonb(p) from participants p where id=$1',[id])
  const edit=async(id,changes,proof)=>request({action:'manage-registration',token:managementToken(id),operation:'update',revision:(await getParticipant(id)).mail_revision,changes:{...await getParticipant(id),...changes},membership_proof:proof})
  result=await edit(memberId,{firstname:'Edited',payment_amount:0});assert.equal(result.code,200);assert.equal(Number(result.body.participant.payment_amount),6.75)
  assert.equal((await edit(memberId,{email:'second@example.invalid'})).code,400)
  const secondToken=await verify('second@example.invalid')
  result=await edit(memberId,{email:'second@example.invalid'},secondToken);assert.equal(result.code,200);assert.equal(Number(result.body.participant.payment_amount),6.75)
  assert.equal((await edit(memberId,{email:'inactive@example.invalid'},inactiveToken)).code,400)
  assert.equal((await edit(codeId,{email:'code-new@example.invalid'})).code,200)
  assert.equal(Number((await edit(guestId,{firstname:'Unchanged price'})).body.participant.payment_amount),12.25)
  assert.equal((await getParticipant(guestId)).payment_status,'bezahlt')
  assert.equal(Number((await edit(legacy,{firstname:'Legacy edit'})).body.participant.payment_amount),4.2)
  await pg.query("update club_members set is_active=false where club_id=$1 and email='second@example.invalid'",[club])
  assert.equal(Number((await edit(memberId,{firstname:'Former member'})).body.participant.payment_amount),6.75)
  // Configured zero is a valid price, not a signal to substitute a hard-coded default.
  await pg.query('update clubs set member_price=0 where id=$1',[club])
  result=await request({...signup,email:'free-code@example.invalid',member_code:'KEEP-CODE'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,0)
  // Hourly OTP caps remain independent from the binding signup endpoint.
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,created_at)
    select gen_random_uuid(),$1,$2,repeat('a',64),repeat('b',64),now()-interval '2 minutes'*n from generate_series(1,3) n`,[club,date])
  assert.equal(await scalar('select reserve_membership_challenge(gen_random_uuid(),$1,$2,$3,$4)',[club,date,'a'.repeat(64),'b'.repeat(64)]),true)
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash)
    select gen_random_uuid(),$1,$2,repeat('c',64),repeat('d',64) from generate_series(1,200)`,[club,date])
  // The previous shared 200/hour counter no longer blocks another member.
  assert.equal((await request({action:'membership-challenge',email:'rate-capped@example.invalid',vaccinationDateId:date})).code,200)
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash)
    select gen_random_uuid(),$1,$2,repeat('c',64),repeat('d',64) from generate_series(1,800)`,[club,date])
  assert.equal((await request({action:'membership-challenge',email:'rate-capped@example.invalid',vaccinationDateId:date})).code,200)
  result=await request({...signup,email:'rate-capped@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,15)
  result=await request({...signup,email:'code-rate-capped@example.invalid',member_code:'KEEP-CODE'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,0)
  // Server-only verification and registration RPCs, and private challenge data.
  await pg.query('update clubs set member_price=5,guest_price=10 where id=$1',[club])
  result=await request({...signup,email:'member@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,5)
  assert.equal(Number((await scalar('select payment_amount from participants where id=$1',[result.body.participantId]))),5)
  assert.match(mails.at(-1).html,/5,00/)
  result=await request({...signup,email:'automatic-guest@example.invalid'})
  assert.equal(result.code,201);assert.equal(result.body.paymentAmount,10)
  assert.equal(Number((await scalar('select payment_amount from participants where id=$1',[result.body.participantId]))),10)
  assert.match(mails.at(-1).html,/10,00/)
  await pg.exec('set role authenticated')
  await assert.rejects(pg.query('select * from membership_email_challenges'),e=>e.code==='42501')
  await assert.rejects(scalar('select register_with_tariff_confirmation($1)',[JSON.stringify(signup)]),e=>e.code==='42501')
  await pg.exec('reset role')
  const snapshot=await scalar('select jsonb_agg(p order by id) from participants p')
  await pg.exec(newMigration);await pg.exec(normalization);await pg.exec(automatic)
  assert.deepEqual(await scalar('select jsonb_agg(p order by id) from participants p'),snapshot)
  assert.equal(await scalar('select member_code from clubs where id=$1',[club]),'KEEP-CODE')
  console.log('PASS: email ownership OTP, proof scope/expiry/replay, rate/guess limits; active/inactive/foreign/guest/code tariffs; configured amounts in database and email; forged input rejected; legacy/edit/paid snapshots; reverified address change; private RPCs; repeat migration. No real SMTP.')
}finally{await pg.close()}
