import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const tomorrowString = tomorrow.toISOString().split('T')[0]

    const { data: participants, error } = await supabase
      .from('participants')
      .select(`
        *,
        vaccination_dates (
          title,
          date
        )
      `)
      .eq('payment_status', 'bezahlt')
      .eq('reminder_sent', false)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    let sent = 0

    for (const participant of participants || []) {
      const termin = participant.vaccination_dates

      if (!termin || termin.date !== tomorrowString) continue

      await resend.emails.send({
        from: 'RGZV Hagen <onboarding@resend.dev>',
        to: participant.email,
        subject: 'Erinnerung an Ihren Impftermin beim RGZV Hagen',
        html: `
          <h2>Erinnerung an Ihren Impftermin</h2>

          <p>Hallo ${participant.firstname} ${participant.lastname},</p>

          <p>
            hiermit möchten wir Sie an Ihren bevorstehenden Impftermin
            beim RGZV Hagen und Umgebung seit 1903 e.V. erinnern.
          </p>

          <p>
            <strong>Impftermin:</strong><br>
            ${termin.title} - ${termin.date}
          </p>

          <p>
            Bitte planen Sie ausreichend Zeit für die Teilnahme ein.
          </p>

          <p>
            Sollten Sie den Termin wider Erwarten nicht wahrnehmen können,
            bitten wir um eine kurze Mitteilung.
          </p>

          <p>
            Bitte beachten Sie, dass bei Nichterscheinen keine Erstattung
            der Teilnahmegebühr erfolgen kann.
          </p>

          <p>
            Bei Fragen stehen wir Ihnen gerne zur Verfügung.
          </p>

          <p>
            Mit freundlichen Grüßen<br><br>
            Ihr Impfwart<br>
            RGZV Hagen und Umgebung seit 1903 e.V.
          </p>
          <hr style="margin-top:30px">

<p style="font-size:12px;color:#666;">
Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen und Umgebung seit 1903 e.V. versendet.
Antworten auf diese Nachricht werden nicht gelesen oder bearbeitet.
Bei Fragen oder Änderungen zu Ihrer Anmeldung wenden Sie sich bitte direkt an den Verein.
</p>
        `
      })

      await supabase
        .from('participants')
        .update({ reminder_sent: true })
        .eq('id', participant.id)

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
