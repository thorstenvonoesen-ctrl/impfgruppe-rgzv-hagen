import { createHmac, timingSafeEqual } from 'node:crypto'

function signature(id, timestamp) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Serverkonfiguration fehlt.')
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(`payment-mail:${id}:${timestamp}`).digest('hex')
}
export function paymentMailHeaders(id) {
  const timestamp = String(Date.now())
  return { 'X-Mail-Time': timestamp, 'X-Mail-Signature': signature(id, timestamp) }
}
export function authorizedPaymentMail(req, id) {
  const time = req.headers['x-mail-time']
  if (!time || Math.abs(Date.now() - Number(time)) > 60000 || !Number.isFinite(Number(time))) return false
  const actual = Buffer.from(String(req.headers['x-mail-signature'] || ''))
  const expected = Buffer.from(signature(id, time))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
