import paypalCreateOrder from '../server/payment/paypal-create-order.js'
import paypalWebhook from '../server/payment/paypal-webhook.js'
import sendPaymentEmail from '../server/payment/send-payment-email.js'
import stripeConfirmPayment from '../server/payment/stripe-confirm-payment.js'
import stripeCreateCheckout from '../server/payment/stripe-create-checkout.js'
import stripeWebhook from '../server/payment/stripe-webhook.js'

const handlers = {
  'paypal-create-order': paypalCreateOrder,
  'paypal-webhook': paypalWebhook,
  'send-payment-email': sendPaymentEmail,
  'stripe-confirm-payment': stripeConfirmPayment,
  'stripe-create-checkout': stripeCreateCheckout,
  'stripe-webhook': stripeWebhook
}

export default async function handler(req, res) {
  const selected = handlers[String(req.query?.handler || '')]
  if (!selected) return res.status(404).json({ error: 'Payment endpoint not found.' })
  return selected(req, res)
}
