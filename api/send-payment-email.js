import { Resend } from 'resend'
import QRCode from 'qrcode'
import { createAdminSupabase } from './_supabase-admin.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const qrCodeContentId = 'participant-checkin-qr'
const participantAnimalCountFields = [
  ['chicken_count', 'Hühner'],
  ['bantam_count', 'Zwerghühner'],
  ['turkey_count', 'Puten']
]

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const { participantId } = req.body || {}
    if (!participantId) {
      return res.status(400).json({ error: 'Teilnehmer-ID fehlt.' })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('email, firstname, lastname, checkin_token, animal_type, animal_count, chicken_count, bantam_count, turkey_count')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    const { email, firstname, lastname, checkin_token: checkinToken } = participant
    if (!email || !checkinToken) {
      return res.status(400).json({ error: 'E-Mail-Adresse oder Check-in-Token fehlt.' })
    }

    const qrCode = await QRCode.toBuffer(checkinToken, {
      type: 'png',
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M'
    })
    const animalSummary = getParticipantAnimalSummary(participant)
    const animalDetailsHtml = animalSummary.animals
      .map(({ label, count }) => `${label}: ${count}`)
      .join('<br>')

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
    })
    console.log('RESEND RESULT:', result)
console.log('MAIL WIRD GESENDET AN:', email)
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
