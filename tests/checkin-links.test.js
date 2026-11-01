import test from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import {parseCheckinToken,makeCheckinUrl} from '../checkin-links.js'
import {buildParticipantMail} from '../server/participant-mail.js'
const token='a'.repeat(64)
test('smartphone link and existing raw QR resolve the same token; other link types are rejected',()=>{
  const url=makeCheckinUrl('https://app.example.invalid/rgzv',token)
  assert.equal(url,`https://app.example.invalid/#checkin=${token}`)
  assert.equal(parseCheckinToken(url),token);assert.equal(parseCheckinToken(token),token)
  assert.equal(parseCheckinToken('11111111-1111-4111-8111-111111111111'),'11111111-1111-4111-8111-111111111111')
  for(const value of ['',`javascript:alert(1)#checkin=${token}`,`https://app.example.invalid/#manage=${token}`,`https://app.example.invalid/?checkin=${token}`,'not-a-code'])assert.equal(parseCheckinToken(value),null)
  assert.throws(()=>makeCheckinUrl('https://app.example.invalid','not-a-code'))
})
test('confirmation QR contains the configured app URL, never the management credential',async()=>{
  const previous=process.env.APP_URL,original=QRCode.toBuffer;let encoded
  process.env.APP_URL='https://app.example.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only'
  QRCode.toBuffer=async value=>{encoded=value;return Buffer.from('fixture')}
  try {
    await buildParticipantMail('registration',{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',checkin_token:token,payment_amount:5},{title:'ND',date:'2027-01-10',time:'10:00'})
    assert.equal(encoded,makeCheckinUrl(process.env.APP_URL,token));assert.equal(parseCheckinToken(encoded),token)
    assert.doesNotMatch(encoded,/manage|participant-management/)
  }finally{QRCode.toBuffer=original;if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous}
})
