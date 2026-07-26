import { createHmac, timingSafeEqual } from 'node:crypto'

const PAYMENT_PROOF_TTL_MS = 5 * 60 * 1000

function mailProofSecret() {
  return process.env.INTERNAL_MAIL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
}

function signPayload(payload) {
  const secret = mailProofSecret()
  if (!secret) throw new Error('Internal mail authorization is not configured.')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createPaymentMailProof({ participantId, paymentMethod, paymentId }) {
  if (!['stripe', 'paypal', 'bar'].includes(String(paymentMethod))) {
    throw new Error('Unsupported payment method.')
  }
  const issuedAt = Date.now()
  const proof = {
    participantId: String(participantId),
    paymentMethod: String(paymentMethod),
    paymentId: String(paymentId),
    issuedAt,
    expiresAt: issuedAt + PAYMENT_PROOF_TTL_MS
  }
  const payload = Buffer.from(JSON.stringify(proof)).toString('base64url')
  return { payload, signature: signPayload(payload) }
}

export function verifyPaymentMailProof(value) {
  try {
    const payload = String(value?.payload || '')
    const signature = String(value?.signature || '')
    if (!payload || !signature) return null
    const expected = Buffer.from(signPayload(payload), 'utf8')
    const actual = Buffer.from(signature, 'utf8')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const now = Date.now()
    if (
      !proof.participantId ||
      !['stripe', 'paypal', 'bar'].includes(String(proof.paymentMethod)) ||
      !proof.paymentId ||
      !Number.isFinite(proof.issuedAt) ||
      !Number.isFinite(proof.expiresAt) ||
      proof.issuedAt > now + 30000 ||
      proof.expiresAt < now ||
      proof.expiresAt - proof.issuedAt > PAYMENT_PROOF_TTL_MS
    ) return null
    return proof
  } catch {
    return null
  }
}

export function emailSignatureHtml() {
  return `
    <p>Mit freundlichen Grüßen</p>

    <p>
      <strong>Rainer Koplin</strong><br>
      Impfwart<br>
      RGZV Hagen und Umgebung seit 1903 e. V.
    </p>

    <p>
      Kontakt:<br><br>
      Thorsten von Oesen<br>
      E-Mail: t.von-oesen@rgzv-hagen-westfalen.de
    </p>
  `
}
