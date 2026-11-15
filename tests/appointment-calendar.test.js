import test from 'node:test'
import assert from 'node:assert/strict'
import {buildAppointmentCalendar} from '../server/appointment-calendar.js'
import {managementToken} from '../server/mail-rules.js'
import {createRegistrationHandler} from '../api/create-registration.js'
import {buildParticipantMail} from '../server/participant-mail.js'
import {manageRegistration} from '../server/manage-registration.js'

process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only'
process.env.APP_URL='https://example.invalid'
const id='11111111-1111-4111-8111-111111111111'
const appointment={id:'fixture-date',club_id:'club',title:'ND Impfung Winter',date:'2027-01-10',time:'10:00',venue_name:'Treffpunkt',street:'Sonntagstrasse',house_number:'3',postal_code:'58099',city:'Hagen'}
test('shared ICS uses Berlin winter/summer time, location, stable UID and safe UTF-8 lines',()=>{
  const winter=buildAppointmentCalendar(appointment,0)
  assert.match(winter,/DTSTART:20270110T090000Z/)
  assert.match(winter,/LOCATION:Treffpunkt\\, Sonntagstrasse 3\\, 58099 Hagen/)
  assert.match(buildAppointmentCalendar({...appointment,date:'2027-06-06'},0),/DTSTART:20270606T080000Z/)
  assert.equal(winter.match(/UID:.+/)[0],buildAppointmentCalendar(appointment).match(/UID:.+/)[0])
  const escaped=buildAppointmentCalendar({...appointment,title:'Ä'.repeat(80)+'\r\nATTENDEE:evil;name,more'},0)
  assert.doesNotMatch(escaped,/\r\nATTENDEE:/)
  for(const line of escaped.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75)
  assert.equal(buildAppointmentCalendar({...appointment,time:'',title:'Ohne Uhrzeit'}),null)
  assert.equal(buildAppointmentCalendar({...appointment,date:'2027-02-30'}),null)
})

test('confirmation offers calendar download and ICS attachment without personal data or mail delivery',async()=>{
  const mail=await buildParticipantMail('registration',{id,email:'fixture@example.invalid',firstname:'Muster',checkin_token:'a'.repeat(64),payment_amount:5},appointment)
  assert.match(mail.html,/Im Kalender speichern/)
  assert.match(mail.html,/action=calendar&amp;token=/)
  const withoutTimestamp=value=>value.replace(/DTSTAMP:.+\r\n/,'')
  assert.equal(withoutTimestamp(mail.attachments.find(a=>a.filename==='impftermin.ics').content),withoutTimestamp(buildAppointmentCalendar(appointment)))
  assert.doesNotMatch(mail.attachments.find(a=>a.filename==='impftermin.ics').content,/fixture@example|token=|ATTENDEE/)
})

test('calendar endpoint checks signed link, current participant/club, missing and cancelled records',async()=>{
  let participant={vaccination_date_id:appointment.id,club_id:'club',registration_status:'bar_registered'}
  const filters=[]
  const db={from(table){const q={select(){return q},eq(key,value){filters.push([table,key,value]);return q},async maybeSingle(){return {data:table==='participants'?participant:appointment,error:null}}};return q}}
  const handler=createRegistrationHandler({createDb:()=>db})
  const call=async(token)=>{const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this},send(body){this.body=body;return this}};await handler({method:'GET',query:{action:'calendar',token}},res);return res}
  assert.equal((await call('forged')).code,403)
  const result=await call(managementToken(id))
  assert.equal(result.code,200);assert.match(result.headers['Content-Type'],/text\/calendar/)
  assert.ok(filters.some(([table,key,value])=>table==='vaccination_dates'&&key==='club_id'&&value==='club'))
  participant=null
  assert.deepEqual((await call(managementToken(id))).body,{error:'Diese Anmeldung ist nicht mehr vorhanden.'})
  const missing={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}
  await manageRegistration({body:{token:managementToken(id),operation:'view'}},missing,{db})
  assert.equal(missing.code,404)
  assert.deepEqual(missing.body,{error:'Diese Anmeldung ist nicht mehr vorhanden.'})
  participant={registration_status:'cancelled'}
  assert.equal((await call(managementToken(id))).code,409)
})
