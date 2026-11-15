import { appointmentAddress, appointmentTime, berlinInstant, verifyManagementToken } from './mail-rules.js'

const escape = value => String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
function fold(line) {
  const encoder = new TextEncoder()
  let result = '', length = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (length + size > 75) { result += '\r\n '; length = 1 }
    result += character; length += size
  }
  return result
}

export function buildAppointmentCalendar(appointment, now = Date.now()) {
  const date = String(appointment?.date || '')
  const time = appointmentTime(appointment)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) return null
  const start = berlinInstant(date, time)
  if (!Number.isFinite(start) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) return null
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RGZV Hagen//Impfgruppenmanager//DE',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${encodeURIComponent(appointment.id || `${date}-${time}-${appointment.title}`)}@impfgruppe-rgzv-hagen`,
    `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`,
    `SUMMARY:${escape(appointment.title || 'Newcastle-Impftermin')}`,
    `LOCATION:${escape(appointmentAddress(appointment))}`,
    'DESCRIPTION:Newcastle-Sammelimpfung des RGZV Hagen. Bitte den persönlichen QR-Code mitbringen.',
    'END:VEVENT', 'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n'
}

export async function serveRegistrationCalendar(req, res, db) {
  res.setHeader('Cache-Control', 'no-store')
  const id = verifyManagementToken(req.query?.token)
  if (!id) return res.status(403).json({error:'Dieser Verwaltungslink ist ungültig.'})
  const participant = await db.from('participants').select('vaccination_date_id,club_id,registration_status').eq('id',id).maybeSingle()
  if (participant.error) throw participant.error
  if (!participant.data) return res.status(404).json({error:'Diese Anmeldung ist nicht mehr vorhanden.'})
  if (!['completed','bar_registered'].includes(participant.data.registration_status)) return res.status(409).json({error:'Für diese Anmeldung besteht kein aktiver Termin.'})
  const appointment = await db.from('vaccination_dates').select('*').eq('id',participant.data.vaccination_date_id).eq('club_id',participant.data.club_id).maybeSingle()
  if (appointment.error) throw appointment.error
  const calendar = buildAppointmentCalendar(appointment.data)
  if (!calendar) return res.status(409).json({error:'Die Termindaten für den Kalendereintrag sind noch nicht vollständig.'})
  res.setHeader('Content-Type','text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition','attachment; filename="impftermin.ics"')
  return res.status(200).send(calendar)
}
