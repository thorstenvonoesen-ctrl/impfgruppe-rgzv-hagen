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

async function getPayPalOrder(orderId, accessToken) {
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) throw new Error('PAYPAL_ORDER_NOT_FOUND')
  return response.json()
}

function validateOrderAssociation(order, participant, expectedAmountCents) {
  if (!order || String(order.id) !== String(participant.paypal_order_id)) return null
  if (!Array.isArray(order.purchase_units) || order.purchase_units.length !== 1) return null

  const unit = order.purchase_units[0]
  if (String(unit.custom_id) !== String(participant.id)) return null
  if (String(unit.invoice_id) !== getInvoiceId(participant)) return null
  if (String(unit.amount?.currency_code || '').toUpperCase() !== 'EUR') return null
  if (amountToCents(unit.amount?.value) !== expectedAmountCents) return null

  return unit
}

function validateCompletedCapture(order, participant, expectedAmountCents) {
  const unit = validateOrderAssociation(order, participant, expectedAmountCents)
  if (!unit || order.status !== 'COMPLETED') return null

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

  return capture
}

function isSameProcessedPayment(participant, captureId) {
  return (
    participant.payment_status === 'bezahlt' &&
    participant.payment_method === 'paypal' &&
    String(participant.payment_id) === String(captureId)
  )
}

async function sendPaymentEmail(req, participant, paymentId) {
  if (!participant.email) return false
  const authorization = createPaymentMailProof({
    participantId: participant.id,
    paymentMethod: 'paypal',
    paymentId
  })
  const response = await fetch(`https://${req.headers.host}/api/send-payment-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorization })
  })
  const result = await response.json().catch(() => ({}))
  return Boolean(response.ok && result.emailSent)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, participantId, token } = req.body || {}
    if (!participantId) {
      return res.status(400).json({ error: 'Teilnehmer-ID fehlt.' })
    }

    const supabase = createAdminSupabase()

    if (action === 'capture') {
      if (!token) {
        return res.status(400).json({ error: 'PayPal-Token fehlt.' })
      }

      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .select('id, club_id, email, payment_amount, payment_status, payment_method, payment_id, paypal_order_id')
        .eq('id', participantId)
        .single()

      if (participantError || !participant) {
        return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
      }

      const expectedAmountCents = amountToCents(participant.payment_amount)
      if (expectedAmountCents === null || !participant.club_id) {
        return res.status(422).json({ error: 'Die Zahlungsdaten des Teilnehmers sind ungültig.' })
      }

      if (String(participant.paypal_order_id) !== String(token)) {
        return res.status(409).json({ error: 'Die PayPal-Bestellung gehört nicht zu diesem Teilnehmer.' })
      }

      const accessToken = await getPayPalAccessToken()
      const orderBeforeCapture = await getPayPalOrder(token, accessToken)
      const associatedUnit = validateOrderAssociation(orderBeforeCapture, participant, expectedAmountCents)
      if (!associatedUnit) {
        return res.status(409).json({ error: 'Die PayPal-Bestellung konnte nicht eindeutig zugeordnet werden.' })
      }

      const existingCapture = validateCompletedCapture(orderBeforeCapture, participant, expectedAmountCents)
      if (existingCapture && isSameProcessedPayment(participant, existingCapture.id)) {
        return res.status(200).json({
          success: true,
          alreadyProcessed: true,
          emailSent: false
        })
      }

      if (
        participant.payment_status !== 'offen' ||
        participant.payment_method !== null ||
        participant.payment_id !== null
      ) {
        return res.status(409).json({ error: 'Für diesen Teilnehmer wurde bereits eine Zahlung verbucht.' })
      }

      if (!['CREATED', 'APPROVED'].includes(orderBeforeCapture.status)) {
        return res.status(409).json({ error: 'Die PayPal-Bestellung kann nicht verarbeitet werden.' })
      }

      const captureResponse = await fetch(
        `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(token)}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `capture-${token}`
          }
        }
      )
      if (!captureResponse.ok) {
        return res.status(409).json({ error: 'PayPal-Zahlung konnte nicht abgeschlossen werden.' })
      }

      const capturedOrder = await captureResponse.json()
      const completedCapture = validateCompletedCapture(capturedOrder, participant, expectedAmountCents)
      if (!completedCapture) {
        return res.status(409).json({ error: 'Die PayPal-Zahlung ist nicht endgültig abgeschlossen.' })
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
        return res.status(409).json({ error: 'Diese PayPal-Zahlung wurde bereits verwendet.' })
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
        .eq('paypal_order_id', token)
        .eq('payment_status', 'offen')
        .is('payment_method', null)
        .is('payment_id', null)
        .select('id')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedParticipant) {
        const { data: currentParticipant } = await supabase
          .from('participants')
          .select('payment_status, payment_method, payment_id')
          .eq('id', participant.id)
          .single()

        if (isSameProcessedPayment(currentParticipant || {}, completedCapture.id)) {
          return res.status(200).json({
            success: true,
            alreadyProcessed: true,
            emailSent: false
          })
        }
        return res.status(409).json({ error: 'Die PayPal-Zahlung konnte nicht eindeutig verbucht werden.' })
      }

      const emailSent = await sendPaymentEmail(req, participant, completedCapture.id)
      return res.status(200).json({ success: true, emailSent })
    }

    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, payment_amount, payment_status, payment_method, payment_id')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    if (
      participant.payment_status !== 'offen' ||
      participant.payment_method !== null ||
      participant.payment_id !== null
    ) {
      return res.status(409).json({ error: 'Für diesen Teilnehmer wurde bereits eine Zahlung verbucht.' })
    }

    const amountInCents = amountToCents(participant.payment_amount)
    if (amountInCents === null || !participant.club_id) {
      return res.status(422).json({ error: 'Die Zahlungsdaten des Teilnehmers sind ungültig.' })
    }

    const accessToken = await getPayPalAccessToken()
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: String(participant.id),
            invoice_id: getInvoiceId(participant),
            description: 'Impfgruppe RGZV Hagen',
            amount: {
              currency_code: 'EUR',
              value: (amountInCents / 100).toFixed(2)
            }
          }
        ],
        application_context: {
          brand_name: 'RGZV Hagen',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `https://${req.headers.host}/?paypal=success&participant=${participant.id}`,
          cancel_url: `https://${req.headers.host}/?paypal=cancel`
        }
      })
    })

    if (!orderResponse.ok) {
      return res.status(502).json({ error: 'PayPal-Bestellung konnte nicht erstellt werden.' })
    }

    const order = await orderResponse.json()
    if (!order.id) {
      return res.status(502).json({ error: 'PayPal-Bestellung konnte nicht erstellt werden.' })
    }

    const { data: linkedParticipant, error: linkError } = await supabase
      .from('participants')
      .update({ paypal_order_id: String(order.id) })
      .eq('id', participant.id)
      .eq('club_id', participant.club_id)
      .eq('payment_status', 'offen')
      .is('payment_method', null)
      .is('payment_id', null)
      .select('id')
      .maybeSingle()

    if (linkError) throw linkError
    if (!linkedParticipant) {
      return res.status(409).json({ error: 'Die PayPal-Bestellung konnte nicht sicher zugeordnet werden.' })
    }

    const approveUrl = order.links?.find(link => link.rel === 'approve')?.href
    if (!approveUrl) {
      return res.status(502).json({ error: 'PayPal-Freigabelink fehlt.' })
    }

    return res.status(200).json({ url: approveUrl })
  } catch {
    return res.status(500).json({ error: 'PayPal-Zahlung konnte nicht verarbeitet werden.' })
  }
}
