import { enqueueMail, drainMail } from '../mail-delivery.js'
import { jsPDF } from 'jspdf'
import { createAdminSupabase } from '../_supabase-admin.js'


function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(value, withTime = false) {
  if (!value) return 'Nicht angegeben'
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(new Date(value))
}

function paymentMethodLabel(value) {
  if (value === 'bar') return 'Barzahlung vor Ort'
  if (value === 'paypal') return 'PayPal'
  if (['stripe', 'card'].includes(value)) return 'Kartenzahlung'
  return String(value || 'Zahlung')
}

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
}

export function buildPaymentReceiptPdf(receipt) {
  const snapshot = receipt.receipt_snapshot
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false })
  doc.setProperties({
    title: `Quittung ${receipt.receipt_number}`,
    subject: 'Quittung über den Erhalt der Teilnahmegebühr',
    author: snapshot.clubName
  })
  doc.setFillColor(18, 60, 43)
  doc.rect(0, 0, 210, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text('QUITTUNG', 20, 17)
  doc.setFontSize(10)
  doc.text(receipt.receipt_number, 20, 25)

  doc.setTextColor(24, 31, 27)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Aussteller', 20, 48)
  doc.setFont('helvetica', 'bold')
  doc.text(snapshot.clubName, 20, 55)
  doc.setFont('helvetica', 'normal')
  doc.text('Impfgruppe - Newcastle-Sammelimpfung', 20, 61)

  doc.setDrawColor(205, 214, 208)
  doc.line(20, 70, 190, 70)
  const rows = [
    ['Empfangen von', snapshot.participantName],
    ['Betrag', formatAmount(snapshot.amount)],
    ['Zahlungsart', paymentMethodLabel(snapshot.paymentMethod)],
    ['Zahlung erhalten am', formatDate(snapshot.paymentDate, true)],
    ['Impftermin', snapshot.appointmentTitle || 'Impftermin'],
    ['Termin am', formatDate(`${snapshot.appointmentDate}T12:00:00`)],
    ['Quittung ausgestellt am', formatDate(snapshot.issuedAt, true)]
  ]
  let y = 83
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 99, 94)
    doc.text(label, 20, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 31, 27)
    doc.text(String(value || '-'), 78, y)
    y += 11
  })

  doc.setFillColor(239, 246, 241)
  doc.roundedRect(20, y + 3, 170, 30, 3, 3, 'F')
  doc.setTextColor(18, 60, 43)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`Erhaltener Betrag: ${formatAmount(snapshot.amount)}`, 28, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Die oben genannte Teilnahmegebühr wurde vollständig erhalten.', 28, y + 24)

  doc.setTextColor(100, 106, 102)
  doc.setFontSize(9)
  doc.text('Automatisch erstellt durch den Impfgruppenmanager des RGZV Hagen.', 20, 276)
  doc.text(`Belegnummer: ${receipt.receipt_number}`, 20, 282)
  return Buffer.from(doc.output('arraybuffer'))
}

export function buildPaymentReceiptEmailHtml(receipt) {
  const snapshot = receipt.receipt_snapshot
  return `
<h2>Ihre Quittung über die Teilnahmegebühr</h2>
<p>Hallo ${escapeHtml(snapshot.participantName)},</p>
<p>vielen Dank. Wir bestätigen den Erhalt Ihrer Teilnahmegebühr.</p>
<p>
  <strong>Quittungsnummer:</strong> ${escapeHtml(receipt.receipt_number)}<br>
  <strong>Betrag:</strong> ${escapeHtml(formatAmount(snapshot.amount))}<br>
  <strong>Zahlungsart:</strong> ${escapeHtml(paymentMethodLabel(snapshot.paymentMethod))}<br>
  <strong>Zahlungsdatum:</strong> ${escapeHtml(formatDate(snapshot.paymentDate, true))}<br>
  <strong>Newcastle-Impftermin:</strong> ${escapeHtml(snapshot.appointmentTitle || 'Newcastle-Impftermin')} am ${escapeHtml(formatDate(`${snapshot.appointmentDate}T12:00:00`))}
</p>
<p>Die zugehörige Quittung finden Sie als PDF im Anhang dieser E-Mail.</p>
<p>Mit freundlichen Grüßen</p>
<p>Rainer Koplin<br>Impfwart RGZV Hagen</p>
<hr style="margin-top:30px">
<p style="font-size:12px;color:#666;">Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen erstellt.</p>`
}

async function loadStoredReceipt(supabase, participantId) {
  const { data, error } = await supabase
    .from('participants')
    .select('id, email, club_id, vaccination_date_id, receipt_number, receipt_issued_at, receipt_snapshot, receipt_email_sent_at')
    .eq('id', participantId)
    .single()
  if (error || !data?.receipt_number) throw error || new Error('Quittung nicht gefunden.')
  return data
}

export async function ensurePaymentReceipt(participantId, { sendEmail = true } = {}) {
  const supabase = createAdminSupabase()
  const { error: issueError } = await supabase.rpc('issue_payment_receipt', { target_participant_id: participantId })
  if (issueError) throw issueError
  const receipt = await loadStoredReceipt(supabase, participantId)
  const pdf = buildPaymentReceiptPdf(receipt)

  if (sendEmail && receipt.email && !receipt.receipt_email_sent_at) {
    await enqueueMail({ event_key: `receipt:${receipt.receipt_number}`, club_id: receipt.club_id, appointment_id: receipt.vaccination_date_id, participant_id: participantId, kind: 'receipt', recipient: receipt.email.trim().toLowerCase(), payload: { receipt } }, supabase)
    await drainMail({ participantId, db: supabase, limit: 3 })
    const { data: delivery, error } = await supabase.from('mail_deliveries').select('status,sent_at').eq('event_key', `receipt:${receipt.receipt_number}`).single()
    if (error || delivery?.status !== 'sent') throw new Error('Quittung ist zum Versand vorgemerkt.')
    const marker = await supabase.from('participants').update({ receipt_email_sent_at: delivery.sent_at }).eq('id', participantId).is('receipt_email_sent_at', null)
    if (marker.error) throw marker.error
    receipt.receipt_email_sent_at = delivery.sent_at
  }

  return { receipt, pdf }
}

export async function getStoredPaymentReceipt(participantId) {
  const supabase = createAdminSupabase()
  const receipt = await loadStoredReceipt(supabase, participantId)
  const pdf = buildPaymentReceiptPdf(receipt)
  return { receipt, pdf }
}
