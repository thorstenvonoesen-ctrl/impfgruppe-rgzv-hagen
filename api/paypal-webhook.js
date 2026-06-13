import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const event = req.body

    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return res.status(200).json({ ignored: true })
    }

    const orderId =
      event.resource?.supplementary_data?.related_ids?.order_id

    if (!orderId) {
      return res.status(200).json({ ignored: true })
    }

    const { data: participant } = await supabase
  .from('participants')
  .select('*')
  .eq('paypal_order_id', orderId)
  .single()

await supabase
  .from('participants')
  .update({ payment_status: 'bezahlt' })
  .eq('paypal_order_id', orderId)

if (participant?.email) {
  await fetch(`https://${req.headers.host}/api/send-payment-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: participant.email,
      firstname: participant.firstname,
      lastname: participant.lastname
    })
  })
}

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({
      error: error.message
    })
  }
}
