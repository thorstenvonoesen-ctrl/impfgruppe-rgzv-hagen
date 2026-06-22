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
  vielen Dank für Ihre Anmeldung zur Newcastle-Impfung beim RGZV Hagen.
</p>

<p>
  Ihre Anmeldung wurde erfolgreich erfasst und Ihre Zahlung ist
  erfolgreich eingegangen.
</p>

<p>
  Bitte bewahre diese E-Mail als Bestätigung auf.
</p>

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
