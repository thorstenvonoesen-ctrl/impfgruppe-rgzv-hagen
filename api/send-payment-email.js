import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const { email, firstname, lastname } = req.body

    await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: email,
      subject: 'Zahlung erfolgreich eingegangen',
      html: `
        <h2>Vielen Dank für Ihre Anmeldung</h2>
        <p>Hallo ${firstname} ${lastname},</p>
        <p>Ihre Zahlung für die Impfgruppe RGZV Hagen ist erfolgreich eingegangen.</p>
        <p>Ihr Zahlungsstatus wurde auf bezahlt gesetzt.</p>
        <p>Mit freundlichen Grüßen<br>RGZV Hagen</p>
      `
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
