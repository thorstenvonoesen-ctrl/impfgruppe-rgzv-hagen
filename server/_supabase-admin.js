import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

export function createAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function getBearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

function paymentReturnSecret() {
  const secret = process.env.PAYMENT_RETURN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Payment return verification is not configured.')
  return secret
}

export function createPaymentReturnToken(participantId, provider, lifetimeMs = 2 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({
    participantId: String(participantId),
    provider: String(provider),
    expiresAt: Date.now() + lifetimeMs
  })).toString('base64url')
  const signature = createHmac('sha256', paymentReturnSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyPaymentReturnToken(token, expectedProvider) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', paymentReturnSecret()).update(payload).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (decoded.expiresAt < Date.now() || decoded.provider !== expectedProvider || !decoded.participantId) return null
    return decoded
  } catch {
    return null
  }
}
