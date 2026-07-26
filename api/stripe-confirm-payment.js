import Stripe from 'stripe'
import { createAdminSupabase } from './_supabase-admin.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { participantId: browserParticipantId, sessionId } = req.body || {}
    if (!sessionId) return res.status(400).json({ error: 'Zahlungsdaten fehlen.' })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') {
      return res.status(409).json({ error: 'Die Zahlung ist noch nicht endgültig bestätigt.' })
    }

    const participantId = session.metadata?.participantId
    const metadataClubId = session.metadata?.clubId
    const metadataAmount = Number(session.metadata?.expectedAmountCents)
    if (!participantId || !metadataClubId || !Number.isSafeInteger(metadataAmount)) {
      return res.status(400).json({ error: 'Die Stripe-Zuordnung ist unvollständig.' })
    }

    if (browserParticipantId && String(browserParticipantId) !== String(participantId)) {
      return res.status(400).json({ error: 'Die Zahlung gehört nicht zu diesem Teilnehmer.' })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, email, payment_amount, payment_status, payment_method, payment_id')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    const expectedAmount = getAmountInCents(participant.payment_amount)
    if (
      expectedAmount === null ||
      expectedAmount !== metadataAmount ||
      session.amount_total !== expectedAmount
    ) {
      return res.status(409).json({ error: 'Der bezahlte Betrag stimmt nicht mit dem Sollbetrag überein.' })
    }

    if (String(session.currency || '').toLowerCase() !== 'eur') {
      return res.status(409).json({ error: 'Die Zahlungswährung ist ungültig.' })
    }

    if (String(participant.club_id) !== String(metadataClubId)) {
      return res.status(409).json({ error: 'Die Vereinszuordnung der Zahlung ist ungültig.' })
    }

    const paymentId = String(session.payment_intent || session.id)
    if (
      participant.payment_status === 'bezahlt' &&
      participant.payment_method === 'stripe' &&
      String(participant.payment_id) === paymentId
    ) {
      return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
    }

    if (participant.payment_status === 'bezahlt') {
      return res.status(409).json({ error: 'Für diesen Teilnehmer wurde bereits eine Zahlung verbucht.' })
    }

    if (participant.payment_id && String(participant.payment_id) !== paymentId) {
      return res.status(409).json({ error: 'Es ist bereits eine andere Zahlungsreferenz hinterlegt.' })
    }

    const { data: reusedPayment, error: reusedPaymentError } = await supabase
      .from('participants')
      .select('id')
      .eq('payment_id', paymentId)
      .neq('id', participant.id)
      .limit(1)
      .maybeSingle()

    if (reusedPaymentError) throw reusedPaymentError
    if (reusedPayment) {
      return res.status(409).json({ error: 'Diese Stripe-Zahlung wurde bereits verwendet.' })
    }

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
        return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
      }
      return res.status(409).json({ error: 'Die Zahlung konnte nicht eindeutig verbucht werden.' })
    }

    const emailResponse = participant.email
      ? await fetch(`https://${req.headers.host}/api/send-payment-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: participant.id })
        })
      : null

    return res.status(200).json({ success: true, emailSent: Boolean(emailResponse?.ok) })
  } catch {
    return res.status(500).json({ error: 'Stripe-Zahlung konnte nicht bestätigt werden.' })
  }
}
