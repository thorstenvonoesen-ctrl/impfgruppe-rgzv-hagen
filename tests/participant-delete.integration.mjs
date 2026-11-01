// Real isolated PostgreSQL, actual migrations, authenticated RPC. No SMTP imports.
import {PGlite} from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const club='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const admin='33333333-3333-4333-8333-333333333333',checkin='44444444-4444-4444-8444-444444444444',inactive='55555555-5555-4555-8555-555555555555',superadmin='66666666-6666-4666-8666-666666666666'
const migration=name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8')
const repair=await migration('20261107_safe_participant_delete')
for(const variant of ['new-repair','legacy-cascade','no-audit','no-outbox']){
  const db=new PGlite()
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
  const login=async(user)=>db.exec(`reset role;set role authenticated;set test.uid='${user}';`)
  const call=(c,p)=>scalar('select delete_participant_registration($1,$2)',[c,p])
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      create table clubs(id uuid primary key,slug text,member_code text,member_price numeric,guest_price numeric);
      insert into clubs values('${club}','fixture','KEEP-CODE',5,10),('${other}','other','OTHER',6,12);
      create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid,title text,date date,archived boolean default false);
      create table participants(id uuid primary key default gen_random_uuid(),club_id uuid,vaccination_date_id uuid,firstname text,lastname text,email text,
        checked_in boolean default false,registration_status text,payment_method text,checkin_token text,payment_amount numeric default 10,is_member boolean default false);
      create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
      insert into club_admin_memberships values('${admin}','${club}','clubadmin',true),('${checkin}','${club}','checkin_admin',true),('${inactive}','${club}','clubadmin',false),('${superadmin}','${club}','superadmin',true);
      create table club_members(id integer primary key,club_id uuid,notes text);insert into club_members values(1,'${club}','unchanged member');`)
    if(variant==='legacy-cascade')await db.exec(await migration('20261102_repair_mail_campaign_queue'))
    if(variant!=='no-outbox')await db.exec(await migration('20261103_complete_mail_queue_repair'))
    if(['new-repair','legacy-cascade'].includes(variant))await db.exec(await migration('20261105_registration_confirmation_outbox'))
    const archive=await migration('20260830_add_vaccination_date_archive')
    await db.exec(archive.slice(archive.indexOf('create or replace function public.protect_archived_participant')))
    const date=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Fixture','2099-01-10') returning id",[club])
    const otherDate=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Other','2099-01-10') returning id",[other])
    const archivedDate=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Archive','2098-01-10') returning id",[club])
    const addPerson=(c,d,name)=>scalar("insert into participants(club_id,vaccination_date_id,firstname,lastname,email,registration_status) values($1,$2,$3,'Fixture',$4,'bar_registered') returning id",[c,d,name,`${name}@example.invalid`])
    const target=await addPerson(club,date,'target'),survivor=await addPerson(club,date,'survivor'),foreign=await addPerson(other,otherDate,'foreign'),archived=await addPerson(club,archivedDate,'archived'),blocked=await addPerson(club,date,'blocked')
    await db.query('update vaccination_dates set archived=true where id=$1',[archivedDate])
    const audit=['new-repair','legacy-cascade'].includes(variant)
    const addJob=async(p,c,d,status,key)=>{
      const id=await scalar("insert into mail_deliveries(event_key,club_id,appointment_id,participant_id,kind,recipient,payload,status) values($1,$2,$3,$4,'registration','fixture@example.invalid','{}',$5) returning id",[key,c,d,p,status])
      if(audit)await db.query('insert into mail_delivery_retries(delivery_id,club_id,previous_attempts,previous_error_code) values($1,$2,5,$3)',[id,c,'EAUTH'])
      return id
    }
    let sending
    if(variant!=='no-outbox'){
      for(const status of ['sent','pending','failed','uncertain','skipped'])await addJob(target,club,date,status,`target:${status}`)
      sending=await addJob(target,club,date,'sending','target:sending')
      await addJob(survivor,club,date,'sent','survivor')
      await addJob(foreign,other,otherDate,'sent','foreign')
      await addJob(archived,club,archivedDate,'sent','archived')
      await addJob(blocked,club,date,'failed','blocked')
      await db.query("insert into mail_batches(id,club_id,appointment_id,kind) values('campaign-dedup',$1,$2,'new-appointment')",[club,date])
      // Original path fails even as database owner: an FK, not a role restriction.
      await assert.rejects(db.query('delete from participants where id=$1',[target]),e=>{assert.equal(e.code,'23503');console.log(`REPRODUCED ${variant}: ${e.code} ${e.constraint}`);return true})
    }
    await db.exec('create table fixture_dependency(participant_id uuid references participants(id))')
    await db.query('insert into fixture_dependency values($1)',[blocked])
    const snapshot=async()=>{
      await db.exec('reset role')
      const result={}
      for(const table of ['clubs','vaccination_dates','participants','club_members',...(variant!=='no-outbox'?['mail_deliveries','mail_batches']:[]),...(audit?['mail_delivery_retries']:[])])result[table]=(await db.query(`select to_jsonb(r) row from ${table} r order by id`)).rows
      return result
    }
    const before=await snapshot()
    await db.exec(repair);await db.exec(repair)
    assert.deepEqual(await snapshot(),before) // migration installs code only
    for(const user of [checkin,inactive,other]){
      await login(user);await assert.rejects(call(club,target),e=>e.code==='42501')
    }
    await db.exec('reset role;set role anon')
    await assert.rejects(call(club,target),e=>e.code==='42501')
    await login(admin)
    await assert.rejects(call(other,foreign),e=>e.code==='42501')
    await assert.rejects(call(club,foreign),e=>e.code==='P0002')
    await assert.rejects(call(club,archived),e=>e.code==='55000')
    if(sending)await assert.rejects(call(club,target),e=>e.code==='55006')
    await assert.rejects(call(club,blocked),e=>e.code==='23503')
    assert.deepEqual(await snapshot(),before) // even cleanup followed by FK failure rolls back
    if(sending)await db.query("update mail_deliveries set status='sent' where id=$1",[sending])
    const beforeDelete=await snapshot()
    await login(admin)
    const deleted=await call(club,target)
    assert.equal(deleted.deleted,true);assert.equal(deleted.participantId,target)
    assert.equal(deleted.deletedDeliveries,variant==='no-outbox'?0:6)
    assert.equal(deleted.deletedRetryLogs,audit?6:0)
    const after=await snapshot()
    for(const table of ['clubs','vaccination_dates','club_members',...(variant!=='no-outbox'?['mail_batches']:[])])assert.deepEqual(after[table],beforeDelete[table])
    assert.deepEqual(after.participants,beforeDelete.participants.filter(x=>x.row.id!==target))
    if(variant!=='no-outbox'){
      const targetJobs=new Set(beforeDelete.mail_deliveries.filter(x=>x.row.participant_id===target).map(x=>x.row.id))
      assert.deepEqual(after.mail_deliveries,beforeDelete.mail_deliveries.filter(x=>!targetJobs.has(x.row.id)))
      if(audit)assert.deepEqual(after.mail_delivery_retries,beforeDelete.mail_delivery_retries.filter(x=>!targetJobs.has(x.row.delivery_id)))
      const claimed=await scalar('select count(*)::int from claim_mail_delivery($1)',[sending])
      assert.equal(claimed,0) // removed mail cannot subsequently be claimed
    }
    await login(admin);await assert.rejects(call(club,target),e=>e.code==='P0002')
    await login(superadmin);assert.equal((await call(other,foreign)).deleted,true)
    console.log(`PASS ${variant}: authenticated single deletion, scoped mail/retry cleanup, survivor snapshots, role isolation, archive/in-flight guard, unknown-FK rollback, repeat migration; no SMTP.`)
  }catch(error){console.error({variant,code:error.code,message:error.message,stack:error.code?undefined:error.stack});throw new Error(`Deletion integration failed: ${variant}`)}finally{await db.close()}
}
