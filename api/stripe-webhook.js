import Stripe from 'stripe'
import { createAdminSupabase } from './_supabase-admin.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = {
  api: {
    bodyParser: false
  }
}

async function getRawBody(readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function getAmountInCents(value) {
  const amount = Number(value)
  const cents = Math.round(amount * 100)
  if (
    value === null ||
    value === '' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(amount * 100 - cents) > 0.000001
  ) return null
  return cents
}

async function processSuccessfulSession(session, req) {
  if (session.payment_status !== 'paid') {
    return { processed: false, pending: true }
  }

  const participantId = session.metadata?.participantId
  const metadataClubId = session.metadata?.clubId
  const metadataAmount = Number(session.metadata?.expectedAmountCents)
  if (!participantId || !metadataClubId || !Number.isSafeInteger(metadataAmount)) {
    return { processed: false, rejected: true }
  }

  const supabase = createAdminSupabase()
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, club_id, email, payment_amount, payment_status, payment_method, payment_id')
    .eq('id', participantId)
    .single()

  if (participantError || !participant) {
    return { processed: false, rejected: true }
  }

  const expectedAmount = getAmountInCents(participant.payment_amount)
  if (
    expectedAmount === null ||
    expectedAmount !== metadataAmount ||
    session.amount_total !== expectedAmount ||
    String(session.currency || '').toLowerCase() !== 'eur' ||
    String(participant.club_id) !== String(metadataClubId)
  ) {
    return { processed: false, rejected: true }
  }

  const paymentId = String(session.payment_intent || session.id)
  if (
    participant.payment_status === 'bezahlt' &&
    participant.payment_method === 'stripe' &&
    String(participant.payment_id) === paymentId
  ) {
    return { processed: false, alreadyProcessed: true }
  }

  if (
    participant.payment_status === 'bezahlt' ||
    (participant.payment_id && String(participant.payment_id) !== paymentId)
  ) {
    return { processed: false, rejected: true }
  }

  const { data: reusedPayment, error: reusedPaymentError } = await supabase
    .from('participants')
    .select('id')
    .eq('payment_id', paymentId)
    .neq('id', participant.id)
    .limit(1)
    .maybeSingle()

  if (reusedPaymentError) throw reusedPaymentError
  if (reusedPayment) return { processed: false, rejected: true }

  let updateQuery = supabase
    .from('participants')
    .update({
      payment_status: 'bezahlt',
      payment_method: 'stripe',
      payment_date: new Date().toISOString(),
      payment_id: paymentId
    })
    .eq('id', participant.id)
    .eq('club_id', participant.club_id)
    .eq('payment_status', 'offen')

  if (!participant.payment_id) updateQuery = updateQuery.is('payment_id', null)

  const { data: updatedParticipant, error: updateError } = await updateQuery
    .select('id')
    .maybeSingle()

  if (updateError) throw updateError
  if (!updatedParticipant) {
    const { data: currentParticipant } = await supabase
      .from('participants')
      .select('payment_status, payment_method, payment_id')
      .eq('id', participant.id)
      .single()

    if (
      currentParticipant?.payment_status === 'bezahlt' &&
      currentParticipant?.payment_method === 'stripe' &&
      String(currentParticipant?.payment_id) === paymentId
    ) {
      return { processed: false, alreadyProcessed: true }
    }
    return { processed: false, rejected: true }
  }

  let emailSent = false
  if (participant.email) {
    const emailResponse = await fetch(`https://${req.headers.host}/api/send-payment-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: participant.id })
    })
    emailSent = emailResponse.ok
  }

  return { processed: true, emailSent }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']
  let event

  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch {
    return res.status(400).send('Webhook signature verification failed.')
  }

  try {
    if (event.type === 'checkout.session.async_payment_failed') {
      return res.status(200).json({ received: true, processed: false })
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const result = await processSuccessfulSession(event.data.object, req)
      return res.status(200).json({ received: true, ...result })
    }

    return res.status(200).json({ received: true, processed: false })
  } catch {
    return res.status(500).json({ received: false, error: 'Webhook-Verarbeitung fehlgeschlagen.' })
  }
}
