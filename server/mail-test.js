import { jsPDF } from 'jspdf'
import { buildParticipantMail } from './participant-mail.js'
import { buildPaymentReceiptEmailHtml, buildPaymentReceiptPdf } from './payment/payment-receipt.js'
import { buildVetCertificateMail } from '../api/send-vet-certificate.js'
import { clubMailTransporter, mailFrom } from './mail-transport.js'
import { normalizeEmail, validEmail } from './mail-rules.js'

export const testKinds = ['registration','changed','cancelled','reminder-7d','reminder-24h','receipt','appointment-change','vet','new-appointment']
export function testRecipient() {
  const email = normalizeEmail(process.env.MAIL_TEST_RECIPIENT)
  return validEmail(email) ? email : null
}
export async function buildTestMail(kind, recipient) {
  if (!testKinds.includes(kind)) throw new Error('Unbekannter Testtyp.')
  const appointment = { id: 'test-only', title: 'TEST – Musterimpftermin 10:00', date: '2099-06-20', venue_name: 'TEST Vereinsheim', street: 'Musterstraße', house_number: '1', postal_code: '12345', city: 'Musterstadt' }
  const participant = { id: 'test-only', firstname: 'Max', lastname: 'Mustermann', email: recipient, street: 'Musterstraße', housenumber: '1', zipcode: '12345', city: 'Musterstadt', tsk_number: 'TEST-123', phone: 'TEST', chicken_count: 8, bantam_count: 2, turkey_count: 0, animal_count: 10, vaccine: 'Newcastle', payment_status: 'offen', payment_amount: 10 }
  let mail
  if (kind === 'receipt') {
    const receipt = { receipt_number: 'TEST-Q-000001', receipt_snapshot: { participantName: 'Max Mustermann (TEST)', clubName: 'RGZV Hagen – TEST', amount: 10, paymentMethod: 'bar', paymentDate: '2099-06-20T08:00:00Z', appointmentTitle: appointment.title, appointmentDate: appointment.date, issuedAt: '2099-06-20T08:01:00Z' } }
    mail = { subject: '[TEST] Ihre Quittung TEST-Q-000001 über die Teilnahmegebühr', html: buildPaymentReceiptEmailHtml(receipt), attachments: [{ filename: 'TEST-Quittung.pdf', content: buildPaymentReceiptPdf(receipt), contentType: 'application/pdf' }] }
  } else if (kind === 'vet') {
    const doc = new jsPDF()
    doc.text('TEST - Sammelimpfbescheinigung', 14, 20)
    doc.text('Keine echte Impfung / keine echten Teilnehmerdaten', 14, 32)
    doc.text(['Max Mustermann - Musterstrasse 1, 12345 Musterstadt','TSK: TEST-123 | Huehner: 8, Zwerghuehner: 2 | Gesamt: 10','Impftermin: 20.06.2099, 10:00 Uhr','Impfstoff: Nobilis ND Clone 30','Charge: __________ Verwendbar bis: __________','Tierarzt (Stempel / Unterschrift): __________________'], 14, 50)
    mail = buildVetCertificateMail('20.06.2099', Buffer.from(doc.output('arraybuffer')).toString('base64'), recipient)
    mail.subject = `[TEST] ${mail.subject}`
    mail.attachments[0].filename = 'TEST-Sammelimpfbescheinigung.pdf'
  } else mail = await buildParticipantMail(kind, participant, appointment, { test: true, changes: ['Datum','Uhrzeit','Treffpunkt'] })
  // Explicit allowlist: no inherited recipients, CC, BCC or envelope from production.
  return { from: mailFrom(), to: recipient, subject: mail.subject, html: `<p><strong>TEST – ausschließlich Musterdaten.</strong></p>${mail.html}`, attachments: mail.attachments }
}
export async function sendTestMail(kind, transport = clubMailTransporter) {
  const recipient = testRecipient()
  if (!recipient) throw new Error('MAIL_TEST_RECIPIENT muss mit Ihrer eigenen Test-E-Mail-Adresse konfiguriert werden.')
  const result = await transport.sendMail(await buildTestMail(kind, recipient))
  if (!result?.messageId || result.rejected?.length) throw new Error('Testversand nicht bestätigt.')
  return { success: true, recipient }
}
