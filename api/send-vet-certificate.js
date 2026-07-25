import nodemailer from 'nodemailer'
import { emailSignatureHtml } from './_email-signature.js'

const TEST_RECIPIENT = 'thorsten-von-oesen@t-online.de'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

function formatGermanDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { pdfData, datum } = req.body || {}
    const deutschesDatum = formatGermanDate(datum)

    if (!deutschesDatum || !pdfData || typeof pdfData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Impftermin oder Sammelimpfbescheinigung fehlt.'
      })
    }

    const pdfContent = pdfData.replace(
      /^data:application\/pdf(?:;filename=[^;]+)?;base64,/,
      ''
    )
    const filenameDate = deutschesDatum.replaceAll('.', '-')
    const subject = `Sammelimpfbescheinigung für den Impftermin vom ${deutschesDatum} – Bitte um Prüfung und Unterzeichnung`

    const info = await transporter.sendMail({
      from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
      to: TEST_RECIPIENT,
      subject,
      attachments: [{
        filename: `Sammelimpfbescheinigung_${filenameDate}.pdf`,
        content: pdfContent,
        encoding: 'base64'
      }],
      html: `
        <p>Sehr geehrte Damen und Herren,</p>

        <p>
          anbei übersenden wir Ihnen die Sammelimpfbescheinigung für den Impftermin vom
          <strong>${deutschesDatum}</strong> mit der freundlichen Bitte um Prüfung und Unterzeichnung.
        </p>

        <p>
          Die Bescheinigung wurde auf Grundlage der für diesen Impftermin eingegangenen Anmeldungen erstellt
          und enthält sämtliche gemeldeten Teilnehmerdaten sowie die für die Durchführung der Sammelimpfung
          erforderlichen Angaben.
        </p>

        <p>Das Dokument ist dieser E-Mail als PDF-Datei beigefügt.</p>

        <p>
          Wir bitten Sie, die Sammelimpfbescheinigung nach Ihrer Prüfung zu unterschreiben und uns anschließend
          wieder zukommen zu lassen. Sollten aus Ihrer Sicht Korrekturen, Ergänzungen oder sonstige Anpassungen
          erforderlich sein, bitten wir um eine kurze Rückmeldung.
        </p>

        <p>
          Sofern möglich, wären wir Ihnen dankbar, wenn Sie Ihrer Rücksendung gleichzeitig auch die Rechnung für
          die durchgeführte Sammelimpfung beifügen könnten. Dies erleichtert uns die weitere Bearbeitung und spart
          beiden Seiten einen zusätzlichen Schriftwechsel.
        </p>

        <p>
          Mit Ihrer Unterstützung leisten Sie einen wichtigen Beitrag zur ordnungsgemäßen Durchführung der
          Sammelimpfung sowie zur vollständigen Dokumentation gegenüber den teilnehmenden Geflügelhaltern und
          den zuständigen Stellen.
        </p>

        <p>
          Für die stets angenehme Zusammenarbeit und Ihre Unterstützung bedanken wir uns bereits heute ganz
          herzlich. Bei Rückfragen oder weiteren Informationen stehen wir Ihnen selbstverständlich jederzeit
          gerne zur Verfügung.
        </p>

        ${emailSignatureHtml()}
      `
    })

    return res.status(200).json({
      success: true,
      message: 'Die Sammelimpfbescheinigung wurde erfolgreich versendet.',
      messageId: info.messageId
    })
  } catch (error) {
    console.error('Tierarztversand fehlgeschlagen:', error)
    return res.status(500).json({
      success: false,
      error: 'Die Sammelimpfbescheinigung konnte nicht versendet werden.'
    })
  }
}
