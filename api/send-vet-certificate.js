import nodemailer from 'nodemailer'
import { emailSignatureHtml } from './_email-signature.js'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

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
    const { pdfData, datum, vaccinationDateId } = req.body || {}
    const deutschesDatum = formatGermanDate(datum)

    if (!deutschesDatum || !vaccinationDateId || !pdfData || typeof pdfData !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Impftermin oder Sammelimpfbescheinigung fehlt.'
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
      .select('id, club_id, date')
      .eq('id', vaccinationDateId)
      .single()
    if (appointmentError || !appointment || appointment.date !== datum) {
      return res.status(404).json({ success: false, error: 'Impftermin nicht gefunden.' })
    }
    const { data: memberships } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role')
      .eq('user_id', userResult.user.id)
      .eq('active', true)
    const authorized = (memberships || []).some(
      membership => membership.role === 'superadmin' || String(membership.club_id) === String(appointment.club_id)
    )
    if (!authorized) return res.status(403).json({ success: false, error: 'Keine Berechtigung für diesen Verein.' })
    await supabase
      .from('vaccination_dates')
      .update({ vet_certificate_generated_at: new Date().toISOString() })
      .eq('id', appointment.id)

    const pdfContent = pdfData.replace(
      /^data:application\/pdf(?:;filename=[^;]+)?;base64,/,
      ''
    )
    const filenameDate = deutschesDatum.replaceAll('.', '-')
    const subject = `Sammelimpfbescheinigung für den Impftermin vom ${deutschesDatum} – Bitte um Prüfung und Unterzeichnung`

    const info = await transporter.sendMail({
      from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
      to: process.env.VET_RECIPIENT_EMAIL || TEST_RECIPIENT,
      subject,
      attachments: [{
        filename: `Sammelimpfbescheinigung_${filenameDate}.pdf`,
        content: pdfContent,
        encoding: 'base64'
      }],
      html: `
        <p>Sehr geehrte Frau Dinger,<br>
sehr geehrte Damen und Herren,</p>

        <p>
          anbei übersenden wir Ihnen die Sammelimpfbescheinigung für den Impftermin vom <strong>${deutschesDatum}</strong>
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
  Gleichzeitig bitten wir darum, uns mit der Rücksendung der unterschriebenen Bescheinigung auch
  die entsprechende Rechnung für die durchgeführte Impfung zu übersenden.
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
    await supabase
      .from('vaccination_dates')
      .update({ vet_certificate_sent_at: new Date().toISOString() })
      .eq('id', appointment.id)

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
