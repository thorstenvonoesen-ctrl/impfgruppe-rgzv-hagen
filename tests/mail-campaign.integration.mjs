// Entire API -> PostgreSQL -> fake SMTP -> status flow. Never loads credentials.
import { PGlite } from '../tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createMailHandler } from '../api/send-reminder-emails.js'
import { smtpOptions } from '../server/mail-transport.js'
const pg = new PGlite()
const club = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const migration = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
const scalar = async (sql,args=[]) => Object.values((await pg.query(sql,args)).rows[0])[0]
const identifier = s => { assert.match(s,/^[a-z_]+$/); return s }
// Minimal PostgREST adapter; all persistence and constraints use real PostgreSQL.
const db = {
  auth: { getUser: async token => ({ data: { user: token === 'fixture-admin' ? { id: club } : null } }) },
  async rpc(name,args) {
    const values = Object.values(args).map(v => typeof v === 'object' ? JSON.stringify(v) : v)
    try {
      const result = await pg.query(`select to_jsonb(r) as item from ${identifier(name)}(${values.map((_,i)=>`$${i+1}`).join(',')}) r`,values)
      return { data: name === 'create_mail_batch' ? result.rows[0].item : result.rows.map(r=>r.item), error:null }
    } catch(error) { return {data:null,error} }
  },
  from(table) {
    identifier(table)
    let fields='*', patch, single=false, count=10000, offset=0, order=''
    const clauses=[], values=[]
    const param = value => { values.push(value);return `$${values.length}` }
    const q = {
      select(f) { fields=f;return q },
      update(value) { patch=value;return q },
      eq(k,v) { clauses.push(`${identifier(k)}=${param(v)}`);return q },
      lt(k,v) { clauses.push(`${identifier(k)}<${param(v)}`);return q },
      lte(k,v) { clauses.push(`${identifier(k)}<=${param(v)}`);return q },
      in(k,items) { clauses.push(`${identifier(k)} in (${items.map(param).join(',')})`);return q },
      order(k,opts) { order=` order by ${identifier(k)} ${opts?.ascending===false?'desc':'asc'}`;return q },
      range(a,b) { offset=a;count=b-a+1;return q },
      limit(n) { count=n;return q },
      maybeSingle() { single=true;return q }, single() { single=true;return q },
      async then(resolve,reject) {
        try {
          let sql
          const where=clauses.length ? ` where ${clauses.join(' and ')}` : ''
          if(patch) sql=`update ${table} set ${Object.entries(patch).map(([k,v])=>`${identifier(k)}=${param(v)}`).join(',')}${where} returning to_jsonb(${table}) item`
          else {
            assert.match(fields,/^[a-z_,*]+$/)
            sql=`select to_jsonb(r) item from (select ${fields} from ${table}${where}${order} limit ${count} offset ${offset}) r`
          }
          const rows=(await pg.query(sql,values)).rows.map(r=>r.item)
          resolve({data:single?(rows[0]||null):rows,error:null})
        } catch(error) { resolve({data:null,error}) }
      }
    };return q
  }
}
process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture-secret'
process.env.APP_URL='https://example.invalid'
const smtpEnv={SMTP_HOST:'smtp.strato.de',SMTP_PORT:'465',SMTP_USER:'sender@example.invalid',SMTP_PASS:'fixture-only'}
let sends=[]
const transport={async sendMail(mail) { sends.push(mail);return {messageId:'simulated-only'} }}
const handler=createMailHandler({createDb:()=>db,transport,validateConfig:()=>smtpOptions(smtpEnv)})
async function request(body, token='fixture-admin', useHandler=handler) {
  const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}
  await useHandler({method:'POST',headers:{authorization:`Bearer ${token}`},body},res)
  return res
}
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table clubs(id uuid primary key,slug text);
    create table club_admin_memberships(user_id uuid,club_id uuid,role text,active boolean);
    create table vaccination_dates(id uuid primary key default gen_random_uuid(),club_id uuid references clubs(id),title text,date date,archived boolean default false);
    create table participants(id uuid primary key default gen_random_uuid(),club_id uuid,vaccination_date_id uuid references vaccination_dates(id),firstname text,lastname text,email text,checked_in boolean,registration_status text);
    insert into clubs values('${club}','fixture-club'),('${other}','other-club');
    insert into club_admin_memberships values('${club}','${club}','clubadmin',true);`)
  await pg.exec(await migration('20261101_repair_vaccination_date_save_fields'))
  const target=await scalar("insert into vaccination_dates(club_id,title,date,time,registration_closes_at) values($1,'ND Impfung Winter','2027-01-10','10:00','2027-01-09T22:00:00Z') returning id",[club])
  const past=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Past vaccination','2026-01-10') returning id",[club])
  const testDate=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'TEST vaccination','2026-01-10') returning id",[club])
  const foreignDate=await scalar("insert into vaccination_dates(club_id,title,date) values($1,'Other club','2026-01-10') returning id",[other])
  for (const [email,checked,status,date,c] of [
    ['past@example.invalid',true,'completed',past,club],[' PAST@EXAMPLE.INVALID ',true,'bar_registered',past,club],
    ['cancelled@example.invalid',true,'cancelled',past,club],['absent@example.invalid',false,'completed',past,club],
    ['other@example.invalid',true,'completed',foreignDate,other],['test@example.invalid',true,'completed',testDate,club],
    ['invalid',true,'completed',past,club]
  ]) await pg.query('insert into participants(club_id,vaccination_date_id,firstname,lastname,email,checked_in,registration_status) values($1,$2,$3,$4,$5,$6,$7)',[c,date,'Fixture','Person',email,checked,status])
  const original=await scalar('select jsonb_agg(to_jsonb(p) order by id) from participants p')
  const originalDates=await scalar('select jsonb_agg(to_jsonb(d) order by id) from vaccination_dates d')
  const body={action:'preview-campaign',vaccinationDateId:target,kind:'new-appointment'}
  let result=await request(body)
  assert.equal(result.code,500);assert.equal(result.body.code,'42P01')
  const repair=await migration('20261103_complete_mail_queue_repair')
  await pg.exec(repair);await pg.exec(repair)
  // Only service role can access the queue or call the mutating RPCs.
  await pg.exec('set role authenticated')
  await assert.rejects(pg.query('select * from mail_batches'),e=>e.code==='42501')
  await pg.exec('reset role')
  result=await request(body)
  assert.equal(result.code,200);assert.equal(result.body.count,1);assert.equal(sends.length,0)
  const invalidConfig=createMailHandler({createDb:()=>db,transport,validateConfig:()=>smtpOptions({})})
  const missingConfig=await request(body,'fixture-admin',invalidConfig)
  assert.equal(missingConfig.body.code,'SMTP_CONFIG');assert.match(missingConfig.body.error,/SMTP_HOST/)
  assert.equal(await scalar('select count(*)::int from mail_batches'),0)
  const missingServer=createMailHandler({createDb:()=>{throw new Error('private configuration')}})
  const serverFailure=await request(body,'fixture-admin',missingServer)
  assert.equal(serverFailure.body.code,'SUPABASE_CONFIG');assert.doesNotMatch(serverFailure.body.error,/private configuration/)
  assert.equal((await request(body,'invalid')).code,403)
  assert.equal((await request({...body,previewToken:'forged',action:'send-campaign'})).code,409)
  const confirmed={...body,action:'send-campaign',previewToken:result.body.previewToken}
  result=await request(confirmed)
  assert.equal(result.code,200);assert.equal(result.body.queued,1);assert.equal(result.body.sent,1)
  assert.equal(sends.length,1);assert.equal(sends[0].to,'past@example.invalid')
  assert.match(sends[0].html,/10\.01\.2027/);assert.match(sends[0].html,/fixture-club/)
  assert.equal((await request(confirmed)).code,409);assert.equal(sends.length,1)
  result=await request(body);assert.equal(result.body.alreadyQueued,true)
  result=await request({action:'mail-status',clubId:club})
  assert.equal(result.code,200);assert.equal(result.body.deliveries[0].status,'sent')
  // A club retry must not even mark another club's interrupted delivery.
  await pg.query("insert into mail_deliveries(event_key,club_id,appointment_id,kind,recipient,payload,status,claimed_at) values('foreign',$1,$2,'new-appointment','foreign@example.invalid','{}','sending',now()-interval '1 hour')",[other,foreignDate])
  await request({action:'retry-pending',clubId:club})
  assert.equal(sends.length,1)
  assert.equal(await scalar("select status from mail_deliveries where event_key='foreign'"),'sending')
  assert.equal((await request({action:'mail-status',clubId:other})).code,403)
  // A later campaign whose SMTP login fails is visible, retained and retryable.
  const second=await scalar("insert into vaccination_dates(club_id,title,date,time) values($1,'Next appointment','2099-01-10','10:00') returning id",[club])
  const rejectedTransport={async sendMail(){throw Object.assign(new Error('private SMTP response'),{code:'EAUTH'})}}
  const rejectedHandler=createMailHandler({createDb:()=>db,transport:rejectedTransport,validateConfig:()=>smtpOptions(smtpEnv)})
  const secondBody={...body,vaccinationDateId:second}
  const secondPreview=await request(secondBody,'fixture-admin',rejectedHandler)
  const failedSend=await request({...secondBody,action:'send-campaign',previewToken:secondPreview.body.previewToken},'fixture-admin',rejectedHandler)
  assert.equal(failedSend.body.failed,1);assert.equal(failedSend.body.sent,0)
  const failedStatus=await request({action:'mail-status',clubId:club})
  const failedRow=failedStatus.body.deliveries.find(row=>row.status==='failed')
  assert.equal(failedRow.error_code,'EAUTH');assert.match(failedRow.error,/SMTP_USER/)
  assert.doesNotMatch(failedRow.error,/private SMTP response/)
  await pg.exec('set role service_role')
  assert.equal(await scalar('select count(*)::int from mail_deliveries'),3)
  await pg.exec('reset role')
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(p) order by id) from participants p'),original)
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(d) order by id) from vaccination_dates d where id<>$1',[second]),originalDates)
  console.log('PASS: API preview -> PostgreSQL queue -> simulated SMTP -> status; migration twice; recipient exclusions and club isolation; duplicate retry blocked; no existing participant/date changes; no real mail.')
} finally {await pg.close()}
