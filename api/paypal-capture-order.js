export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { token } = req.body || {}

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

    return res.status(200).json({
      success: true,
      capture
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
