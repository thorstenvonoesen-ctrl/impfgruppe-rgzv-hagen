import { createHmac, timingSafeEqual } from 'node:crypto'

export const activeStatuses = ['completed', 'bar_registered']
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c])
export const normalizeEmail = value => String(value || '').trim().toLowerCase()
export const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
export const isTestAppointment = a => a?.is_test === true || Object.values(a || {}).some(v => typeof v === 'string' && /test/i.test(v))
export const appointmentTime = a => String(a?.time || a?.title || '').match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || ''
export const appointmentAddress = a => [a?.venue_name, [a?.street, a?.house_number].filter(Boolean).join(' '), [a?.postal_code, a?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
export const formatDate = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date.split('-').reverse().join('.') : 'Nicht angegeben'
export const money = value => Number(value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

export function berlinInstant(date, time = '00:00') {
  const naive = Date.parse(`${date}T${time.padStart(5, '0')}:00Z`)
  if (!Number.isFinite(naive)) return NaN
  let result = naive
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(result).map(p => [p.type, p.value]))
    const local = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`)
    result += naive - local
  }
  return result
}

export function canEditRegistration(a, p = {}, now = Date.now()) {
  if (!a || a.archived || a.registration_closed || a.closed || p.checked_in || (p.registration_status && !activeStatuses.includes(p.registration_status))) return false
  const event = berlinInstant(a.date, appointmentTime(a) || '00:00')
  const deadline = a.registration_closes_at || a.registration_deadline
  const end = deadline ? (/^\d{4}-\d{2}-\d{2}$/.test(deadline) ? berlinInstant(deadline, '23:59') : Date.parse(deadline)) : event
  return Number.isFinite(event) && Number.isFinite(end) && now < Math.min(event, end)
}

export function reminderDue(a, kind, now = Date.now()) {
  if (a.archived || isTestAppointment(a) || !appointmentTime(a)) return false
  const event = berlinInstant(a.date, appointmentTime(a))
  const priorWeek = new Date(`${a.date}T12:00:00Z`)
  priorWeek.setUTCDate(priorWeek.getUTCDate() - 7)
  const due = kind === 'reminder-7d' ? berlinInstant(priorWeek.toISOString().slice(0,10), appointmentTime(a)) : event - 24 * 3600000
  // A delayed job may catch up on the same day, never send a week-old reminder.
  return now >= due && now < Math.min(due + 6 * 3600000, event)
}

function secret() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Serverkonfiguration fehlt.')
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}
export const managementToken = id => `${id}.${createHmac('sha256', secret()).update(`participant-management-v1:${id}`).digest('base64url')}`
export function verifyManagementToken(token) {
  const id = String(token || '').split('.')[0]
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const expected = Buffer.from(managementToken(id))
  const actual = Buffer.from(String(token))
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null
}
export function publicBaseUrl() {
  const raw = process.env.APP_URL || process.env.PUBLIC_APP_URL || process.env.SITE_URL || process.env.VITE_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  if (!raw) throw new Error('Öffentliche App-Adresse fehlt (APP_URL oder VERCEL_PROJECT_PRODUCTION_URL).')
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Ungültige App-Adresse.')
  return url.origin
}
export const managementUrl = id => `${publicBaseUrl()}/#manage=${managementToken(id)}`

export function previousRecipients(participants, appointments, target) {
  const eligible = new Set(appointments.filter(a => a.club_id === target.club_id && a.date < target.date && !isTestAppointment(a)).map(a => a.id))
  const recipients = new Map()
  for (const p of participants) {
    const email = normalizeEmail(p.email)
    if (!p.checked_in || !activeStatuses.includes(p.registration_status) || !eligible.has(p.vaccination_date_id) || !validEmail(email)) continue
    const old = recipients.get(email)
    const name = `${p.firstname || ''} ${p.lastname || ''}`.trim()
    recipients.set(email, { email, firstname: old && old.name !== name ? '' : p.firstname, lastname: old && old.name !== name ? '' : p.lastname, name: old && old.name !== name ? '' : name })
  }
  return [...recipients.values()]
}
