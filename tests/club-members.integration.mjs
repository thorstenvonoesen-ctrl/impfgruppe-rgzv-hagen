// Real PostgreSQL/RLS and CSV import; no production configuration is read.
import { PGlite } from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { parseMemberCsv } from '../club-members.js'
const db=new PGlite()
const club='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const admin='33333333-3333-4333-8333-333333333333'
const checkin='44444444-4444-4444-8444-444444444444'
const superadmin='55555555-5555-4555-8555-555555555555'
const inactive='66666666-6666-4666-8666-666666666666'
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
async function login(user) {await db.exec(`reset role;set role authenticated;set test.uid='${user}';`)}
try {
  await db.exec(`create role anon;create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table clubs(id uuid primary key,member_code text,member_price numeric,guest_price numeric);
    insert into clubs values('${club}','UNCHANGED-CODE',5,10),('${other}','OTHER-CODE',6,12);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    insert into club_admin_memberships values('${admin}','${club}','clubadmin',true),('${checkin}','${club}','checkin_admin',true),('${superadmin}','${other}','superadmin',true),('${inactive}','${club}','clubadmin',false);
    create table participants(id integer primary key,payload text);insert into participants values(1,'participant unchanged');
    create table vaccination_dates(id integer primary key,payload text);insert into vaccination_dates values(1,'date unchanged');`)
  const original=await scalar("select jsonb_build_object('clubs',(select jsonb_agg(c) from clubs c),'participants',(select jsonb_agg(p) from participants p),'dates',(select jsonb_agg(d) from vaccination_dates d))")
  const sql=await readFile(new URL('../supabase/migrations/20261104_add_club_members.sql',import.meta.url),'utf8')
  await db.exec(sql);await db.exec(sql)
  await login(admin)
  const member=(await db.query("insert into club_members(club_id,firstname,lastname,email,member_number,notes) values($1,' Max ',' Muster ',' MAX@EXAMPLE.INVALID ','007','Original') returning *",[club])).rows[0]
  assert.equal(member.email,'max@example.invalid');assert.equal(member.firstname,'Max')
  await assert.rejects(db.query("insert into club_members(club_id,firstname,lastname,email) values($1,'A','B','max@EXAMPLE.INVALID')",[club]),e=>e.code==='23505')
  await assert.rejects(db.query("insert into club_members(club_id,firstname,lastname,email,member_number) values($1,'A','B','different@example.invalid','007')",[club]),e=>e.code==='23505')
  await assert.rejects(db.query("insert into club_members(club_id,firstname,lastname,email) values($1,'A','B','foreign@example.invalid')",[other]),e=>e.code==='42501')
  await assert.rejects(db.query('update club_members set club_id=$1 where id=$2',[other,member.id]),e=>e.code==='42501')
  await assert.rejects(db.query('delete from club_members where id=$1',[member.id]),e=>e.code==='42501')
  await db.query("update club_members set firstname='Bearbeitet',notes='Neue Bemerkung',is_active=false where id=$1",[member.id])
  assert.equal(await scalar('select is_active from club_members where id=$1',[member.id]),false)
  assert.equal((await db.query('update club_members set is_active=true where id=$1 and updated_at=$2 returning id',[member.id,member.updated_at])).rows.length,0)
  await db.query('update club_members set is_active=true where id=$1',[member.id])
  assert.equal(await scalar("select count(*)::int from club_members where search_text ilike '%bearbeitet%'"),1)
  assert.equal(await scalar("select count(*)::int from club_members where search_text ilike '%MAX@EXAMPLE.INVALID%'"),1)
  const csv=parseMemberCsv('Vorname;Nachname;E-Mail;Mitgliedsnummer;Aktiv;Bemerkungen\nMax;Alt;max@example.invalid;007;inaktiv;Nicht überschreiben\nAda;Neu;ada@example.invalid;008;inaktiv;Neu')
  const importRows=()=>scalar('select import_club_members($1,$2)',[club,JSON.stringify(csv.rows)])
  assert.deepEqual(await importRows(),{inserted:1,skipped:1})
  assert.deepEqual(await importRows(),{inserted:0,skipped:2})
  assert.equal(await scalar('select notes from club_members where id=$1',[member.id]),'Neue Bemerkung')
  assert.equal(await scalar('select is_active from club_members where id=$1',[member.id]),true)
  await assert.rejects(scalar('select import_club_members($1,$2)',[other,JSON.stringify(csv.rows)]),e=>e.code==='42501')
  await assert.rejects(scalar('select import_club_members($1,$2)',[club,JSON.stringify([{firstname:'Valid',lastname:'Person',email:'rollback@example.invalid',is_active:true},{firstname:'',lastname:'Bad',email:'bad@example.invalid',is_active:true}])]),e=>e.code==='23514')
  assert.equal(await scalar("select count(*)::int from club_members where email='rollback@example.invalid'"),0)
  await db.exec('reset role')
  const snapshot=await scalar('select jsonb_agg(m order by id) from club_members m')
  await db.exec(sql)
  assert.deepEqual(await scalar('select jsonb_agg(m order by id) from club_members m'),snapshot)
  for(const user of [checkin,inactive,other]) {
    await login(user)
    assert.equal(await scalar('select count(*)::int from club_members'),0)
    await assert.rejects(scalar('select import_club_members($1,$2)',[club,JSON.stringify(csv.rows)]),e=>e.code==='42501')
  }
  await login(superadmin)
  await db.query("insert into club_members(club_id,firstname,lastname,email,member_number) values($1,'Other','Member','max@example.invalid','007')",[other])
  assert.equal(await scalar('select count(*)::int from club_members'),3)
  await login(admin)
  assert.equal(await scalar('select count(*)::int from club_members'),2)
  await db.exec('reset role;set role anon')
  await assert.rejects(db.query('select * from club_members'),e=>e.code==='42501')
  await assert.rejects(scalar('select import_club_members($1,$2)',[club,'[]']),e=>e.code==='42501')
  await db.exec('reset role')
  const deletion=await readFile(new URL('../supabase/migrations/20261114_delete_club_members.sql',import.meta.url),'utf8')
  await db.exec(deletion);await db.exec(deletion)
  for(const user of [checkin,inactive,other]) {
    await login(user)
    assert.equal((await db.query('delete from club_members where id=$1 returning id',[member.id])).rows.length,0)
  }
  await db.exec('reset role;set role anon')
  await assert.rejects(db.query('delete from club_members where id=$1',[member.id]),e=>e.code==='42501')
  await login(admin)
  const activeMatch=()=>scalar("select exists(select 1 from club_members where club_id=$1 and is_active and lower(trim(email))='max@example.invalid')",[club])
  assert.equal(await activeMatch(),true)
  assert.equal((await db.query('delete from club_members where id=$1 and club_id=$2 returning id',[member.id,other])).rows.length,0)
  assert.equal((await db.query('delete from club_members where id=$1 and club_id=$2 returning id',[member.id,club])).rows.length,1)
  assert.equal(await activeMatch(),false)
  assert.equal(await scalar('select count(*)::int from club_members'),1)
  await db.exec('reset role')
  assert.deepEqual(await scalar("select jsonb_build_object('clubs',(select jsonb_agg(c) from clubs c),'participants',(select jsonb_agg(p) from participants p),'dates',(select jsonb_agg(d) from vaccination_dates d))"),original)
  console.log('PASS: add/edit/deactivate/reactivate/search; CSV and repeat import; duplicate keys; atomic rollback; revision conflict; club/check-in/inactive/anonymous RLS; superadmin; migration repeat with existing members; codes, tariffs, participants and dates unchanged.')
} finally {await db.close()}
