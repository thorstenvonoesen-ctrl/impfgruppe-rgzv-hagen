// Isolated in-memory PostgreSQL verification; never loads application credentials.
// node tests/mail-database.integration.mjs <path-to-pglite/dist/index.js>
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite')
const db = new PGlite()
const query = (sql, args=[]) => db.query(sql,args)
const scalar = async (sql,args=[]) => Object.values((await query(sql,args)).rows[0])[0]
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table clubs(id uuid primary key default gen_random_uuid(),name text);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid references clubs(id),title text,date date,archived boolean default false);`)
  const base=await readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8')
  await db.exec(base.split('alter table participants')[0])
  await db.exec(`alter table participants add column club_id uuid references clubs(id), add column vaccination_date_id uuid references vaccination_dates(id),
    add column registration_status text, add column animal_type text, add column chicken_count integer, add column bantam_count integer, add column turkey_count integer,
    add column checkin_token text default 'test-token', add column checked_in boolean default false, add column checked_in_at timestamptz;`)
  await db.exec(await readFile(new URL('../supabase/migrations/20260831_add_payment_receipts.sql',import.meta.url),'utf8'))
  const migration=await readFile(new URL('../supabase/migrations/20260906_reliable_email_workflows.sql',import.meta.url),'utf8')
  await db.exec(migration)
  await db.exec(migration)
  const club=await scalar("insert into clubs(name) values('Fixture club') returning id")
  const date=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Fixture 10:00','2099-06-20') returning id",[club])
  const insert = (appointment,email) => scalar(`insert into participants(club_id,vaccination_date_id,firstname,lastname,email,tsk_number,animal_count,animal_type,chicken_count,bantam_count,turkey_count,vaccine,payment_method,registration_status)
    values($1,$2,'Max','Mustermann',$3,'TEST-TSK',10,'Hühner',10,0,0,'Newcastle','bar','bar_registered') returning id`,[club,appointment,email])
  const participant=await insert(date,'one@example.invalid')
  assert.equal(await scalar('select count(*)::int from mail_deliveries'),1)
  await assert.rejects(()=>insert(date,'ONE@example.invalid'),/bereits eine Anmeldung/)
  assert.equal(await scalar('select count(*)::int from mail_deliveries'),1)
  await query('update vaccination_dates set registration_closed=true where id=$1',[date])
  await assert.rejects(()=>insert(date,'two@example.invalid'),/geschlossen/)
  await assert.rejects(()=>query("select manage_registration($1,0,'cancel','{}')",[participant]),/nicht mehr/)
  await query('update vaccination_dates set registration_closed=false where id=$1',[date])
  const changes={firstname:'Max',lastname:'Mustermann',email:'one@example.invalid',tsk_number:'TEST-TSK',street:'Musterstraße',housenumber:'1',zipcode:'12345',city:'Musterstadt',phone:'',chicken_count:12,bantam_count:2,turkey_count:0,animal_count:14,animal_type:'Hühner, Zwerghühner'}
  await query("select manage_registration($1,0,'update',$2::jsonb)",[participant,JSON.stringify(changes)])
  assert.equal(await scalar('select animal_count from participants where id=$1',[participant]),14)
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='changed'"),1)
  await query("select manage_registration($1,1,'update',$2::jsonb)",[participant,JSON.stringify(changes)])
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='changed'"),1)
  await assert.rejects(()=>query("select manage_registration($1,0,'cancel','{}')",[participant]),/zwischenzeitlich/)
  await query('begin')
  await query("select manage_registration($1,1,'cancel','{}')",[participant])
  await query('rollback')
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='cancelled'"),0)
  await query("select manage_registration($1,1,'cancel','{}')",[participant])
  await assert.rejects(()=>query("select manage_registration($1,2,'cancel','{}')",[participant]),/nicht mehr/)
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='cancelled'"),1)
  const delivery=await scalar('select id from mail_deliveries limit 1')
  const claims=await Promise.all([query('select * from claim_mail_delivery($1)',[delivery]),query('select * from claim_mail_delivery($1)',[delivery])])
  assert.equal(claims.reduce((n,r)=>n+r.rows.length,0),1)
  const week=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'Regular appointment',((now()+interval '7 days  -1 minute') at time zone 'Europe/Berlin')::date,((now()+interval '7 days -1 minute') at time zone 'Europe/Berlin')::time) returning id",[club])
  const tomorrow=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'Regular appointment',((now()+interval '24 hours -1 minute') at time zone 'Europe/Berlin')::date,((now()+interval '24 hours -1 minute') at time zone 'Europe/Berlin')::time) returning id",[club])
  const testDate=await scalar("insert into vaccination_dates(club_id,title,date,time) select club_id,'TEST appointment',date,time from vaccination_dates where id=$1 returning id",[week])
  await insert(week,'week@example.invalid');await insert(tomorrow,'tomorrow@example.invalid');await insert(testDate,'test@example.invalid')
  const cancelled=await insert(week,'cancelled@example.invalid')
  await query("update participants set registration_status='cancelled' where id=$1",[cancelled])
  assert.equal(await scalar('select queue_due_reminders()'),2)
  assert.equal(await scalar('select queue_due_reminders()'),0)
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='reminder-7d'"),1)
  assert.equal(await scalar("select count(*)::int from mail_deliveries where kind='reminder-24h'"),1)
  const payload=await scalar('select to_jsonb(d) from vaccination_dates d where id=$1',[date])
  const deliveries=[{recipient:'past@example.invalid',payload:{participant:{email:'past@example.invalid'},appointment:payload}}]
  assert.equal(await scalar("select create_mail_batch('new-appointment:fixture',$1,$2,'new-appointment',$3)",[club,date,JSON.stringify(deliveries)]),true)
  assert.equal(await scalar("select create_mail_batch('new-appointment:fixture',$1,$2,'new-appointment',$3)",[club,date,JSON.stringify(deliveries)]),false)
  await assert.rejects(()=>scalar("select create_mail_batch('test',$1,$2,'new-appointment',$3)",[club,testDate,JSON.stringify(deliveries)]),/Kein Rundversand/)
  await db.exec('set role authenticated')
  await assert.rejects(()=>query('select * from mail_deliveries'),/permission denied/)
  await assert.rejects(()=>query('select * from claim_mail_delivery($1)',[delivery]),/permission denied/)
  await db.exec('reset role')
  console.log('PASS: migration twice, atomic registration/change/cancel, deadlines, duplicate insert, rollback, concurrent claim, independent reminders, test exclusion, campaign deduplication and restricted privileges.')
} finally { await db.close() }
