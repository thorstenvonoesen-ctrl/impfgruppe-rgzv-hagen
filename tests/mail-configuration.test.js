import test from 'node:test'
import assert from 'node:assert/strict'
import { smtpOptions } from '../server/mail-transport.js'
import { mailFailure } from '../server/mail-errors.js'
const fixture={SMTP_HOST:'smtp.strato.de',SMTP_PORT:'465',SMTP_USER:'sender@example.invalid',SMTP_PASS:'secret-fixture'}
test('STRATO SSL and STARTTLS are configured explicitly without weakening TLS',()=>{
  assert.equal(smtpOptions(fixture).secure,true)
  assert.equal(smtpOptions({...fixture,SMTP_PORT:'587'}).requireTLS,true)
  assert.equal(smtpOptions({...fixture,SMTP_PORT:'587'}).secure,false)
  assert.throws(()=>smtpOptions({...fixture,SMTP_PORT:'25'}),/SMTP_PORT/)
  assert.throws(()=>smtpOptions({}),/SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS/)
})
test('mail failures distinguish missing schema, functions, permissions and SMTP without raw details',()=>{
  for(const code of ['42P01','PGRST205','PGRST202','42501','EAUTH','ETIMEDOUT']) {
    const failure=mailFailure({code,message:'secret-fixture recipient@example.invalid SQL'})
    assert.equal(failure.code,code)
    assert.doesNotMatch(failure.error,/secret-fixture|recipient@example|SQL/)
  }
})
