// Real isolated PostgreSQL, simulated SMTP only. No .env, member or signup writes.
import {PGlite} from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {handleMembershipRequest,validMembershipProof} from '../server/membership-tariff.js'
import {pgMailClient} from './pg-mail-client.mjs'
const pg=new PGlite(),club=randomUUID(),other=randomUUID(),date=randomUUID(),otherDate=randomUUID()
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0])[0]
const db=pgMailClient(pg,club),mails=[]
process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture-only'
const transport={async sendMail(mail){mails.push(mail);return {messageId:'simulated'}}}
async function request(email,options={}) {
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this}}
  await handleMembershipRequest({headers:{'x-forwarded-for':'192.0.2.1'},body:{action:'membership-challenge',email,vaccinationDateId:date,...options.body}},res,db,{transport:options.transport||transport})
  return res
}
const verify=async(email,id,code)=>request(email,{body:{action:'membership-verify',challengeId:id,code}})
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role;
    create table clubs(id uuid primary key,member_price numeric,member_code text);
    create table vaccination_dates(id uuid primary key,club_id uuid);
    create table participants(id uuid primary key);
    create table club_members(id uuid primary key,notes text);`)
  await pg.query('insert into clubs values($1,5,$3),($2,6,$3)',[club,other,'UNCHANGED'])
  await pg.query('insert into vaccination_dates values($1,$2),($3,$4)',[date,club,otherDate,other])
  const initial=await readFile(new URL('../supabase/migrations/20261106_verified_member_tariffs.sql',import.meta.url),'utf8')
  await pg.exec(initial.slice(0,initial.indexOf('create or replace function public.register_with_tariff_confirmation'))+'commit;')
  const legacy=randomUUID()
  await pg.query("insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash) values($1,$2,$3,repeat('e',64),repeat('f',64))",[legacy,club,date])
  const before=await scalar('select to_jsonb(c) from membership_email_challenges c where id=$1',[legacy])
  const migration=await readFile(new URL('../supabase/migrations/20261109_membership_rate_limit_repair.sql',import.meta.url),'utf8')
  await pg.exec(migration);await pg.exec(migration)
  assert.deepEqual(await scalar('select to_jsonb(c) from membership_email_challenges c where id=$1',[legacy]),{...before,send_state:null})
  // Definite SMTP failure is released immediately, and its code cannot verify.
  let failedCode
  const rejected={async sendMail(mail){failedCode=mail.text.match(/\b\d{8}\b/)[0];throw Object.assign(new Error('fixture private SMTP response'),{code:'EAUTH'})}}
  let result=await request('retry@example.invalid',{transport:rejected})
  assert.equal(result.code,503);assert.doesNotMatch(result.body.error,/private|EAUTH/)
  const failed=await scalar("select id from membership_email_challenges where send_state='failed'")
  assert.equal((await verify('retry@example.invalid',failed,failedCode)).code,400)
  result=await request('retry@example.invalid');assert.equal(result.code,200)
  const code=mails.at(-1).text.match(/\b\d{8}\b/)[0],challenge=result.body.challengeId
  result=await request(' RETRY@EXAMPLE.INVALID ')
  assert.equal(result.code,429);assert.ok(result.body.retryAfter>0&&result.body.retryAfter<=60)
  assert.equal(result.headers['Retry-After'],String(result.body.retryAfter))
  // Cooldown does not block verification of the already delivered code.
  result=await verify('retry@example.invalid',challenge,code)
  assert.equal(result.code,200);assert.ok(validMembershipProof(result.body.token,club,date,'retry@example.invalid'))
  assert.equal((await verify('retry@example.invalid',challenge,code)).code,400)
  // Shared IP is not a key; different addresses and clubs remain independent.
  assert.equal((await request('another@example.invalid')).code,200)
  assert.equal((await request('retry@example.invalid',{body:{vaccinationDateId:otherDate}})).code,200)
  const parallel=await Promise.all([request('parallel@example.invalid'),request('parallel@example.invalid')])
  assert.deepEqual(parallel.map(r=>r.code).sort(),[200,429])
  // Technical failures have a distinct 6/10-minute safety budget, not 3 mails/hour.
  for(let n=0;n<6;n++)assert.equal((await request('broken@example.invalid',{transport:rejected})).code,503)
  result=await request('broken@example.invalid')
  assert.equal(result.code,429);assert.ok(result.body.retryAfter>590&&result.body.retryAfter<=600)
  // Ambiguous SMTP acceptance must not free a reservation and risk repeated mail.
  const unclear={async sendMail(){throw Object.assign(new Error('fixture'),{code:'ETIMEDOUT',command:'DATA'})}}
  assert.equal((await request('uncertain@example.invalid',{transport:unclear})).code,503)
  assert.equal((await request('uncertain@example.invalid')).code,429)
  assert.equal(await scalar("select count(*)::int from membership_email_challenges where send_state='uncertain'"),1)
  // Three confirmed mails still enforce the existing hourly per-address limit.
  const hourly='a'.repeat(64)
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,created_at,send_state)
    select gen_random_uuid(),$1,$2,$3,repeat('b',64),now()-interval '2 minutes'*n,'sent' from generate_series(1,3) n`,[club,date,hourly])
  const reserve=(digest,c=club,d=date)=>db.rpc('reserve_membership_challenge_v2',{challenge_id:randomUUID(),target_club:c,target_appointment:d,email_digest:digest,otp_digest:'b'.repeat(64)})
  let quota=await reserve(hourly)
  assert.equal(quota.data.allowed,false);assert.ok(quota.data.retryAfter>3200&&quota.data.retryAfter<=3240)
  // Former 200/hour club limit no longer rejects ordinary new members.
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,send_state)
    select gen_random_uuid(),$1,$2,repeat('c',64),repeat('d',64),'sent' from generate_series(1,200)`,[club,date])
  assert.equal((await request('above-200@example.invalid')).code,200)
  await pg.query(`insert into membership_email_challenges(id,club_id,appointment_id,email_hash,code_hash,send_state)
    select gen_random_uuid(),$1,$2,repeat('c',64),repeat('d',64),'sent' from generate_series(1,1000)`,[club,date])
  quota=await reserve('d'.repeat(64))
  assert.equal(quota.data.reason,'CLUB_SAFETY_LIMIT');assert.ok(quota.data.retryAfter>0)
  assert.equal((await reserve('d'.repeat(64),other,otherDate)).data.allowed,true)
  await pg.exec('set role authenticated')
  assert.equal((await reserve('f'.repeat(64))).error.code,'42501')
  await pg.exec('reset role')
  assert.equal(await scalar('select count(*)::int from participants'),0)
  assert.equal(await scalar('select count(*)::int from club_members'),0)
  assert.equal(await scalar('select member_price from clubs where id=$1',[club]),'5')
  console.log('PASS: failed SMTP release; separate technical budget; ambiguous result retained; countdown/header; same-IP/address/club isolation; concurrent requests; hourly/emergency caps; OTP replay; migration repeat; private RPC. No real SMTP.')
} finally {await pg.close()}
