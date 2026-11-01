import { drainMail } from './mail-delivery.js'
import { mailFailure } from './mail-errors.js'

export async function saveRegistrationWithConfirmation(db, participant, { transport } = {}) {
  // The RPC commits the registration and its unique mail job together.
  const { data, error } = await db.rpc('register_with_confirmation', { registration: participant })
  if (error) throw error
  if (!data?.id) throw Object.assign(new Error('Registration RPC returned no participant.'), { code: 'REGISTRATION_RESULT' })
  let emailSent = false
  let emailStatus = 'pending'
  try {
    await drainMail({ participantId: data.id, clubId: participant.club_id, kind: 'registration', limit: 1, db, transport })
    const job = await db.from('mail_deliveries').select('status').eq('event_key', `registration:${data.id}`).eq('club_id', participant.club_id).single()
    if (job.error) throw job.error
    emailStatus = job.data.status
    emailSent = emailStatus === 'sent'
  } catch (mailError) {
    console.error('REGISTRATION_MAIL_PENDING', { participantId: data.id, code: mailFailure(mailError).code })
  }
  return { ...data, emailSent, emailStatus }
}
