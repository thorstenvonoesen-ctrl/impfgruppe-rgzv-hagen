import Stripe from 'stripe'
import { createAdminSupabase } from './_supabase-admin.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { participantId, sessionId } = req.body || {}
    if (!participantId || !sessionId) return res.status(400).json({ error: 'Zahlungsdaten fehlen.' })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid' || session.metadata?.participantId !== participantId) return res.status(400).json({ error: 'Zahlung wurde nicht bestätigt.' })
    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase.from('participants').select('email, firstname, lastname').eq('id', participantId).single()
    if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    const { error: updateError } = await supabase.from('participants').update({ payment_status: 'bezahlt', payment_method: 'stripe', payment_date: new Date().toISOString(), payment_id: String(session.payment_intent || session.id) }).eq('id', participantId)
    if (updateError) throw updateError
    const emailResponse = participant.email ? await fetch(`https://${req.headers.host}/api/send-payment-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(participant) }) : null
    return res.status(200).json({ success: true, emailSent: Boolean(emailResponse?.ok) })
  } catch (error) {
    return res.status(500).json({ error: 'Stripe-Zahlung konnte nicht bestätigt werden.' })
  }
}
