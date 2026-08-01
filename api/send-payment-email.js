import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import QRCode from 'qrcode'
import { createAdminSupabase } from './_supabase-admin.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const clubMailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})
const qrCodeContentId = 'participant-checkin-qr'
const participantAnimalCountFields = [
  ['chicken_count', 'Hühner'],
  ['bantam_count', 'Zwerghühner'],
  ['turkey_count', 'Puten']
]

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatAppointmentDate(value) {
  if (!value) return 'Nicht angegeben'
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(parsed)
}

function appointmentTime(title) {
  return String(title || '').match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || 'Nicht angegeben'
}

function getParticipantAnimalSummary(participant) {
  const hasStructuredCounts = participantAnimalCountFields.some(([field]) => participant?.[field] != null)
  const animals = hasStructuredCounts
    ? participantAnimalCountFields
        .map(([field, label]) => ({ label, count: Number(participant?.[field] || 0) }))
        .filter(({ count }) => count > 0)
    : participant?.animal_type && Number(participant?.animal_count || 0) > 0
      ? [{ label: participant.animal_type, count: Number(participant.animal_count) }]
      : []
  const total = Number(participant?.animal_count || animals.reduce((sum, animal) => sum + animal.count, 0))

  return { animals, total }
}

export async function sendParticipantEmail({ participantId, emailType = 'payment-confirmation' }) {
    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('email, firstname, lastname, checkin_token, animal_type, animal_count, chicken_count, bantam_count, turkey_count, vaccine, vaccination_date_id, payment_method, payment_status')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      const error = new Error('Teilnehmer nicht gefunden.')
      error.statusCode = 404
      throw error
    }

    const { email, firstname, lastname, checkin_token: checkinToken } = participant
    if (!email || !checkinToken) {
      const error = new Error('E-Mail-Adresse oder Check-in-Token fehlt.')
      error.statusCode = 400
      throw error
    }

    const isBarRegistration = emailType === 'bar-registration'
    if (isBarRegistration && (
      participant.payment_method !== 'bar' ||
      participant.payment_status !== 'offen'
    )) {
      const error = new Error('Die Anmeldung ist keine offene Barzahlung.')
      error.statusCode = 409
      throw error
    }

    const qrCode = await QRCode.toBuffer(checkinToken, {
      type: 'png',
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M'
    })
    const animalSummary = getParticipantAnimalSummary(participant)
    const animalDetailsHtml = animalSummary.animals
      .map(({ label, count }) => `${escapeHtml(label)}: ${count}`)
      .join('<br>')

    let appointment = null
    if (isBarRegistration) {
      const { data, error } = await supabase
        .from('vaccination_dates')
        .select('title, date')
        .eq('id', participant.vaccination_date_id)
        .single()
      if (error || !data) {
        const appointmentError = new Error('Impftermin nicht gefunden.')
        appointmentError.statusCode = 404
        throw appointmentError
      }
      appointment = data
    }

    const paymentConfirmationHtml = `
        <h2>Zahlung erfolgreich eingegangen</h2>

<p>Hallo ${firstname} ${lastname},</p>

<p>
  vielen Dank für Ihre Anmeldung zur Newcastle-Impfung beim RGZV Hagen.
</p>

<p>
  Ihre Anmeldung wurde erfolgreich erfasst und Ihre Zahlung ist
  erfolgreich eingegangen.
</p>

<p>
  <strong>Angemeldete Tiere:</strong><br>
  ${animalDetailsHtml}${animalDetailsHtml ? '<br>' : ''}
  <strong>Gesamtzahl: ${animalSummary.total}</strong>
</p>

<p>
  Bitte bewahre diese E-Mail als Bestätigung auf.
</p>

<div style="margin:30px 0;text-align:center;">
  <img src="cid:${qrCodeContentId}" alt="Persönlicher QR-Code für den Check-in" width="320" height="320" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;">
  <p style="margin:16px auto 0;max-width:520px;">
    Bitte bringen Sie diesen QR-Code am Impftag mit. Der Impfwart scannt ihn zur schnellen Anmeldung.
  </p>
</div>

<p>
  Bei Fragen können Sie sich jederzeit an den RGZV Hagen wenden.
</p>

<p>
  Mit freundlichen Grüßen
</p>

<p>
  Rainer Koplin<br>
  Impfwart RGZV Hagen
</p>

<hr style="margin-top:30px">

<p style="font-size:12px;color:#666;">
Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen erstellt.
</p>
      `

    const barRegistrationHtml = isBarRegistration ? `
<h2>Ihre Anmeldung zum Impftermin ist erfolgreich eingegangen</h2>

<p>Hallo ${escapeHtml(firstname)} ${escapeHtml(lastname)},</p>

<p>vielen Dank für Ihre Anmeldung zur Newcastle-Impfung beim RGZV Hagen.</p>

<p>
  <strong>Impftermin:</strong> ${escapeHtml(appointment.title || 'Impftermin')}<br>
  <strong>Datum:</strong> ${escapeHtml(formatAppointmentDate(appointment.date))}<br>
  <strong>Uhrzeit:</strong> ${escapeHtml(appointmentTime(appointment.title))}
</p>

<p>
  <strong>Angemeldete Tiere:</strong><br>
  ${animalDetailsHtml}${animalDetailsHtml ? '<br>' : ''}
  <strong>Gesamtzahl: ${animalSummary.total}</strong><br>
  <strong>Impfstoff:</strong> ${escapeHtml(participant.vaccine || 'Newcastle')}
</p>

<p>
  <strong>Zahlungsart:</strong> Barzahlung vor Ort<br>
  Die Teilnahmegebühr wird erst am Impftermin vor Ort bezahlt. Der Zahlungsstatus bleibt bis zur Bezahlung <strong>offen</strong>.
</p>

<p>Bitte informieren Sie uns rechtzeitig, falls Sie den Termin nicht wahrnehmen können.</p>

<div style="margin:30px 0;text-align:center;">
  <img src="cid:${qrCodeContentId}" alt="Persönlicher QR-Code für den Check-in" width="320" height="320" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;">
  <p style="margin:16px auto 0;max-width:520px;">
    Bitte bringen Sie diesen QR-Code am Impftag mit. Der Impfwart scannt ihn zur schnellen Anmeldung. Die Barzahlung bleibt bis zur Bezahlung vor Ort offen.
  </p>
</div>

<p>Bei Fragen können Sie sich jederzeit an den RGZV Hagen wenden.</p>

<p>Mit freundlichen Grüßen</p>

<p>
  Rainer Koplin<br>
  Impfwart RGZV Hagen
</p>

<hr style="margin-top:30px">

<p style="font-size:12px;color:#666;">
Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen erstellt.
</p>
    ` : null

    if (isBarRegistration) {
      await clubMailTransporter.sendMail({
        from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Ihre Anmeldung zum Impftermin ist erfolgreich eingegangen',
        attachments: [{
          filename: 'check-in-qr-code.png',
          content: qrCode,
          cid: qrCodeContentId
        }],
        html: barRegistrationHtml
      })
      return { success: true }
    }

    const result = await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: email,
      subject: isBarRegistration
        ? 'Ihre Anmeldung zum Impftermin ist erfolgreich eingegangen'
        : 'Zahlung erfolgreich eingegangen',
      attachments: [{
        filename: 'check-in-qr-code.png',
        content: qrCode.toString('base64'),
        inlineContentId: qrCodeContentId
      }],
      html: isBarRegistration ? barRegistrationHtml : paymentConfirmationHtml
    }, isBarRegistration ? { idempotencyKey: `bar-registration-${participantId}` } : undefined)
    console.log('RESEND RESULT:', result)
console.log('MAIL WIRD GESENDET AN:', email)
    if (isBarRegistration && result.error) throw new Error('Bestätigungsmail konnte nicht versendet werden.')
    return { success: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const { participantId, emailType } = req.body || {}
    if (!participantId) {
      return res.status(400).json({ error: 'Teilnehmer-ID fehlt.' })
    }

    await sendParticipantEmail({ participantId, emailType })
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message })
  }
}
