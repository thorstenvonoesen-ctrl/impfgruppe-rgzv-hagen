import test from 'node:test'
import assert from 'node:assert/strict'
import { activeStatuses, berlinInstant, canEditRegistration, managementToken, verifyManagementToken, reminderDue, previousRecipients } from '../server/mail-rules.js'
import { buildParticipantMail } from '../server/participant-mail.js'
import { buildTestMail, sendTestMail, testKinds } from '../server/mail-test.js'
import { cleanManagementChanges } from '../server/manage-registration.js'
import { deliverMail, failureStatus } from '../server/mail-delivery.js'
import { authorizeMailAdmin, isCronRequest, makePreviewToken, checkPreviewToken } from '../server/mail-workflows.js'
import { paymentMailHeaders, authorizedPaymentMail } from '../server/payment/mail-authorization.js'

// Only fixtures: never contact SMTP, Supabase, or real recipients.
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-secret-not-a-real-key'
process.env.APP_URL = 'https://app.example.invalid'
const id = '11111111-1111-4111-8111-111111111111'
const a = { id: 'appointment', club_id: 'club', title: 'ND Impfung 10:00', date: '2099-06-20', venue_name: 'Vereinshaus', street: 'Musterstraße', house_number: '1', postal_code: '12345', city: 'Musterstadt' }
const p = { id, club_id: 'club', email: 'fixture@example.invalid', firstname: 'Max <script>', lastname: 'Mustermann', tsk_number: 'TSK-TEST', chicken_count: 8, bantam_count: 2, turkey_count: 0, animal_count: 10, vaccine: 'Newcastle', payment_status: 'offen', payment_amount: 10, registration_status: 'bar_registered', checkin_token: 'fixture-qr' }

test('management tokens are registration-specific and reject forged links', () => {
  const token = managementToken(id)
  assert.equal(verifyManagementToken(token), id)
  assert.equal(verifyManagementToken(token + 'x'), null)
  assert.equal(verifyManagementToken(token.replace('11111111', '21111111')), null)
  assert.equal(verifyManagementToken(p.checkin_token), null)
})
test('deadline, closure, archive, cancellation and check-in prohibit edits', () => {
  const now = berlinInstant('2099-06-19','10:00')
  assert.equal(canEditRegistration(a,p,now),true)
  for (const modified of [{...a,archived:true},{...a,registration_closed:true},{...a,registration_closes_at:'2099-06-18T10:00:00Z'}]) assert.equal(canEditRegistration(modified,p,now),false)
  assert.equal(canEditRegistration(a,{...p,checked_in:true},now),false)
  assert.equal(canEditRegistration(a,{...p,registration_status:'cancelled'},now),false)
  assert.equal(canEditRegistration(a,p,berlinInstant(a.date,'10:00')),false)
})
test('reminders are independent, have exact due boundaries and exclude test/archived appointments', () => {
  const event = berlinInstant(a.date,'10:00')
  for (const [kind,hours] of [['reminder-7d',168],['reminder-24h',24]]) {
    const due = event - hours*3600000
    assert.equal(reminderDue(a,kind,due-1),false)
    assert.equal(reminderDue(a,kind,due),true)
    assert.equal(reminderDue(a,kind,due+6*3600000),false)
    assert.equal(reminderDue({...a,title:'TEST 10:00'},kind,due),false)
    assert.equal(reminderDue({...a,is_test:true},kind,due),false)
    assert.equal(reminderDue({...a,archived:true},kind,due),false)
  }
  const dst = {...a,date:'2026-03-29'}
  assert.equal(reminderDue(dst,'reminder-24h',Date.parse('2026-03-28T08:00:00Z')),true)
  assert.equal(reminderDue(dst,'reminder-7d',Date.parse('2026-03-22T09:00:00Z')),true)
})
test('all participant details, cash amount, distinct link and QR appear in confirmations', async () => {
  for (const kind of ['registration','changed','reminder-7d','reminder-24h','appointment-change']) {
    const mail = await buildParticipantMail(kind,p,a)
    for (const text of ['Max &lt;script&gt;','20.06.2099','10:00','Musterstraße','Hühner: 8','Zwerghühner: 2','Gesamtzahl','Newcastle','10,00','vor Ort in bar','Meine Anmeldung verwalten']) assert.ok(mail.html.includes(text), `${kind}: ${text}`)
    assert.match(mail.html, /#manage=/)
    assert.doesNotMatch(mail.html, /PayPal|Stripe|Onlinezahlung/)
    assert.equal(mail.attachments[0].content.subarray(1,4).toString(),'PNG')
  }
  const paid = await buildParticipantMail('changed',{...p,payment_status:'bezahlt'},a)
  assert.match(paid.html, /Bezahlt/)
  assert.doesNotMatch(paid.html, /Offener Betrag|vor Ort in bar/)
  const cancelled = await buildParticipantMail('cancelled',p,a)
  assert.match(cancelled.html,/keine aktive Anmeldung mehr/)
  assert.equal(cancelled.attachments.length,0)
  assert.doesNotMatch(cancelled.html, /#manage=/)
})
test('closed registration reminder has QR but no management button', async () => {
  const mail = await buildParticipantMail('reminder-24h',p,{...a,registration_closed:true})
  assert.equal(mail.attachments.length,1)
  assert.doesNotMatch(mail.html, /Meine Anmeldung verwalten/)
})
test('previous recipients require actual attendance at a real earlier date and are deduplicated', () => {
  const dates = [{...a,id:'past',date:'2098-01-01'},{...a,id:'test',date:'2098-02-01',title:'Test 10:00'}]
  const old = {...p,checked_in:true,vaccination_date_id:'past'}
  const people=[old,{...old,email:' FIXTURE@EXAMPLE.INVALID '},{...old,email:'cancelled@example.invalid',registration_status:'cancelled'},{...old,email:'started@example.invalid',checked_in:false},{...old,email:'test@example.invalid',vaccination_date_id:'test'}]
  assert.deepEqual(previousRecipients(people,dates,a).map(r => r.email),['fixture@example.invalid'])
})
test('new appointment mail points to public registration with target date, never management', async () => {
  const mail = await buildParticipantMail('new-appointment',p,a,{clubSlug:'rgzv-hagen'})
  assert.match(mail.html, /rgzv-hagen\?vaccinationDateId=appointment#signup/)
  assert.doesNotMatch(mail.html, /#manage=/)
})
test('management accepts only editable fields and validates animal expansion', () => {
  const result=cleanManagementChanges({...p,firstname:'Max',payment_status:'bezahlt',checked_in:true,chicken_count:12})
  assert.equal(result.animal_count,14)
  assert.equal(result.payment_status,undefined)
  assert.equal(result.checked_in,undefined)
  assert.throws(()=>cleanManagementChanges({...p,chicken_count:-1}))
  assert.throws(()=>cleanManagementChanges({...p,email:'invalid'}))
})
test('nine test templates contain only dummy links/data, all attachment types retained', async () => {
  for (const kind of testKinds) {
    const mail=await buildTestMail(kind,'only-test@example.invalid')
    assert.equal(mail.to,'only-test@example.invalid')
    assert.match(mail.subject,/^\[TEST\]/)
    assert.equal(mail.cc,undefined)
    assert.equal(mail.bcc,undefined)
    assert.equal(mail.envelope,undefined)
    assert.doesNotMatch(mail.html,/#manage=/)
    if (['receipt','vet'].includes(kind)) {
      const content=mail.attachments[0].content
      assert.equal((Buffer.isBuffer(content)?content:Buffer.from(content,'base64')).subarray(0,4).toString(),'%PDF')
    }
  }
})
test('test sender refuses missing configuration and ignores production recipient variables', async () => {
  const original=process.env.MAIL_TEST_RECIPIENT
  delete process.env.MAIL_TEST_RECIPIENT
  let sends=0
  const transport={sendMail:async mail=>{sends++;assert.equal(mail.to,'only-test@example.invalid');return {messageId:'fake'}}}
  await assert.rejects(()=>sendTestMail('vet',transport),/MAIL_TEST_RECIPIENT/)
  assert.equal(sends,0)
  process.env.MAIL_TEST_RECIPIENT='only-test@example.invalid'
  for(const kind of testKinds) await sendTestMail(kind,transport)
  assert.equal(sends,9)
  if(original===undefined)delete process.env.MAIL_TEST_RECIPIENT;else process.env.MAIL_TEST_RECIPIENT=original
})
test('admin, cron and internal payment mail authorization fail closed', async () => {
  assert.equal(await authorizeMailAdmin({headers:{}},{},'club'),false)
  const db={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:()=>({select(){return this},eq(){return this},then(resolve){resolve({data:[{role:'checkin_admin',club_id:'club'}]})}})}
  assert.equal(await authorizeMailAdmin({headers:{authorization:'Bearer fake'}},db,'club'),false)
  delete process.env.CRON_SECRET
  assert.equal(isCronRequest({headers:{authorization:'Bearer undefined'}}),false)
  const headers=paymentMailHeaders(id)
  const req={headers:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]))}
  assert.equal(authorizedPaymentMail(req,id),true)
  assert.equal(authorizedPaymentMail(req,'different'),false)
  const token=makePreviewToken('list-1')
  assert.equal(checkPreviewToken(token,'list-1'),true)
  assert.equal(checkPreviewToken(token,'list-2'),false)
})

function memoryDb(jobs) {
  const tables={mail_deliveries:jobs,participants:[{...p}],vaccination_dates:[a]}
  return {
    async rpc(_name,{delivery_id}) {const job=jobs.find(j=>j.id===delivery_id);if(!['pending','failed'].includes(job.status))return {data:[]};job.status='sending';return {data:[structuredClone(job)]}},
    from(name) {const filters=[];let update;let single=false;const q={select(){return q},eq(key,value){filters.push(r=>r[key]===value);return q},is(key,value){filters.push(r=>(r[key]??null)===value);return q},update(value){update=value;return q},maybeSingle(){single=true;return q},then(resolve){const rows=tables[name].filter(r=>filters.every(f=>f(r)));if(update)rows.forEach(r=>Object.assign(r,update));resolve({data:single?rows[0]:rows,error:null})}};return q}
  }
}
const fixtureJob=key=>({id:key,status:'pending',kind:'registration',participant_id:id,appointment_id:a.id,recipient:p.email,payload:{participant:p,appointment:a}})
test('parallel workers atomically claim a delivery only once',async()=>{
  const jobs=[fixtureJob('one')]; const db=memoryDb(jobs);let count=0
  const transport={sendMail:async()=>{count++;return {messageId:'fake'}}}
  await Promise.all([deliverMail('one',{db,transport}),deliverMail('one',{db,transport})])
  assert.equal(count,1);assert.equal(jobs[0].status,'sent')
})
test('partial batch retry does not resend successful recipients',async()=>{
  const jobs=[fixtureJob('one'),fixtureJob('two')];const db=memoryDb(jobs);let count=0
  const transport={sendMail:async()=>{count++;if(count===2)throw Object.assign(new Error('temporary reject'),{responseCode:451});return {messageId:'fake'}}}
  for(const j of jobs)await deliverMail(j.id,{db,transport})
  assert.equal(jobs[0].status,'sent');assert.equal(jobs[1].status,'failed')
  for(const j of jobs)await deliverMail(j.id,{db,transport})
  assert.equal(count,3);assert.equal(jobs[1].status,'sent')
})
test('ambiguous SMTP failure is held, never automatically retried',async()=>{
  const jobs=[fixtureJob('one')];const db=memoryDb(jobs);let count=0
  const transport={sendMail:async()=>{count++;throw Object.assign(new Error('connection lost'),{code:'ETIMEDOUT',command:'DATA'})}}
  await deliverMail('one',{db,transport});await deliverMail('one',{db,transport})
  assert.equal(count,1);assert.equal(jobs[0].status,'uncertain')
  assert.equal(failureStatus({code:'EAUTH'}),'failed')
})
