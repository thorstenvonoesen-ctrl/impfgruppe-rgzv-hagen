import { drainMail } from './mail-delivery.js'
import { mailFailure } from './mail-errors.js'

export async function saveRegistrationWithConfirmation(db, participant, { transport, tariff, reference, scheduleMail } = {}) {
  // The RPC commits the registration plus durable intent even if the outbox fails.
  const { data, error } = await db.rpc(tariff ? 'register_with_tariff_confirmation' : 'register_with_confirmation', { registration: { ...participant, ...tariff } })
  if (error) throw error
  if (!data?.id) throw Object.assign(new Error('Registration RPC returned no participant.'), { code: 'REGISTRATION_RESULT' })
  let emailSent = false
  let emailStatus = 'pending'
  const deliver = async () => {
    const started = Date.now()
    try {
      await drainMail({ participantId: data.id, clubId: participant.club_id, kind: 'registration', limit: 1, db, transport })
      const job = await db.from('mail_deliveries').select('status').eq('event_key', `registration:${data.id}`).eq('club_id', participant.club_id).single()
      if (job.error) throw job.error
      emailStatus = job.data.status
      emailSent = emailStatus === 'sent'
      console.info('REGISTRATION_MAIL_RESULT', { reference, participantId: data.id, emailStatus, elapsedMs: Date.now() - started })
    } catch (mailError) {
      console.error('REGISTRATION_MAIL_PENDING', { reference, participantId: data.id, code: mailFailure(mailError).code })
    }
  }
  if (scheduleMail) {
    // Keep the existing worker alive after the response; the durable outbox is the fallback.
    scheduleMail(deliver())
    return { ...data, emailSent: false, emailStatus: 'pending' }
  }
  await deliver()
  return { ...data, emailSent, emailStatus }
}

export async function reconcileRegistrationConfirmations(db,{clubId=null,participantId=null}={}) {
  const {data,error}=await db.rpc('reconcile_registration_confirmations',{target_club:clubId,target_participant:participantId,batch_limit:100})
  if(error){console.error('REGISTRATION_OUTBOX_RECONCILE_FAILED',{code:mailFailure(error).code});return {reconciled:0,reconcileError:mailFailure(error).error}}
  return {reconciled:Number(data||0)}
}
