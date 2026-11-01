import test from 'node:test'
import assert from 'node:assert/strict'
import { registrationFailure } from '../server/registration-errors.js'
import { publicBaseUrl } from '../server/mail-rules.js'
import { mailFailure } from '../server/mail-errors.js'
test('storage failures distinguish schema, permissions, triggers, duplicates and unknown commit results',()=>{
  for(const [error,status,reason] of [
    [{code:'PGRST202'},503,'DATABASE_FUNCTION_MISSING'],
    [{code:'42703'},503,'DATABASE_SCHEMA_INCOMPLETE'],
    [{code:'42501'},503,'DATABASE_PERMISSION'],
    [{code:'42883',message:'function extensions.gen_random_bytes(integer) does not exist'},503,'CHECKIN_GENERATOR_MISSING'],
    [{code:'55000',message:'Die Check-in-Grundlage fehlt.'},503,'CHECKIN_NOT_CONFIGURED'],
    [{code:'P0001',message:'Für diese Adresse besteht bereits eine Anmeldung.'},409,'DUPLICATE_REGISTRATION'],
    [{code:'23505'},409,'DUPLICATE_REGISTRATION'],
    [{code:'REGISTRATION_RESULT'},502,'COMMIT_RESULT_UNKNOWN']
  ]){const result=registrationFailure(error,'REGISTRATION_COMMIT');assert.equal(result.status,status);assert.equal(result.diagnostic.reason,reason)}
})
test('database row contents and raw errors are neither displayed nor logged',()=>{
  const result=registrationFailure({code:'23514',constraint:'fixture_check',message:'private@example.invalid secret code',details:'secret token',hint:'secret password'},'REGISTRATION_COMMIT')
  assert.equal(result.diagnostic.constraint,'fixture_check')
  assert.doesNotMatch(JSON.stringify(result),/private@example|secret|password|token/)
  assert.equal(registrationFailure(new Error('secret'),'SERVER_CONFIG').status,503)
})
test('invalid mail link configuration has an actionable outbox code without leaking the URL',()=>{
  const keys=['APP_URL','PUBLIC_APP_URL','SITE_URL','VITE_APP_URL','VERCEL_PROJECT_PRODUCTION_URL']
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
  try{
    for(const k of keys)delete process.env[k]
    for(const value of [undefined,'not-a-url','http://example.invalid']){
      if(value===undefined)delete process.env.APP_URL;else process.env.APP_URL=value
      assert.throws(()=>publicBaseUrl(),e=>e.code==='APP_URL_CONFIG')
    }
    assert.equal(mailFailure({code:'APP_URL_CONFIG'}).code,'APP_URL_CONFIG')
    process.env.APP_URL='https://example.invalid';assert.equal(publicBaseUrl(),'https://example.invalid')
  }finally{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}}
})
