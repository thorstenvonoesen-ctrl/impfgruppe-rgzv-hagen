import nodemailer from 'nodemailer'
import { mailError } from './mail-errors.js'

export function smtpOptions(env = process.env) {
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].filter(key => !env[key]?.trim())
  if (missing.length) throw mailError('SMTP_CONFIG', `SMTP-Konfiguration unvollständig. In Vercel fehlen: ${missing.join(', ')}.`)
  const port = Number(env.SMTP_PORT)
  if (![465, 587].includes(port)) throw mailError('SMTP_CONFIG', 'SMTP_PORT muss 465 (SSL/TLS) oder 587 (STARTTLS) sein. Für STRATO-Postfächer Port 465 verwenden.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_USER.trim())) throw mailError('SMTP_CONFIG', 'SMTP_USER muss die vollständige E-Mail-Adresse des Postfachs enthalten.')
  return {
    host: env.SMTP_HOST.trim(), port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASS },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000
  }
}

export const mailFrom = () => `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER?.trim()}>`
// Validate at request time; importing the module never connects to SMTP.
export const clubMailTransporter = {
  sendMail(mail) { return nodemailer.createTransport(smtpOptions()).sendMail(mail) }
}
