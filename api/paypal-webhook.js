import { createAdminSupabase } from './_supabase-admin.js'
import { createPaymentMailProof } from './_email-signature.js'

const PAYPAL_API_BASE = 'https://api-m.paypal.com'

function amountToCents(value) {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  const cents = Math.round(amount * 100)
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(amount * 100 - cents) > 0.000001
  ) return null
  return cents
}

function getInvoiceId(participant) {
  return `club:${participant.club_id}:participant:${participant.id}`
}

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64')
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  if (!response.ok) throw new Error('PAYPAL_AUTH_FAILED')
  const data = await response.json()
  if (!data.access_token) throw new Error('PAYPAL_AUTH_FAILED')
  return data.access_token
}

async function verifyWebhookSignature(req, event, accessToken) {
  const transmissionId = req.headers['paypal-transmission-id']
  const transmissionTime = req.headers['paypal-transmission-time']
  const transmissionSig = req.headers['paypal-transmission-sig']
  const certUrl = req.headers['paypal-cert-url']
  const authAlgo = req.headers['paypal-auth-algo']
  const webhookId = process.env.PAYPAL_WEBHOOK_ID

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo ||
    !webhookId
  ) return false

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: event
    })
  })

  if (!response.ok) return false
  const verification = await response.json()
  return verification.verification_status === 'SUCCESS'
}

async function getPayPalOrder(orderId, accessToken) {
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) throw new Error('PAYPAL_ORDER_NOT_FOUND')
  return response.json()
}

function validateCompletedOrder(order, participant, expectedAmountCents, eventCapture) {
  if (!order || String(order.id) !== String(participant.paypal_order_id)) return null
  if (order.status !== 'COMPLETED') return null
  if (!Array.isArray(order.purchase_units) || order.purchase_units.length !== 1) return null

  const unit = order.purchase_units[0]
  if (String(unit.custom_id) !== String(participant.id)) return null
  if (String(unit.invoice_id) !== getInvoiceId(participant)) return null
  if (String(unit.amount?.currency_code || '').toUpperCase() !== 'EUR') return null
  if (amountToCents(unit.amount?.value) !== expectedAmountCents) return null

  const captures = unit.payments?.captures
  const refunds = unit.payments?.refunds
  if (!Array.isArray(captures) || captures.length !== 1) return null
  if (Array.isArray(refunds) && refunds.length > 0) return null

  const capture = captures[0]
  if (
    capture.status !== 'COMPLETED' ||
    capture.final_capture !== true ||
    String(capture.amount?.currency_code || '').toUpperCase() !== 'EUR' ||
    amountToCents(capture.amount?.value) !== expectedAmountCents
  ) return null

  if (
    !eventCapture ||
    eventCapture.status !== 'COMPLETED' ||
    String(eventCapture.id) !== String(capture.id) ||
    String(eventCapture.amount?.currency_code || '').toUpperCase() !== 'EUR' ||
    amountToCents(eventCapture.amount?.value) !== expectedAmountCents
  ) return null

  return capture
}

function isSameProcessedPayment(participant, captureId) {
  return (
    participant.payment_status === 'bezahlt' &&
    participant.payment_method === 'paypal' &&
    String(participant.payment_id) === String(captureId)
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const event = req.body
    if (!event || typeof event !== 'object') {
      return res.status(400).json({ error: 'Ungültiger Webhook.' })
    }

    const accessToken = await getPayPalAccessToken()
    const signatureValid = await verifyWebhookSignature(req, event, accessToken)
    if (!signatureValid) {
      return res.status(400).json({ error: 'Webhook-Signatur ungültig.' })
    }

    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return res.status(200).json({ ignored: true })
    }

    const orderId = event.resource?.supplementary_data?.related_ids?.order_id
    if (!orderId) {
      return res.status(200).json({ ignored: true })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, email, payment_amount, payment_status, payment_method, payment_id, paypal_order_id')
      .eq('paypal_order_id', orderId)
      .single()

    if (participantError || !participant) {
      return res.status(200).json({ ignored: true })
    }

    const expectedAmountCents = amountToCents(participant.payment_amount)
    if (expectedAmountCents === null || !participant.club_id) {
      return res.status(200).json({ ignored: true })
    }

    const order = await getPayPalOrder(orderId, accessToken)
    const completedCapture = validateCompletedOrder(
      order,
      participant,
      expectedAmountCents,
      event.resource
    )
    if (!completedCapture) {
      return res.status(200).json({ ignored: true })
    }

    if (isSameProcessedPayment(participant, completedCapture.id)) {
      return res.status(200).json({ success: true, alreadyProcessed: true })
    }

    if (
      participant.payment_status !== 'offen' ||
      participant.payment_method !== null ||
      participant.payment_id !== null
    ) {
      return res.status(200).json({ ignored: true })
    }

    const { data: reusedPayment, error: reusedPaymentError } = await supabase
      .from('participants')
      .select('id')
      .eq('payment_id', completedCapture.id)
      .neq('id', participant.id)
      .limit(1)
      .maybeSingle()

    if (reusedPaymentError) throw reusedPaymentError
    if (reusedPayment) {
      return res.status(200).json({ ignored: true })
    }

    const { data: updatedParticipant, error: updateError } = await supabase
      .from('participants')
      .update({
        payment_status: 'bezahlt',
        payment_method: 'paypal',
        payment_date: new Date().toISOString(),
        payment_id: String(completedCapture.id)
      })
      .eq('id', participant.id)
      .eq('club_id', participant.club_id)
      .eq('paypal_order_id', orderId)
      .eq('payment_status', 'offen')
      .is('payment_method', null)
      .is('payment_id', null)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedParticipant) {
      return res.status(200).json({ success: true, alreadyProcessed: true })
    }

    let emailSent = false
    if (participant.email) {
      const authorization = createPaymentMailProof({
        participantId: participant.id,
        paymentMethod: 'paypal',
        paymentId: completedCapture.id
      })
      const emailResponse = await fetch(`https://${req.headers.host}/api/send-payment-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization })
      })
      const emailResult = await emailResponse.json().catch(() => ({}))
      emailSent = Boolean(emailResponse.ok && emailResult.emailSent)
    }

    return res.status(200).json({ success: true, emailSent })
  } catch {
    return res.status(500).json({ error: 'Webhook-Verarbeitung fehlgeschlagen.' })
  }
}
