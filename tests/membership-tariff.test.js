import test from 'node:test'
import assert from 'node:assert/strict'
import { makeMembershipProof, validMembershipProof, registrationTariff } from '../server/membership-tariff.js'
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-secret'
test('email proofs bind purpose, club, appointment, normalized address and expiry',()=>{
  const {token}=makeMembershipProof('club','date',' MEMBER@EXAMPLE.INVALID ',1000)
  assert.equal(validMembershipProof(token,'club','date','member@example.invalid',1001),true)
  for(const [club,date,email,now] of [['other','date','member@example.invalid',1001],['club','other','member@example.invalid',1001],['club','date','other@example.invalid',1001],['club','date','member@example.invalid',1201000]]) assert.equal(validMembershipProof(token,club,date,email,now),false)
  assert.equal(validMembershipProof(token+'x','club','date','member@example.invalid',1001),false)
})
test('a valid membership code uses configured prices without accessing the member list',async()=>{
  const db={from(table){assert.equal(table,'clubs');return {select(){return this},eq(){return this},async single(){return {data:{member_code:'Keep',member_price:'7.50',guest_price:'13.25'}}}}}}
  const member=await registrationTariff(db,{clubId:'club',appointmentId:'date',email:'unknown@example.invalid',memberCode:' keep '})
  assert.equal(member.amount,7.5);assert.equal(member.source,'code')
  const guest=await registrationTariff(db,{clubId:'club',appointmentId:'date',email:'member@example.invalid'})
  assert.equal(guest.amount,13.25);assert.equal(guest.isMember,false)
})
