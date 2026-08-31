import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPaymentReceiptEmailHtml, buildPaymentReceiptPdf } from '../server/payment/payment-receipt.js'

const receipt = {
  receipt_number: 'Q-2026-000001',
  receipt_snapshot: {
    participantName: 'Erika Musterfrau',
    amount: 10,
    paymentMethod: 'bar',
    paymentDate: '2026-08-30T08:15:00.000Z',
    appointmentTitle: 'ND Impfung Sommer',
    appointmentDate: '2026-08-30',
    clubName: 'RGZV Hagen und Umgebung seit 1903 e.V.',
    issuedAt: '2026-08-30T08:16:00.000Z'
  }
}

test('builds a PDF receipt with a stable receipt number', () => {
  const pdf = buildPaymentReceiptPdf(receipt)
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.ok(pdf.length > 3000)
})

test('receipt email contains payment, appointment and receipt details', () => {
  const html = buildPaymentReceiptEmailHtml(receipt)
  assert.match(html, /Q-2026-000001/)
  assert.match(html, /10,00 EUR/)
  assert.match(html, /Barzahlung vor Ort/)
  assert.match(html, /ND Impfung Sommer/)
  assert.match(html, /PDF im Anhang/)
})

