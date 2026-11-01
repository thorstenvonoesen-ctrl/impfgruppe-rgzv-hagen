import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { normalizeEmail, validEmail } from './mail-rules.js'
import { clubMailTransporter, mailFrom } from './mail-transport.js'
import { failureStatus } from './mail-delivery.js'
import { mailFailure } from './mail-errors.js'

const secret = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Serverkonfiguration fehlt.')
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}
const mac = value => createHmac('sha256', secret()).update(value).digest('hex')
const emailHash = (clubId,email) => mac(`membership-email-v1:${clubId}:${normalizeEmail(email)}`)
const codeHash = (id,email,code) => mac(`membership-code-v1:${id}:${email}:${code}`)
const fail = message => Object.assign(new Error(message), { publicMessage: message })

export function makeMembershipProof(clubId,appointmentId,email,now=Date.now()) {
  const expiresAt=now+20*60000
  const payload=Buffer.from(JSON.stringify({ purpose:'membership-email-v1',clubId,appointmentId,email:normalizeEmail(email),expiresAt })).toString('base64url')
  return { token:`${payload}.${mac(payload)}`,expiresAt }
}
export function validMembershipProof(token,clubId,appointmentId,email,now=Date.now()) {
  try {
    if(String(token||'').length>2048) return false
    const [payload,signature,...rest]=String(token||'').split('.')
    if(rest.length || !signature || signature.length!==64) return false
    if(!timingSafeEqual(Buffer.from(signature),Buffer.from(mac(payload)))) return false
    const value=JSON.parse(Buffer.from(payload,'base64url').toString())
    return value.purpose==='membership-email-v1' && value.clubId===clubId && value.appointmentId===appointmentId && value.email===normalizeEmail(email) && Number.isFinite(value.expiresAt) && value.expiresAt>now
  } catch {return false}
}
export async function verifiedActiveMember(db,{clubId,appointmentId,email,proof}) {
  if(!validMembershipProof(proof,clubId,appointmentId,email)) return false
  const {data,error}=await db.from('club_members').select('id').eq('club_id',clubId).eq('email',normalizeEmail(email)).eq('is_active',true).maybeSingle()
  if(error) throw error
  return Boolean(data)
}
export async function registrationTariff(db,{clubId,appointmentId,email,memberCode,proof,deferMembershipFailure=false}) {
  const {data:club,error}=await db.from('clubs').select('member_code,member_price,guest_price').eq('id',clubId).single()
  if(error) throw error
  const memberPrice=Number(club.member_price??5),guestPrice=Number(club.guest_price??10)
  if(![memberPrice,guestPrice].every(v=>Number.isFinite(v)&&v>=0&&v<=100000&&Math.abs(Math.round(v*100)-v*100)<0.00001)) throw fail('Die Vereinstarife sind nicht gültig eingerichtet.')
  const code=String(memberCode||'').trim().toUpperCase()
  const byCode=Boolean(code && club.member_code && code===club.member_code.trim().toUpperCase())
  if(byCode) return {amount:memberPrice,source:'code',isMember:true,verifiedEmail:null}
  if(proof && !validMembershipProof(proof,clubId,appointmentId,email)) {
    if(deferMembershipFailure) return {amount:guestPrice,source:'guest',isMember:false,verifiedEmail:null,reviewRequired:true}
    throw fail('Die E-Mail-Bestätigung ist abgelaufen oder passt nicht zu dieser Anmeldung. Bitte erneut bestätigen.')
  }
  const verified=validMembershipProof(proof,clubId,appointmentId,email)
  let member=false
  try {member=verified && await verifiedActiveMember(db,{clubId,appointmentId,email,proof})}
  catch(error){
    if(!deferMembershipFailure) throw error
    console.error('MEMBERSHIP_DEFERRED',{code:/^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(error?.code||'')?error.code:'LOOKUP_FAILED'})
    return {amount:guestPrice,source:'guest',isMember:false,verifiedEmail:verified?normalizeEmail(email):null,reviewRequired:true}
  }
  return {amount:member?memberPrice:guestPrice,source:member?'verified_member':'guest',isMember:Boolean(member),verifiedEmail:verified?normalizeEmail(email):null}
}

export async function handleMembershipRequest(req,res,db,{transport=clubMailTransporter}={}) {
  res.setHeader('Cache-Control','no-store')
  const {action,vaccinationDateId,email:rawEmail,memberCode,proof,challengeId,code}=req.body||{}
  const email=normalizeEmail(rawEmail)
  if(!validEmail(email)) return res.status(400).json({error:'Bitte eine gültige E-Mail-Adresse eingeben.'})
  const {data:a,error}=await db.from('vaccination_dates').select('id,club_id').eq('id',vaccinationDateId).single()
  if(error||!a) return res.status(400).json({error:'Bitte einen gültigen Impftermin auswählen.'})
  if(action==='registration-price') {
    const tariff=await registrationTariff(db,{clubId:a.club_id,appointmentId:a.id,email,memberCode,proof})
    return res.status(200).json({amount:tariff.amount,source:tariff.source})
  }
  const digest=emailHash(a.club_id,email)
  if(action==='membership-challenge') {
    const id=randomUUID(),otp=String(randomInt(10000000,100000000))
    const reserved=await db.rpc('reserve_membership_challenge_v2',{challenge_id:id,target_club:a.club_id,target_appointment:a.id,email_digest:digest,otp_digest:codeHash(id,digest,otp)})
    if(reserved.error) throw reserved.error
    if(!reserved.data?.allowed) {
      if(reserved.data?.reason==='INVALID_SCOPE') return res.status(400).json({error:'Bitte einen gültigen Impftermin auswählen.'})
      return res.status(503).json({error:'Die Mitgliederprüfung ist noch nicht aktuell eingerichtet. Bitte die Administration verständigen: Die Migration zum Entfernen der Anfragebegrenzung fehlt. Anmeldung und Mitgliedercode bleiben verfügbar.'})
    }
    // Identical flow for all addresses; membership is never disclosed before verification.
    let outcome='sent',smtpError
    try {
      const info=await transport.sendMail({from:mailFrom(),to:email,subject:'Ihre E-Mail-Bestätigung für den Impfgruppenmanager',text:`Ihr Bestätigungscode lautet: ${otp}\nEr ist 10 Minuten gültig. Geben Sie ihn nur im Impfgruppenmanager ein. Falls Sie keinen Code angefordert haben, ignorieren Sie diese Nachricht.`})
      if(info?.rejected?.length) throw Object.assign(new Error('SMTP rejected recipient'),{code:'EENVELOPE'})
      if(!info?.messageId) throw Object.assign(new Error('SMTP result unclear'),{code:'MAIL_FAILURE'})
    } catch(error) {smtpError=error;outcome=failureStatus(error)==='failed'?'failed':'uncertain'}
    const finished=await db.rpc('finish_membership_challenge',{challenge_id:id,target_club:a.club_id,outcome})
    if(finished.error||!finished.data) console.error('MEMBERSHIP_SEND_STATUS_FAILED',{code:mailFailure(finished.error).code})
    if(smtpError) {
      console.error('MEMBERSHIP_CODE_SEND_FAILED',{code:mailFailure(smtpError).code,outcome})
      return res.status(503).json({error:outcome==='failed'?'Der Bestätigungscode konnte aus technischen Gründen nicht versendet werden. Bitte erneut versuchen; die Anmeldung und der Mitgliedercode bleiben verfügbar.':'Die Übergabe des Bestätigungscodes konnte nicht sicher bestätigt werden. Bitte zunächst das Postfach prüfen. Die Anmeldung und der Mitgliedercode bleiben verfügbar.'})
    }
    return res.status(200).json({challengeId:id,message:'Der Bestätigungscode wurde an die angegebene E-Mail-Adresse versendet.'})
  }
  if(action==='membership-verify') {
    if(!/^[0-9a-f-]{36}$/i.test(String(challengeId||'')) || !/^\d{8}$/.test(String(code||'').trim())) return res.status(400).json({error:'Bitte einen gültigen achtstelligen Code eingeben.'})
    const checked=await db.rpc('verify_membership_challenge',{challenge_id:challengeId,target_club:a.club_id,target_appointment:a.id,email_digest:digest,otp_digest:codeHash(challengeId,digest,String(code).trim())})
    if(checked.error) throw checked.error
    if(!checked.data) return res.status(400).json({error:'Der Code ist ungültig, abgelaufen oder bereits verwendet. Bitte einen neuen Code anfordern.'})
    return res.status(200).json(makeMembershipProof(a.club_id,a.id,email))
  }
  return res.status(400).json({error:'Ungültige E-Mail-Prüfung.'})
}
