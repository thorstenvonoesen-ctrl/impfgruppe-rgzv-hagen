// Isolated PostgreSQL only; no production credentials or network access.
// npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite
// node tests/vaccination-date-database.integration.mjs
import { PGlite } from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { vaccinationDatePayload } from '../vaccination-date-save.js'
const db = new PGlite()
const migration = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
const club = '00000000-0000-0000-0000-000000000001'
const otherClub = '00000000-0000-0000-0000-000000000002'
const admin = '00000000-0000-0000-0000-000000000003'
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table clubs(id uuid primary key);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid references clubs(id),title text not null,date date not null,note text,archived boolean not null default false);
    create table participants(id integer primary key, payload text);
    insert into participants values(1,'unchanged');
    insert into clubs values('${club}'),('${otherClub}');
    insert into club_admin_memberships values('${admin}','${club}','clubadmin',true);
    insert into vaccination_dates(club_id,title,date) values('${club}','Existing','2026-01-01');`)
  const original = await db.query('select * from vaccination_dates')
  const foundation = await migration('20260724_secure_qr_checkin_foundation')
  await db.exec(foundation.slice(foundation.indexOf('create or replace function public.can_manage_club'), foundation.indexOf('alter table public.club_admin_memberships enable')))
  const start = foundation.indexOf('drop policy if exists "authenticated club members read vaccination dates"')
  const end = foundation.indexOf('-- Public read access', start)
  await db.exec('alter table vaccination_dates enable row level security; grant select,insert,update,delete on vaccination_dates to authenticated; grant select on club_admin_memberships to authenticated;')
  await db.exec(foundation.slice(start, end))
  const archive = await migration('20260830_add_vaccination_date_archive')
  await db.exec(archive.slice(archive.indexOf('create or replace function public.protect_archived_vaccination_date'), archive.indexOf('create or replace function public.protect_archived_participant')))
  await db.exec(`set role authenticated; set test.uid='${admin}';`)
  // Reproduce the old installation failure before repair.
  await assert.rejects(db.query('insert into vaccination_dates(club_id,title,date,time,registration_closed) values($1,$2,$3,$4,$5)', [club,'ND Impfung Winter','2027-01-10','10:00',true]), e => e.code === '42703')
  await db.exec('reset role')
  const repair = await migration('20261101_repair_vaccination_date_save_fields')
  await db.exec(repair)
  await db.exec(repair)
  const existing = (await db.query('select * from vaccination_dates')).rows[0]
  for (const [key,value] of Object.entries(original.rows[0])) assert.deepEqual(existing[key],value)
  await db.exec(`set role authenticated; set test.uid='${admin}';`)
  for (const registration_closed of [true,false]) {
    const payload = vaccinationDatePayload({ title:'ND Impfung Winter',date:'2027-01-10',time:'10:00',registration_closes_at:'2027-01-09T23:00:00+01:00', registration_closed,venue_name:'Impfstandort RGZV Hagen',street:'Sonntagstrasse',house_number:'3',postal_code:'58099',city:'Hagen',address_public:true })
    const fields = ['club_id',...Object.keys(payload)]
    const created = (await db.query(`insert into vaccination_dates(${fields.join(',')}) values(${fields.map((_,i)=>`$${i+1}`).join(',')}) returning *`, [club,...Object.values(payload)])).rows[0]
    assert.equal(created.registration_closed,registration_closed)
    assert.equal(created.time,'10:00:00')
    assert.equal(new Date(created.registration_closes_at).toISOString(),'2027-01-09T22:00:00.000Z')
    await db.query('update vaccination_dates set title=$1,registration_closed=$2 where id=$3', ['Bearbeitet',!registration_closed,created.id])
    const displayed = (await db.query('select * from vaccination_dates where club_id=$1 order by date', [club])).rows.find(row=>row.id===created.id)
    assert.equal(displayed.title,'Bearbeitet')
    assert.equal(displayed.registration_closed,!registration_closed)
    await db.query('update vaccination_dates set archived=true where id=$1',[created.id])
    await assert.rejects(db.query('update vaccination_dates set title=$1 where id=$2',['Forbidden',created.id]),e=>e.code==='55000')
  }
  await assert.rejects(db.query('insert into vaccination_dates(club_id,title,date) values($1,$2,$3)',[otherClub,'Forbidden','2027-01-10']),e=>e.code==='42501')
  await db.exec("set test.uid='00000000-0000-0000-0000-000000000099'")
  assert.equal((await db.query("update vaccination_dates set title='Forbidden' returning id")).rows.length,0)
  await assert.rejects(db.query('insert into vaccination_dates(club_id,title,date) values($1,$2,$3)',[club,'Forbidden','2027-01-10']),e=>e.code==='42501')
  await db.exec('set role anon')
  await assert.rejects(db.query('insert into vaccination_dates(club_id,title,date) values($1,$2,$3)',[club,'Forbidden','2027-01-10']),e=>e.code==='42501')
  await db.exec('reset role')
  assert.deepEqual((await db.query('select * from participants')).rows,[{id:1,payload:'unchanged'}])
  console.log('PASS: missing-column failure reproduced; repair idempotent; create/edit/read open and closed; club RLS, anonymous access and archive protection; existing data unchanged.')
} finally {
  await db.close()
}
