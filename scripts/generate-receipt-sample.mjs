import { mkdir, writeFile } from 'node:fs/promises'
import { buildPaymentReceiptPdf } from '../server/payment/payment-receipt.js'

const outputDirectory = new URL('../output/pdf/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
const pdf = buildPaymentReceiptPdf({
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
})
await writeFile(new URL('quittung-muster.pdf', outputDirectory), pdf)
