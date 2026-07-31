import Stripe from 'stripe'
import { createAdminSupabase, createPaymentReturnToken } from './_supabase-admin.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { participantId } = req.body || {}
    if (!participantId) {
      return res.status(400).json({ error: 'Teilnehmer-ID fehlt.' })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, payment_amount, payment_status, payment_method, payment_id, registration_status, club_id')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    if (
      participant.payment_status !== 'offen' ||
      participant.payment_method !== null ||
      participant.payment_id !== null ||
      participant.registration_status !== 'pending_payment'
    ) {
      return res.status(409).json({ error: 'Die Zahlung wurde bereits verbucht.' })
    }

    const paymentAmount = Number(participant.payment_amount)
    const amountInCents = Math.round(paymentAmount * 100)
    if (
      participant.payment_amount === null ||
      participant.payment_amount === '' ||
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0 ||
      !Number.isSafeInteger(amountInCents) ||
      Math.abs(paymentAmount * 100 - amountInCents) > 0.000001
    ) {
      return res.status(422).json({ error: 'Für diesen Teilnehmer ist kein gültiger Zahlungsbetrag hinterlegt.' })
    }

    if (!participant.club_id) {
      return res.status(422).json({ error: 'Der Teilnehmer ist keinem Verein zugeordnet.' })
    }

    const cancelToken = createPaymentReturnToken(participant.id, 'stripe')
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'payment',
      metadata: {
        participantId: String(participant.id),
        clubId: String(participant.club_id),
        expectedAmountCents: String(amountInCents)
      },
      client_reference_id: String(participant.id),
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Impfgruppe RGZV Hagen'
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      success_url:
        `https://${req.headers.host}/?stripe=success&participant=${participantId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `https://${req.headers.host}/?stripe=cancel&cancel_token=${encodeURIComponent(cancelToken)}`
    }, { idempotencyKey: `registration-checkout-${participant.id}` })

    return res.status(200).json({ url: session.url })
  } catch {
    return res.status(500).json({ error: 'Stripe-Checkout konnte nicht erstellt werden.' })
  }
}
