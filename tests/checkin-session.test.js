import test from 'node:test'
import assert from 'node:assert/strict'
import {previewCheckin} from '../checkin-session.js'

const token='a'.repeat(64)
const body={action:'qr-preview',token,vaccinationDateId:'date'}
test('existing session is reused; a 401 refreshes once with the same participant and appointment',async()=>{
  const requests=[]
  let refreshes=0
  const auth={getSession:async()=>({data:{session:{access_token:'old'}}}),refreshSession:async()=>{refreshes++;return{data:{session:{access_token:'new'}}}}}
  const response=await previewCheckin({auth,body,fetchRequest:async(url,options)=>{
    requests.push(options)
    return{status:requests.length===1?401:200}
  }})
  assert.equal(response.status,200);assert.equal(refreshes,1)
  assert.deepEqual(requests.map(r=>JSON.parse(r.body)),[body,body])
  assert.deepEqual(requests.map(r=>r.headers.Authorization),['Bearer old','Bearer new'])
  refreshes=0
  await previewCheckin({auth,body,fetchRequest:async()=>({status:200})})
  assert.equal(refreshes,0)
})
test('failed refresh returns to login with exactly the scanned token; no endless retries',async()=>{
  let calls=0,loginToken
  const auth={getSession:async()=>({data:{session:null}}),refreshSession:async()=>({data:{session:null},error:new Error('expired')})}
  await assert.rejects(previewCheckin({auth,body,fetchRequest:async()=>{calls++},login:async value=>{loginToken=value}}),/erneut anmelden/)
  assert.equal(calls,0);assert.equal(loginToken,token)
})
test('permissions errors do not refresh or log out; mutation calls cannot be replayed',async()=>{
  const auth={getSession:async()=>({data:{session:{access_token:'valid'}}}),refreshSession:async()=>{assert.fail('must not refresh')}}
  assert.equal((await previewCheckin({auth,body,fetchRequest:async()=>({status:403})})).status,403)
  await assert.rejects(previewCheckin({auth,body:{...body,action:'qr-checkin'}}),/Ungültige/)
})
