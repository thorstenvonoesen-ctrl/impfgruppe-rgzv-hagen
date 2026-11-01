import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteParticipantRegistration, participantDeleteError } from '../participant-delete.js'
test('single deletion calls the authenticated RPC with both club and participant scope',async()=>{
  const db={async rpc(name,args){assert.equal(name,'delete_participant_registration');assert.deepEqual(args,{target_club:'club',target_participant:'one'});return {data:{deleted:true,participantId:'one',deletedDeliveries:2,deletedRetryLogs:1},error:null}}}
  assert.equal((await deleteParticipantRegistration(db,'club','one')).deleted,true)
})
test('failed or zero-row deletions never appear successful and raw database data stays private',async()=>{
  for(const result of [{data:null,error:{code:'23503',message:'private row data SQL'}},{data:{deleted:false},error:null},{data:{deleted:true,participantId:'other'},error:null}]) await assert.rejects(deleteParticipantRegistration({rpc:async()=>result},'club','one'))
  assert.match(participantDeleteError({code:'55006'}),/gerade ein E-Mail-Versand/)
  assert.match(participantDeleteError({code:'42501'}),/Keine Berechtigung/)
  assert.match(participantDeleteError({code:'PGRST202'}),/20261107/)
  assert.doesNotMatch(participantDeleteError({message:'private row data SQL'}),/private row|SQL/)
})
