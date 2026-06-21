import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 't.von-oesen@rgzv-hagen-westfalen.de',
      subject: 'Test Sammelimpfbescheinigung',
      html: `
        <p>Dies ist ein Testversand für die spätere Tierarzt-Funktion.</p>

        <hr style="margin-top:30px">

        <p style="font-size:12px;color:#666;">
        Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen und Umgebung seit 1903 e.V. versendet.
        </p>
      `
    })

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
