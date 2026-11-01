// Schema repair verification only, in isolated PostgreSQL. No SMTP or credentials.
import { PGlite } from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const readMigration = name => readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const repair = await readMigration('20261103_complete_mail_queue_repair')
const oldRepair = await readMigration('20261102_repair_mail_campaign_queue')
const club='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const date='33333333-3333-4333-8333-333333333333'
const person='44444444-4444-4444-8444-444444444444'
async function createDb() {
  const db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table clubs(id uuid primary key,slug text);
    create table vaccination_dates(id uuid primary key,club_id uuid,title text,date date);
    create table participants(id uuid primary key,club_id uuid,vaccination_date_id uuid,firstname text,lastname text,email text,checked_in boolean,registration_status text);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    insert into clubs values('${club}','fixture'),('${other}','other');
    insert into vaccination_dates values('${date}','${club}','ND Winter','2027-01-10');
    insert into participants values('${person}','${club}','${date}','Fixture','Person','fixture@example.invalid',true,'completed');`)
  return db
}
const scalar=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const snapshot=async db=>({
  people:await scalar(db,'select jsonb_agg(to_jsonb(p)) from participants p'),
  dates:await scalar(db,'select jsonb_agg(to_jsonb(d)) from vaccination_dates d'),
  logs:await scalar(db,'select jsonb_agg(to_jsonb(d) order by event_key) from mail_deliveries d'),
  batches:await scalar(db,'select jsonb_agg(to_jsonb(b) order by id) from mail_batches b')
})

// Existing complete installation: every row/value, including sent and uncertain,
// must survive; old column grants must no longer expose recipients.
{
  const db=await createDb()
  try {
    await db.exec(oldRepair)
    await db.query('insert into mail_batches(id,club_id,appointment_id,kind) values($1,$2,$3,$4)',['historical',club,date,'new-appointment'])
    for (const status of ['sent','uncertain','pending','failed','sending','skipped']) {
      await db.query('insert into mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload,status,attempts) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[status,club,date,person,'registration','fixture@example.invalid','{}',status,3])
    }
    await db.exec('grant select(recipient) on mail_deliveries to anon')
    const before=await snapshot(db)
    await db.exec(repair);await db.exec(repair)
    assert.deepEqual(await snapshot(db),before)
    for(const role of ['anon','authenticated']) {
      assert.equal(await scalar(db,"select has_column_privilege($1,'public.mail_deliveries','recipient','SELECT')",[role]),false)
      assert.equal(await scalar(db,"select has_function_privilege($1,'public.create_mail_batch(text,uuid,uuid,text,jsonb)','EXECUTE')",[role]),false)
    }
    await assert.rejects(db.query('insert into mail_batches(id,club_id,appointment_id,kind) values($1,$2,$3,$4)',['cross-club',other,date,'new-appointment']),/Termin und Verein/)
    await assert.rejects(db.query('insert into mail_deliveries(event_key,club_id,participant_id,kind,recipient,payload) values($1,$2,$3,$4,$5,$6)',['cross-person',other,person,'registration','fixture@example.invalid','{}']),/Teilnehmer und Vereins/)
    assert.deepEqual(await snapshot(db),before)
  } finally {await db.close()}
}
console.log('PASS: complete installation repaired twice; all six historical statuses and payloads unchanged; column grants removed; cross-club inserts blocked.')

// Populated partial installation: recover missing technical columns without
// reactivating a historic delivery with an unknown status.
{
  const db=await createDb()
  try {
    await db.exec('create table mail_batches(id text,club_id uuid,appointment_id uuid,kind text); create table mail_deliveries(id uuid,event_key text,club_id uuid,kind text,recipient text,payload jsonb);')
    await db.query('insert into mail_deliveries values($1,$2,$3,$4,$5,$6)',[person,'historic-unknown',club,'new-appointment','fixture@example.invalid','{"original":true}'])
    const before=(await db.query('select * from mail_deliveries')).rows[0]
    await db.exec(repair);await db.exec(repair)
    const after=(await db.query('select * from mail_deliveries')).rows[0]
    for(const [key,value] of Object.entries(before)) assert.deepEqual(after[key],value)
    assert.equal(after.status,'uncertain')
    assert.equal(await scalar(db,'select count(*)::int from claim_mail_delivery($1)',[person]),0)
    await db.query('insert into mail_deliveries(event_key,club_id,kind,recipient,payload) values($1,$2,$3,$4,$5)',['fresh',club,'new-appointment','fixture@example.invalid','{}'])
    assert.equal(await scalar(db,"select status from mail_deliveries where event_key='fresh'"),'pending')
  } finally {await db.close()}
}
console.log('PASS: missing technical columns repaired twice; historic unknown status quarantined, not resent; new jobs default to pending.')

// Never guess missing identities, convert types or delete duplicate protocols.
for(const problem of ['missing-key','wrong-type','duplicate-key']) {
  const db=await createDb()
  try {
    if(problem==='missing-key') {
      await db.exec('create table mail_deliveries(payload jsonb); insert into mail_deliveries values(\'{"history":true}\')')
    } else {
      await db.exec(oldRepair)
      if(problem==='wrong-type') await db.exec('alter table mail_deliveries alter column attempts type text')
      else {
        await db.exec('alter table mail_deliveries drop constraint mail_deliveries_event_key_key')
        await db.query('insert into mail_deliveries(event_key,club_id,kind,recipient,payload) values($1,$2,$3,$4,$5),($1,$2,$3,$4,$5)',['duplicate',club,'new-appointment','fixture@example.invalid','{}'])
      }
    }
    const before=(await db.query('select to_jsonb(d) item from mail_deliveries d')).rows
    const columns=(await db.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='mail_deliveries' order by ordinal_position")).rows
    await assert.rejects(db.exec(repair))
    await db.exec('rollback')
    assert.deepEqual((await db.query('select to_jsonb(d) item from mail_deliveries d')).rows,before)
    assert.deepEqual((await db.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='mail_deliveries' order by ordinal_position")).rows,columns)
  } finally {await db.close()}
}
console.log('PASS: missing historic keys, conflicting types and duplicate keys abort atomically without deleting or rewriting any records.')
