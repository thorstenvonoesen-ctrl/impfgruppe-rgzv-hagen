import { createAdminSupabase } from './_supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { token, participantId } = req.body || {}

    if (!token) {
      return res.status(400).json({ error: 'PayPal token fehlt' })
    }

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64')

    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      return res.status(500).json({ step: 'token', paypal: tokenData })
    }

    const captureRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    const capture = await captureRes.json()

    if (!captureRes.ok) {
      return res.status(500).json({ step: 'capture', paypal: capture })
    }

    const supabase = createAdminSupabase()
    const { data: participant, error: participantError } = await supabase
      .from('participants').select('email, firstname, lastname').eq('id', participantId).single()
    if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    const { error: updateError } = await supabase.from('participants').update({
      payment_status: 'bezahlt', payment_method: 'paypal', payment_date: new Date().toISOString(), payment_id: token
    }).eq('id', participantId)
    if (updateError) throw updateError
    const emailResponse = participant.email ? await fetch(`https://${req.headers.host}/api/send-payment-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(participant)
    }) : null
    return res.status(200).json({
      success: true,
      capture,
      emailSent: Boolean(emailResponse?.ok)
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
