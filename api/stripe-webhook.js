import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const sig = req.headers['stripe-signature']

  try {
    const rawBody = await getRawBody(req)

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    console.log('Webhook erhalten:', event.type)

if (event.type === 'checkout.session.completed') {
  const session = event.data.object

  const participantId = session.metadata?.participantId

  console.log('Participant:', participantId)
}

return res.status(200).json({
  received: true,
  event: event.type
})
  } catch (err) {
    console.error(err)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
}
