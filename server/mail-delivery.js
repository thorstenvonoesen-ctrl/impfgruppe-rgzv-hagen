import { createAdminSupabase } from './_supabase-admin.js'
import { clubMailTransporter, mailFrom } from './mail-transport.js'
import { activeStatuses, isTestAppointment, reminderDue, validEmail } from './mail-rules.js'
import { buildParticipantMail } from './participant-mail.js'

export function failureStatus(error) {
  // Only explicit rejections / failures before SMTP DATA are safe to retry.
  if (Number(error.responseCode) >= 400 || ['EAUTH', 'ECONNECTION', 'EDNS', 'EENVELOPE'].includes(error.code) || ['CONN', 'EHLO', 'HELO', 'AUTH', 'MAIL FROM', 'RCPT TO'].includes(error.command)) return 'failed'
  return 'uncertain'
}

export async function enqueueMail(row, db = createAdminSupabase()) {
  const { error } = await db.from('mail_deliveries').upsert(row, { onConflict: 'event_key', ignoreDuplicates: true })
  if (error) throw error
}

export async function deliverMail(id, { db = createAdminSupabase(), transport = clubMailTransporter } = {}) {
  const { data, error } = await db.rpc('claim_mail_delivery', { delivery_id: id })
  if (error) throw error
  const job = data?.[0]
  if (!job) return { sent: false, skipped: true }
  let smtpStarted = false
  let accepted = false
  try {
    if (!validEmail(job.recipient)) throw Object.assign(new Error('Invalid recipient'), { code: 'EENVELOPE' })
    let { participant: p, appointment: a } = job.payload
    if (['registration', 'changed', 'reminder-7d', 'reminder-24h', 'appointment-change'].includes(job.kind)) {
      const current = await db.from('participants').select('*').eq('id', job.participant_id).maybeSingle()
      const date = await db.from('vaccination_dates').select('*').eq('id', job.appointment_id).maybeSingle()
      if (current.error || date.error) throw new Error('Datensatz konnte nicht geprüft werden.')
      if (!current.data || !date.data || !activeStatuses.includes(current.data.registration_status) || date.data.archived ||
          (['reminder-7d', 'reminder-24h', 'appointment-change'].includes(job.kind) && isTestAppointment(date.data))) {
        const result = await db.from('mail_deliveries').update({ status: 'skipped' }).eq('id', id)
        if (result.error) throw result.error
        return { sent: false, skipped: true }
      }
      // Never send an old personal snapshot to an address replaced by the owner.
      if (current.data.email.trim().toLowerCase() !== job.recipient) {
        const result = await db.from('mail_deliveries').update({ status: 'skipped' }).eq('id', id)
        if (result.error) throw result.error
        return { sent: false, skipped: true }
      }
      if (job.kind !== 'changed') p = current.data
      a = date.data
      if (job.kind.startsWith('reminder-') && !reminderDue(a, job.kind)) {
        const result = await db.from('mail_deliveries').update({ status: 'skipped' }).eq('id', id)
        if (result.error) throw result.error
        return { sent: false, skipped: true }
      }
    }
    if (job.kind === 'new-appointment') {
      const date = await db.from('vaccination_dates').select('*').eq('id', job.appointment_id).maybeSingle()
      if (date.error) throw date.error
      const { canEditRegistration } = await import('./mail-rules.js')
      if (!date.data || isTestAppointment(date.data) || !canEditRegistration(date.data)) {
        await db.from('mail_deliveries').update({ status: 'skipped' }).eq('id', id)
        return { sent: false, skipped: true }
      }
      a = date.data
    }
    let mail
    if (job.kind === 'receipt') {
      const { buildPaymentReceiptEmailHtml, buildPaymentReceiptPdf } = await import('./payment/payment-receipt.js')
      const receipt = job.payload.receipt
      mail = { subject: `Ihre Quittung ${receipt.receipt_number} über die Teilnahmegebühr`, html: buildPaymentReceiptEmailHtml(receipt), attachments: [{ filename: `${receipt.receipt_number}.pdf`, content: buildPaymentReceiptPdf(receipt), contentType: 'application/pdf' }] }
    } else {
      mail = await buildParticipantMail(job.kind, p, a, job.payload.options)
    }
    smtpStarted = true
    const info = await transport.sendMail({ ...mail, from: mailFrom(), to: job.recipient })
    if (!info?.messageId || info.rejected?.length) throw new Error('SMTP-Ergebnis nicht eindeutig.')
    accepted = true
    const result = await db.from('mail_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), error_code: null }).eq('id', id).eq('status', 'sending')
    if (result.error) throw result.error
    if (job.kind === 'receipt') {
      const marker = await db.from('participants').update({ receipt_email_sent_at: new Date().toISOString() }).eq('id', job.participant_id).is('receipt_email_sent_at', null)
      if (marker.error) throw marker.error
    }
    return { sent: true }
  } catch (error) {
    const status = accepted ? 'sent' : smtpStarted ? failureStatus(error) : 'failed'
    const result = await db.from('mail_deliveries').update({ status, ...(accepted ? { sent_at: new Date().toISOString() } : {}), error_code: accepted ? 'MARKER_UPDATE' : String(error.code || 'MAIL_FAILURE').slice(0, 60), next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString() }).eq('id', id)
    console.error('MAIL_DELIVERY', { id, status, markerSaved: !result.error })
    return { sent: accepted, status }
  }
}

export async function drainMail({ participantId, clubId, limit = 20, budgetMs = 40000, db = createAdminSupabase() } = {}) {
  // A worker crash may occur after SMTP accepted DATA. Never blindly retry it.
  const stale = await db.from('mail_deliveries').update({ status: 'uncertain', error_code: 'INTERRUPTED' }).eq('status', 'sending').lt('claimed_at', new Date(Date.now() - 10 * 60000).toISOString())
  if (stale.error) throw stale.error
  let query = db.from('mail_deliveries').select('id').in('status', ['pending', 'failed']).lt('attempts', 5).lte('next_attempt_at', new Date().toISOString()).order('created_at').limit(limit)
  if (participantId) query = query.eq('participant_id', participantId)
  if (clubId) query = query.eq('club_id', clubId)
  const { data, error } = await query
  if (error) throw error
  let sent = 0
  const start = Date.now()
  for (const row of data || []) {
    if (Date.now() - start > budgetMs) break
    const result = await deliverMail(row.id, { db })
    if (result.sent) sent++
  }
  return { sent }
}
