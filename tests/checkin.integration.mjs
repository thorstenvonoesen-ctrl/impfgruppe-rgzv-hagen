// Full isolated PostgreSQL + real check-in API. No production records or SMTP.
import {PGlite} from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {createCheckinHandler} from '../api/checkin.js'
import {pgMailClient} from './pg-mail-client.mjs'
import {makeCheckinUrl} from '../checkin-links.js'
const pg=new PGlite(),club=randomUUID(),other=randomUUID(),staff=randomUUID(),inactive=randomUUID()
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0])[0]
const db=pgMailClient(pg,club)
db.auth.getUser=async token=>({data:{user:({'fixture-admin':club,staff,inactive}[token])?{id:{'fixture-admin':club,staff,inactive}[token]}:null}})
let receipts=0
const api=createCheckinHandler({createDb:()=>db,issueReceipt:async()=>{receipts++;return {receipt:{receipt_number:'SIMULATED',receipt_email_sent_at:null}}}})
async function request(body,login='fixture-admin') {
  const res={setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}}
  await api({method:'POST',headers:login?{authorization:`Bearer ${login}`}:{},body},res);return res
}
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table clubs(id uuid primary key,slug text);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid,title text,date date);`)
  await pg.query('insert into clubs values($1,$3),($2,$4)',[club,other,'fixture','other'])
  await pg.query("insert into club_admin_memberships values($1,$1,'clubadmin',true),($2,$1,'checkin_admin',true),($3,$1,'clubadmin',false)",[club,staff,inactive])
  const base=await readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8')
  await pg.exec(base.split('alter table participants')[0])
  await pg.exec('alter table participants add column club_id uuid,add column vaccination_date_id uuid')
  const repair=await readFile(new URL('../supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql',import.meta.url),'utf8')
  await pg.exec(repair)
  const date=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'ND Winter','2027-01-10','10:00') returning id",[club])
  const date2=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'Other date','2027-02-10','10:00') returning id",[club])
  const otherDate=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'Foreign','2027-01-10','10:00') returning id",[other])
  const add=(c,d,email,status='bar_registered',payment='offen')=>scalar("insert into participants(firstname,lastname,email,tsk_number,vaccine,animal_count,club_id,vaccination_date_id,registration_status,payment_method,payment_status) values('Fixture','Person',$1,'FIXTURE','Newcastle',1,$2,$3,$4,'bar',$5) returning to_jsonb(participants)",[email,c,d,status,payment])
  const p=await add(club,date,'one@example.invalid'),paid=await add(club,date,'paid@example.invalid','bar_registered','bezahlt'),foreign=await add(other,otherDate,'foreign@example.invalid'),cancelled=await add(club,date,'cancelled@example.invalid','cancelled')
  assert.notEqual(p.checkin_token,paid.checkin_token)
  const url=makeCheckinUrl('https://app.example.invalid',p.checkin_token)
  assert.equal((await request({action:'qr-resolve',token:url},null)).code,401)
  assert.equal((await request({action:'qr-checkin',token:url,vaccinationDateId:date,allowOpenPayment:true},null)).code,401)
  assert.equal((await request({action:'qr-resolve',token:url},'inactive')).code,404)
  assert.equal((await request({action:'qr-resolve',token:foreign.checkin_token},'staff')).code,404)
  assert.equal((await request({action:'qr-resolve',token:'invalid'})).code,400)
  assert.equal((await request({action:'qr-resolve',token:'f'.repeat(64)})).code,404)
  assert.equal((await request({action:'qr-resolve',token:cancelled.checkin_token})).code,404)
  const preview=await request({action:'qr-resolve',token:url},'staff')
  assert.equal(preview.code,200);assert.equal(preview.body.participant.id,p.id);assert.equal(preview.body.participant.vaccination_date_id,date)
  assert.equal(await scalar('select checked_in from participants where id=$1',[p.id]),false)
  assert.equal((await request({action:'qr-preview',token:url,vaccinationDateId:date})).code,200)
  assert.equal((await request({action:'qr-checkin',token:url,vaccinationDateId:date2,allowOpenPayment:true})).code,403)
  assert.equal((await request({action:'qr-checkin',token:url,vaccinationDateId:otherDate,allowOpenPayment:true},'staff')).code,403)
  assert.equal((await request({action:'qr-checkin',token:url,vaccinationDateId:date},'staff')).code,409)
  assert.equal((await request({action:'qr-checkin',token:url,vaccinationDateId:date,allowOpenPayment:true},'staff')).code,200)
  const attendance=await scalar('select to_jsonb(p) from participants p where id=$1',[p.id])
  assert.equal(attendance.checked_in,true);assert.equal(attendance.checked_in_by,staff);assert.equal(attendance.checkin_method,'qr');assert.ok(attendance.checked_in_at)
  assert.equal(attendance.payment_status,'offen');assert.equal(receipts,0)
  assert.equal((await request({action:'qr-checkin',token:p.checkin_token,vaccinationDateId:date,allowOpenPayment:true},'staff')).code,409)
  assert.deepEqual(await scalar('select to_jsonb(p) from participants p where id=$1',[p.id]),attendance)
  const both=await Promise.all([request({action:'qr-checkin',token:paid.checkin_token,vaccinationDateId:date}),request({action:'qr-checkin',token:paid.checkin_token,vaccinationDateId:date})])
  assert.deepEqual(both.map(r=>r.code).sort(),[200,409]);assert.equal(receipts,1)
  assert.equal((await request({action:'typo',token:p.checkin_token,vaccinationDateId:date})).code,400)
  await pg.query('update vaccination_dates set archived=true where id=$1',[date])
  assert.equal((await request({action:'qr-resolve',token:url})).code,409)
  const snapshot=await scalar('select jsonb_agg(p order by id) from participants p')
  await pg.exec(repair)
  assert.deepEqual(await scalar('select jsonb_agg(p order by id) from participants p'),snapshot)
  console.log('PASS: smartphone/raw QR -> authenticated API -> exact participant/date -> persistent check-in; preview read-only; wrong club/date, missing/inactive auth, invalid/cancelled/archive; repeat/concurrent idempotency; unchanged payments/tokens; repeated SQL bundle. No SMTP.')
}finally{await pg.close()}
