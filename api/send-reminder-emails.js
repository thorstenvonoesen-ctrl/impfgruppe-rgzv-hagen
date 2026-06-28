import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      vaccinationDateId,
      type,
      newTime,
      newMeetingPoint
    } = req.body

    const { data: participants, error } = await supabase
      .from('participants')
      .select('*')
      .eq('vaccination_date_id', vaccinationDateId)
      .eq('payment_status', 'bezahlt')

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    let sent = 0

    for (const participant of participants || []) {

      let subject = ''
      let html = ''

      if (type === 'time') {
        subject = 'Änderung der Uhrzeit Ihres Impftermins'

        html = `
          <h2>Änderung der Uhrzeit</h2>

          <p>Hallo ${participant.firstname} ${participant.lastname},</p>

          <p>Die Uhrzeit Ihres Impftermins wurde geändert.</p>

          <p><strong>Neue Uhrzeit:</strong> ${newTime}</p>

          <p>Mit freundlichen Grüßen<br>
          RGZV Hagen und Umgebung seit 1903 e.V.</p>
        `
      } else {
        subject = 'Änderung des Treffpunkts Ihres Impftermins'

        html = `
          <h2>Änderung des Treffpunkts</h2>

          <p>Hallo ${participant.firstname} ${participant.lastname},</p>

          <p>Der Treffpunkt Ihres Impftermins wurde geändert.</p>

          <p><strong>Neuer Treffpunkt:</strong> ${newMeetingPoint}</p>

          <p>Mit freundlichen Grüßen<br>
          RGZV Hagen und Umgebung seit 1903 e.V.</p>
        `
      }

      await resend.emails.send({
        from: 'RGZV Hagen <onboarding@resend.dev>',
        to: participant.email,
        subject,
        html
      })

      sent++
    }

    return res.status(200).json({
      success: true,
      sent
    })

  } catch (error) {
    return res.status(500).json({
      error: error.message
    })
  }
}
