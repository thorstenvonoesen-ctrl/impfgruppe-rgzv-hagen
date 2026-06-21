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
    const { pdfData } = req.body || {}

const attachments = []

if (pdfData && pdfData !== 'TEST') {
  attachments.push({
    filename: 'sammelimpfbescheinigung.pdf',
    content: pdfData.replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, ''),
    encoding: 'base64'
  })
}

console.log('PDF DATA:', pdfData)
console.log('PDF LENGTH:', pdfData?.length)
console.log('ATTACHMENTS:', attachments.length)
    await transporter.sendMail({
      from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
      to: 't.von-oesen@rgzv-hagen-westfalen.de',
      subject: 'Sammelimpfbescheinigung zur Prüfung und Unterschrift',
attachments,
      html: `
        <p>Sehr geehrte Damen und Herren,</p>

        <p>
          anbei übersenden wir Ihnen die Sammelimpfbescheinigung für den Impftermin vom <strong>[DATUM]</strong>
          mit der freundlichen Bitte um Prüfung und Unterzeichnung.
        </p>

        <p>
          Die Bescheinigung wurde auf Grundlage der für diesen Impftermin eingegangenen Anmeldungen erstellt
          und enthält die gemeldeten Teilnehmerdaten einschließlich der relevanten Angaben für die Durchführung
          der Impfung.
        </p>

        <p>
          Das Dokument wird dieser E-Mail als PDF-Datei beigefügt.
        </p>

        <p>
          Wir bitten Sie, die Bescheinigung nach Prüfung zu unterschreiben und uns anschließend wieder zur
          Verfügung zu stellen. Sofern aus Ihrer Sicht Korrekturen, Ergänzungen oder sonstige Anpassungen
          erforderlich sein sollten, bitten wir um eine kurze Mitteilung.
        </p>

        <p>
          Mit Ihrer Unterstützung leisten Sie einen wichtigen Beitrag zur ordnungsgemäßen Durchführung der
          Sammelimpfung sowie zur vollständigen Dokumentation gegenüber den teilnehmenden Geflügelhaltern
          und den zuständigen Stellen.
        </p>

        <p>
          Für die stets angenehme Zusammenarbeit und Ihre Unterstützung bedanken wir uns bereits im Voraus.
          Bei Rückfragen oder weiteren Informationen stehen wir selbstverständlich jederzeit gerne zur Verfügung.
        </p>

        <p>
          Mit freundlichen Grüßen
        </p>

        <p>
          <strong>Rainer Koplin</strong><br>
          Impfwart<br>
          RGZV Hagen und Umgebung seit 1903 e.V.
        </p>

        <p>
          Kontakt:<br>
          Thorsten von Oesen<br>
          E-Mail: t.von-oesen@rgzv-hagen-westfalen.de
        </p>

        <hr>

        <p style="font-size:12px;color:#666;">
          Diese E-Mail wurde automatisch über das Anmeldesystem des
          RGZV Hagen und Umgebung seit 1903 e.V. erstellt.
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
