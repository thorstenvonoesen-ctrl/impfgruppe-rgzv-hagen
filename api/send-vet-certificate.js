import nodemailer from 'nodemailer'
import { emailSignatureHtml } from './_email-signature.js'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

const MAX_PDF_BYTES = 5 * 1024 * 1024
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb'
    }
  }
}

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

function isTestAppointment(appointment) {
  return Object.values(appointment || {}).some(
    value => typeof value === 'string' && value.toLowerCase().includes('test')
  )
}

function validSingleEmail(value) {
  const email = String(value || '').trim()
  return (
    email.length <= 254 &&
    !/[\r\n]/.test(email) &&
    EMAIL_PATTERN.test(email)
  ) ? email : null
}

function parsePdfData(value) {
  if (typeof value !== 'string') return null
  const match = /^data:application\/pdf(?:;filename=[^;\r\n]{1,200})?;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) return null
  const content = Buffer.from(match[1], 'base64')
  if (
    !content.length ||
    content.length > MAX_PDF_BYTES ||
    content.subarray(0, 5).toString('ascii') !== '%PDF-'
  ) return null
  return content
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const contentLength = Number(req.headers['content-length'] || 0)
    if (contentLength > 8 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'Die PDF-Datei ist zu groß.' })
    }

    const { pdfData, datum, vaccinationDateId } = req.body || {}
    const deutschesDatum = formatGermanDate(datum)
    if (!deutschesDatum || !vaccinationDateId || typeof pdfData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Impftermin oder Sammelimpfbescheinigung ist ungültig.'
      })
    }

    const recipient = validSingleEmail(process.env.VET_RECIPIENT_EMAIL)
    if (!recipient) {
      return res.status(503).json({
        success: false,
        error: 'Der Tierarztversand ist nicht konfiguriert.'
      })
    }

    const supabase = createAdminSupabase()
    const accessToken = getBearerToken(req)
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) {
      return res.status(401).json({ success: false, error: 'Authentifizierung erforderlich.' })
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates')
      .select('id, club_id, title, date, note')
      .eq('id', vaccinationDateId)
      .single()
    if (appointmentError || !appointment || appointment.date !== datum) {
      return res.status(404).json({ success: false, error: 'Impftermin nicht gefunden.' })
    }
    if (isTestAppointment(appointment)) {
      return res.status(400).json({ success: false, error: 'Für Testtermine ist kein Tierarztversand möglich.' })
    }
    if (appointment.date > new Date().toISOString().slice(0, 10)) {
      return res.status(409).json({ success: false, error: 'Der Tierarztversand ist noch nicht freigegeben.' })
    }

    const { data: memberships } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role')
      .eq('user_id', userResult.user.id)
      .eq('active', true)
    const authorized = (memberships || []).some(membership =>
      membership.role === 'superadmin' ||
      (membership.role === 'clubadmin' && String(membership.club_id) === String(appointment.club_id))
    )
    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Keine Berechtigung für diesen Verein.' })
    }

    const pdfContent = parsePdfData(pdfData)
    if (!pdfContent) {
      return res.status(400).json({
        success: false,
        error: 'Die Sammelimpfbescheinigung ist keine gültige PDF-Datei.'
      })
    }

    await supabase
      .from('vaccination_dates')
      .update({ vet_certificate_generated_at: new Date().toISOString() })
      .eq('id', appointment.id)
      .eq('club_id', appointment.club_id)

    const filenameDate = deutschesDatum.replaceAll('.', '-')
    const subject = `Sammelimpfbescheinigung für den Impftermin vom ${deutschesDatum} – Bitte um Prüfung und Unterzeichnung`
    const info = await transporter.sendMail({
      from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      attachments: [{
        filename: `Sammelimpfbescheinigung_${filenameDate}.pdf`,
        content: pdfContent,
        contentType: 'application/pdf'
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

    await supabase
      .from('vaccination_dates')
      .update({ vet_certificate_sent_at: new Date().toISOString() })
      .eq('id', appointment.id)
      .eq('club_id', appointment.club_id)

    return res.status(200).json({
      success: true,
      message: 'Die Sammelimpfbescheinigung wurde erfolgreich versendet.',
      messageId: info.messageId
    })
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Die Sammelimpfbescheinigung konnte nicht versendet werden.'
    })
  }
}
