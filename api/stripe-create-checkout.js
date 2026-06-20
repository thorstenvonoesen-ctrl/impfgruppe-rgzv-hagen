import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { participantId, amount } = req.body

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'payment',

      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Impfgruppe RGZV Hagen'
            },
            unit_amount: amount * 5
          },
          quantity: 1
        }
      ],

      success_url:
        `https://${req.headers.host}/?stripe=success&participant=${participantId}`,

      cancel_url:
        `https://${req.headers.host}/?stripe=cancel`
    })

    return res.status(200).json({
      url: session.url
    })
  } catch (err) {
    return res.status(500).json({
      error: err.message
    })
  }
}
