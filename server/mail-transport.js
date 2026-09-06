import nodemailer from 'nodemailer'

export const mailFrom = () => `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`
export const clubMailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
})
