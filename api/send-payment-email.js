import { Resend } from 'resend'
import QRCode from 'qrcode'
import { createAdminSupabase } from './_supabase-admin.js'
import { verifyPaymentMailProof } from './_email-signature.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const qrCodeContentId = 'participant-checkin-qr'
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
const MAX_REQUEST_BYTES = 16384

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character])
}

function validSingleEmail(value) {
  const email = String(value || '').trim()
  return (
    email.length <= 254 &&
    !/[\r\n]/.test(email) &&
    EMAIL_PATTERN.test(email)
  ) ? email : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return res.status(413).json({ error: 'Anfrage ist zu groß.' })
  }

  try {
    const proof = verifyPaymentMailProof(req.body?.authorization)
    if (!proof) {
      return res.status(401).json({ error: 'Interne Versandautorisierung ungültig.' })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, email, firstname, lastname, checkin_token, payment_status, payment_method, payment_id, payment_email_sent_at, payment_email_reference')
      .eq('id', proof.participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    if (
      participant.payment_status !== 'bezahlt' ||
      String(participant.payment_method || '') !== String(proof.paymentMethod) ||
      String(participant.payment_id || '') !== String(proof.paymentId)
    ) {
      return res.status(409).json({ error: 'Die Zahlung ist nicht eindeutig bestätigt.' })
    }

    const paymentReference = `${proof.paymentMethod}:${proof.paymentId}`
    if (
      participant.payment_email_sent_at ||
      participant.payment_email_reference === paymentReference
    ) {
      return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
    }

    const email = validSingleEmail(participant.email)
    if (!email || !participant.checkin_token) {
      return res.status(400).json({ error: 'E-Mail-Adresse oder Check-in-Token ist ungültig.' })
    }

    const { data: claimedParticipant, error: claimError } = await supabase
      .from('participants')
      .update({
        payment_email_sent_at: new Date().toISOString(),
        payment_email_reference: paymentReference
      })
      .eq('id', participant.id)
      .eq('payment_status', 'bezahlt')
      .eq('payment_method', proof.paymentMethod)
      .eq('payment_id', proof.paymentId)
      .is('payment_email_sent_at', null)
      .is('payment_email_reference', null)
      .select('id')
      .maybeSingle()

    if (claimError) throw claimError
    if (!claimedParticipant) {
      return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
    }

    const qrCode = await QRCode.toBuffer(String(participant.checkin_token), {
      type: 'png',
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M'
    })

    const firstname = escapeHtml(participant.firstname)
    const lastname = escapeHtml(participant.lastname)
    const result = await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: email,
      subject: 'Zahlung erfolgreich eingegangen',
      attachments: [{
        filename: 'check-in-qr-code.png',
        content: qrCode.toString('base64'),
        inlineContentId: qrCodeContentId
      }],
      html: `
        <h2>Zahlung erfolgreich eingegangen</h2>

<p>Hallo ${firstname} ${lastname},</p>

<p>
  vielen Dank fÃ¼r Ihre Anmeldung zur Newcastle-Impfung beim RGZV Hagen.
</p>

<p>
  Ihre Anmeldung wurde erfolgreich erfasst und Ihre Zahlung ist
  erfolgreich eingegangen.
</p>

<p>
  Bitte bewahre diese E-Mail als BestÃ¤tigung auf.
</p>

<div style="margin:30px 0;text-align:center;">
  <img src="cid:${qrCodeContentId}" alt="PersÃ¶nlicher QR-Code fÃ¼r den Check-in" width="320" height="320" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;">
  <p style="margin:16px auto 0;max-width:520px;">
    Bitte bringen Sie diesen QR-Code am Impftag mit. Der Impfwart scannt ihn zur schnellen Anmeldung.
  </p>
</div>

<p>
  Bei Fragen kÃ¶nnen Sie sich jederzeit an den RGZV Hagen wenden.
</p>

<p>
  Mit freundlichen GrÃ¼ÃŸen
</p>

<p>
  Rainer Koplin<br>
  Impfwart RGZV Hagen
</p>

<hr style="margin-top:30px">

<p style="font-size:12px;color:#666;">
Diese E-Mail wurde automatisch Ã¼ber das Anmeldesystem des RGZV Hagen erstellt.
</p>
      `
    })

    if (result.error) {
      return res.status(502).json({ error: 'Zahlungsbestätigung konnte nicht versendet werden.' })
    }
    return res.status(200).json({ success: true, emailSent: true })
  } catch {
    return res.status(500).json({ error: 'Zahlungsbestätigung konnte nicht versendet werden.' })
  }
}
