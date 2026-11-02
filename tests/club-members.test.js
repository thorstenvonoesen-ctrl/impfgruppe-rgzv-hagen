import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanMember, emptyMember, parseMemberCsv, memberService, memberError } from '../club-members.js'

test('member fields validate, normalize and exclude signup/payment fields', () => {
  const member=cleanMember({...emptyMember(),firstname:' Max ',lastname:' Muster ',email:' MAX@EXAMPLE.INVALID ',member_number:' ',member_code:'change',payment_amount:0})
  assert.equal(member.email,'max@example.invalid');assert.equal(member.member_number,null)
  assert.equal(member.member_code,undefined);assert.equal(member.payment_amount,undefined)
  for (const change of [{firstname:''},{email:'bad'},{notes:'x'.repeat(2001)},{is_active:'false'}]) assert.throws(()=>cleanMember({...member,...change}))
})

test('CSV supports BOM, Excel separators, escaped quotes, multiline notes and inactive members', () => {
  const parsed=parseMemberCsv('\uFEFFsep=;\r\nVorname;Nachname;E-Mail-Adresse;Mitgliedsnummer;Aktiv;Bemerkungen\r\nMax;Muster;MAX@example.invalid;007;inaktiv;"Erste Zeile; Text\n""Zweite"""\r\n')
  assert.equal(parsed.errors.length,0);assert.equal(parsed.rows.length,1)
  assert.equal(parsed.rows[0].is_active,false);assert.equal(parsed.rows[0].member_number,'007')
  assert.equal(parsed.rows[0].notes,'Erste Zeile; Text\n"Zweite"')
  assert.equal(parseMemberCsv('Vorname,Nachname,E-Mail\nAda,Muster,ada@example.invalid').rows[0].is_active,true)
})

test('CSV errors prevent a complete import; duplicates in email and member number are counted', () => {
  const parsed=parseMemberCsv('Vorname;Nachname;E-Mail;Mitgliedsnummer;Aktiv\nMax;Muster;a@example.invalid;1;ja\nMax;Muster; A@EXAMPLE.INVALID ;2;aktiv\nAda;Muster;b@example.invalid;1;true\nEva;Muster;bad;3;false\nTom;Muster;c@example.invalid;4;vielleicht')
  assert.equal(parsed.rows.length,1);assert.equal(parsed.duplicates,2);assert.equal(parsed.errors.length,2)
  assert.throws(()=>parseMemberCsv('Vorname;Nachname\nMax;Muster'),/Kopfzeile/)
  assert.throws(()=>parseMemberCsv('Vorname;Nachname;E-Mail\n"Max;Muster;a@example.invalid'),/geschlossen/)
  assert.throws(()=>parseMemberCsv('Vorname;Nachname;E-Mail\n'+Array(501).fill('A;B;a@example.invalid').join('\n')),/500/)
})

test('save scopes updates to club, row and revision; zero rows is never success', async () => {
  const filters=[]
  let payload
  const q={update(value){payload=value;return q},eq(k,v){filters.push([k,v]);return q},select(){return q},async single(){return {data:null,error:{code:'PGRST116'}}}}
  await assert.rejects(memberService({from:()=>q}).save('club',{...emptyMember(),firstname:'A',lastname:'B',email:'a@example.invalid',id:'member',updated_at:'revision',club_id:'other'}),/inzwischen geändert/)
  assert.deepEqual(filters,[['club_id','club'],['id','member'],['updated_at','revision']])
  assert.equal(payload.club_id,undefined)
  assert.match(memberError({code:'23505',message:'private data'}),/bereits vorhanden/)
  assert.doesNotMatch(memberError({message:'private data'}),/private data/)
})

test('delete affects only the selected member, club and revision; zero rows is not success', async()=>{
  const filters=[]
  let result={data:{id:'member'},error:null}
  const q={delete(){return q},eq(k,v){filters.push([k,v]);return q},select(fields){assert.equal(fields,'id');return q},async single(){return result}}
  const service=memberService({from(table){assert.equal(table,'club_members');return q}})
  const member={id:'member',updated_at:'revision',club_id:'other'}
  assert.deepEqual(await service.remove('club',member),{id:'member'})
  assert.deepEqual(filters,[['club_id','club'],['id','member'],['updated_at','revision']])
  result={data:null,error:null}
  await assert.rejects(service.remove('club',member),/inzwischen geändert/)
})
