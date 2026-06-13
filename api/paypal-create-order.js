export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { participantId } = req.body || {}

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
      return res.status(500).json({
        step: 'token',
        status: tokenRes.status,
        paypal: tokenData
      })
    }

    const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: participantId || 'rgzv-hagen',
            description: 'Impfgruppe RGZV Hagen',
            amount: {
              currency_code: 'EUR',
              value: '10.00'
            }
          }
        ],
        application_context: {
          brand_name: 'RGZV Hagen',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `https://${req.headers.host}/?paypal=success`,
cancel_url: `https://${req.headers.host}/?paypal=cancel`
        }
      })
    })

    const order = await orderRes.json()

    if (!orderRes.ok) {
      return res.status(500).json({
        step: 'order',
        status: orderRes.status,
        paypal: order
      })
    }

    const approveUrl = order.links?.find(link => link.rel === 'approve')?.href

    return res.status(200).json({
      url: approveUrl || null,
      order
    })
  } catch (error) {
    return res.status(500).json({
      step: 'catch',
      error: error.message
    })
  }
}
