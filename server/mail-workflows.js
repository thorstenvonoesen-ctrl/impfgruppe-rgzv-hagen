import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getBearerToken } from './_supabase-admin.js'
import { activeStatuses, canEditRegistration, isTestAppointment, normalizeEmail, previousRecipients, validEmail } from './mail-rules.js'
import { drainMail } from './mail-delivery.js'

export async function allRows(makeQuery) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await makeQuery().range(offset, offset + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
export async function authorizeMailAdmin(req, db, clubId) {
  const token = getBearerToken(req)
  if (!token) return false
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return false
  const roles = await db.from('club_admin_memberships').select('club_id,role').eq('user_id', data.user.id).eq('active', true)
  return !roles.error && roles.data.some(r => r.role === 'superadmin' || (r.role === 'clubadmin' && (!clubId || r.club_id === clubId)))
}
export function isCronRequest(req) {
  if (!process.env.CRON_SECRET) return false
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`)
  const actual = Buffer.from(req.headers.authorization || '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function runReminderCron(db) {
  const { data: queued, error } = await db.rpc('queue_due_reminders')
  if (error) throw error
  return { queued, ...await drainMail({ db }) }
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function previewSignature(fingerprint, expires) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(`${fingerprint}:${expires}`).digest('hex')
}
export function makePreviewToken(fingerprint) {
  const expires = Date.now() + 10 * 60000
  return `${expires}.${previewSignature(fingerprint, expires)}`
}
export function checkPreviewToken(token, fingerprint) {
  const [expires, signature] = String(token || '').split('.')
  if (!signature || !Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false
  const expected = Buffer.from(previewSignature(fingerprint, expires))
  const actual = Buffer.from(signature)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function handleMailCampaign(req, res, db) {
  const { vaccinationDateId, kind, changes = [], previewToken, action } = req.body
  if (!['new-appointment','appointment-change'].includes(kind)) return res.status(400).json({ error: 'Ungültiger Versandtyp.' })
  const result = await db.from('vaccination_dates').select('*').eq('id', vaccinationDateId).maybeSingle()
  if (result.error) throw result.error
  const a = result.data
  if (!a || !await authorizeMailAdmin(req, db, a.club_id)) return res.status(403).json({ error: 'Keine Berechtigung.' })
  if (isTestAppointment(a) || a.archived) return res.status(409).json({ error: 'Für Testtermine und archivierte Termine ist kein Rundversand erlaubt.' })
  if (kind === 'new-appointment' && !canEditRegistration(a)) return res.status(409).json({ error: 'Die Anmeldung zu diesem Termin ist nicht geöffnet.' })
  if (kind === 'appointment-change' && (!changes.length || changes.some(c => !['Datum','Uhrzeit','Treffpunkt'].includes(c)))) return res.status(400).json({ error: 'Bitte die geänderten Angaben auswählen.' })
  const { data: club, error: clubError } = await db.from('clubs').select('slug').eq('id', a.club_id).single()
  if (clubError) throw clubError
  let people
  if (kind === 'new-appointment') {
    const dates = await allRows(() => db.from('vaccination_dates').select('*').eq('club_id', a.club_id).lt('date', a.date).order('id'))
    const past = await allRows(() => db.from('participants').select('firstname,lastname,email,checked_in,registration_status,vaccination_date_id').eq('club_id', a.club_id).eq('checked_in', true).in('registration_status', activeStatuses).order('id'))
    people = previousRecipients(past, dates, a)
  } else {
    people = await allRows(() => db.from('participants').select('*').eq('club_id', a.club_id).eq('vaccination_date_id', a.id).in('registration_status', activeStatuses).order('id'))
    people = [...new Map(people.filter(p => validEmail(normalizeEmail(p.email))).map(p => [normalizeEmail(p.email), p])).values()]
  }
  const details = { title: a.title, date: a.date, time: a.time, venue_name: a.venue_name, street: a.street, house_number: a.house_number, postal_code: a.postal_code, city: a.city }
  const batchKey = kind === 'new-appointment' ? `${kind}:${a.id}` : `${kind}:${a.id}:${digest(details)}`
  const existing = await db.from('mail_batches').select('id,created_at').eq('id', batchKey).maybeSingle()
  if (existing.error) throw existing.error
  const fingerprint = digest({ batchKey, details, changes: [...changes].sort(), recipients: people.map(p => normalizeEmail(p.email)).sort() })
  if (action === 'preview-campaign') return res.status(200).json({ count: people.length, alreadyQueued: Boolean(existing.data), previewToken: makePreviewToken(fingerprint), appointment: details })
  if (!checkPreviewToken(previewToken, fingerprint)) return res.status(409).json({ error: 'Vorschau abgelaufen oder Empfängerliste/Termin geändert. Bitte erneut prüfen.' })
  if (existing.data) return res.status(409).json({ error: 'Dieser Rundversand wurde bereits vorgemerkt. Offene Zustellungen werden automatisch fortgesetzt.' })
  const deliveries = people.map(p => ({ recipient: normalizeEmail(p.email), participant_id: p.id || null, payload: { participant: p, appointment: a, options: { clubSlug: club.slug, changes } } }))
  if (!deliveries.length) return res.status(400).json({ error: 'Keine passenden Empfänger vorhanden.' })
  const queued = await db.rpc('create_mail_batch', { batch_key: batchKey, target_club: a.club_id, target_appointment: a.id, mail_kind: kind, deliveries })
  if (queued.error) throw queued.error
  return res.status(200).json({ queued: queued.data ? deliveries.length : 0, ...await drainMail({ clubId: a.club_id, db }) })
}
