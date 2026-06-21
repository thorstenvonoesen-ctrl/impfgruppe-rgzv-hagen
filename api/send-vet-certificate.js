import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: 't.von-oesen@rgzv-hagen-westfalen.de',
      subject: 'Test Sammelimpfbescheinigung',
      html: `
        <p>Dies ist ein Testversand für die spätere Tierarzt-Funktion.</p>

        <hr style="margin-top:30px">

        <p style="font-size:12px;color:#666;">
        Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen und Umgebung seit 1903 e.V. versendet.
        Antworten auf diese Nachricht werden nicht gelesen oder bearbeitet.
        </p>
      `
    })
console.log('RESEND RESULT:', result)
    return res.status(200).json({
      success: true,
      message: 'E-Mail versendet'
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
