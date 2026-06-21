import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const { email, firstname, lastname } = req.body

    const result = await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: email,
      subject: 'Zahlung erfolgreich eingegangen',
      html: `
        <h2>Zahlung erfolgreich eingegangen</h2>

<p>Hallo ${firstname} ${lastname},</p>

<p>
  vielen Dank für die Bezahlung Ihrer Anmeldung zum gewählten
  Impftermin des RGZV Hagen und Umgebung seit 1903 e.V.
  Ihre Zahlung wurde erfolgreich verbucht und Ihre Anmeldung
  ist damit vollständig abgeschlossen.
</p>

<p>
  Der benötigte Impfstoff wird anhand der eingegangenen
  Anmeldungen bestellt und für den gewählten Impftermin
  vorbereitet.
</p>

<p>
  Sollten sich Änderungen ergeben oder Sie den Termin
  wider Erwarten nicht wahrnehmen können, bitten wir
  um eine kurze Mitteilung.
</p>

<p>
  Bei Fragen stehen wir Ihnen gerne zur Verfügung.
</p>

<p>
  Mit freundlichen Grüßen<br>
  Ihr Impfwart<br>
  RGZV Hagen und Umgebung seit 1903 e.V.
</p>
<hr style="margin-top:30px">

<p style="font-size:12px;color:#666;">
Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen und Umgebung seit 1903 e.V. erstellt.
Antworten auf diese Nachricht werden nicht gelesen oder bearbeitet.
Bei Fragen oder Änderungswünschen wenden Sie sich bitte direkt an den Verein.
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
