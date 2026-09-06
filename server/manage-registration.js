import { createAdminSupabase } from './_supabase-admin.js'
import { canEditRegistration, normalizeEmail, validEmail, verifyManagementToken } from './mail-rules.js'
import { drainMail } from './mail-delivery.js'

export const contactFields = ['firstname', 'lastname', 'street', 'housenumber', 'zipcode', 'city', 'email', 'phone', 'tsk_number']
export function cleanManagementChanges(input) {
  const changes = Object.fromEntries(contactFields.map(key => [key, String(input?.[key] || '').trim().slice(0, 254)]))
  changes.email = normalizeEmail(changes.email)
  if (!changes.firstname || !changes.lastname || !changes.tsk_number || !validEmail(changes.email)) throw new Error('Bitte Name, gültige E-Mail und TSK-Betriebsnummer angeben.')
  const counts = [['chicken_count','Hühner'],['bantam_count','Zwerghühner'],['turkey_count','Puten']]
  for (const [key] of counts) {
    changes[key] = Number(input[key] || 0)
    if (!Number.isInteger(changes[key]) || changes[key] < 0 || changes[key] > 1000000) throw new Error('Ungültige Tierzahl.')
  }
  changes.animal_count = counts.reduce((sum,[key]) => sum + changes[key], 0)
  changes.animal_type = counts.filter(([key]) => changes[key] > 0).map(([,label]) => label).join(', ')
  if (!changes.animal_count) throw new Error('Mindestens ein Tier angeben.')
  return changes
}

export default async function manageRegistration(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const id = verifyManagementToken(req.body?.token)
  if (!id) return res.status(403).json({ error: 'Dieser Verwaltungslink ist ungültig.' })
  const db = createAdminSupabase()
  const { data: p, error } = await db.from('participants').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!p) return res.status(404).json({ error: 'Anmeldung nicht gefunden.' })
  const { data: a, error: dateError } = await db.from('vaccination_dates').select('*').eq('id', p.vaccination_date_id).single()
  if (dateError) throw dateError
  let saved = p
  let emailSent
  if (req.body.operation !== 'view') {
    if (!canEditRegistration(a, p)) return res.status(409).json({ error: 'Die Anmeldung kann nicht mehr geändert oder storniert werden.' })
    if (!['update', 'cancel'].includes(req.body.operation)) return res.status(400).json({ error: 'Ungültige Aktion.' })
    let changes
    try { changes = req.body.operation === 'update' ? cleanManagementChanges(req.body.changes) : {} } catch (e) { return res.status(400).json({ error: e.message }) }
    const result = await db.rpc('manage_registration', { target_id: id, expected_revision: req.body.revision, operation: req.body.operation, changes })
    if (result.error) return res.status(409).json({ error: 'Speichern nicht möglich. Anmeldeschluss oder zwischenzeitliche Änderung: Bitte neu laden.' })
    saved = result.data
    try { emailSent = (await drainMail({ participantId: id, limit: 3, db })).sent > 0 } catch { emailSent = false }
  }
  const visible = [...contactFields, 'animal_type','animal_count','chicken_count','bantam_count','turkey_count','vaccine','payment_status','payment_amount','registration_status','mail_revision']
  return res.status(200).json({ participant: Object.fromEntries(visible.map(key => [key,saved[key]])), appointment: { title: a.title, date: a.date, time: a.time, venue_name: a.venue_name, street: a.street, house_number: a.house_number, postal_code: a.postal_code, city: a.city }, editable: canEditRegistration(a, saved), emailSent })
}
