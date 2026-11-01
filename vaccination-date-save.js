const textFields = ['title', 'note', 'venue_name', 'street', 'house_number', 'postal_code', 'city']

export function vaccinationDatePayload(value) {
  if (!value?.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(value.date || '') ||
      !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date) {
    throw new Error('Bitte einen Titel und ein gültiges Datum eingeben.')
  }
  const payload = Object.fromEntries(textFields.map(field => [field, String(value[field] || '').trim()]))
  payload.date = value.date
  payload.time = value.time || null
  if (payload.time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(payload.time)) throw new Error('Bitte eine gültige Uhrzeit eingeben.')
  const deadline = value.registration_closes_at
  if (deadline && !Number.isFinite(Date.parse(deadline))) throw new Error('Bitte einen gültigen Anmeldeschluss eingeben.')
  payload.registration_closes_at = deadline ? new Date(deadline).toISOString() : null
  payload.registration_closed = value.registration_closed === true
  payload.address_public = value.address_public === true
  return payload
}

// Never expose raw database messages: they can contain row values and SQL details.
export function vaccinationDateError(error) {
  const code = error?.code
  if (code === 'PGRST204' || code === '42703') return 'Die Datenbank ist nicht auf dem aktuellen Stand. Bitte die Migrationen für die Impfterminfelder anwenden und den API-Schemacache aktualisieren.'
  if (code === '42501') return 'Keine Berechtigung zum Speichern für diesen Verein. Bitte die aktive Administratorzuordnung prüfen.'
  if (code === '23502') return 'Ein erforderliches Feld fehlt. Bitte Titel, Datum und Vereinszuordnung prüfen.'
  if (code === '23503') return 'Die Vereinszuordnung ist nicht mehr gültig. Bitte die Seite neu laden.'
  if (code === '22007' || code === '22008' || code === '22P02') return 'Datum, Uhrzeit oder Anmeldeschluss haben ein ungültiges Format.'
  if (code === '55000') return 'Archivierte Impftermine sind schreibgeschützt. Bitte den Termin zuerst wiederherstellen.'
  if (code === 'PGRST116') return 'Der Termin wurde nicht gefunden oder konnte wegen fehlender Berechtigung nicht zurückgelesen werden. Bitte neu laden und die Vereinszuordnung prüfen.'
  if (code === '23514') return 'Die Eingaben verletzen eine Datenbankregel. Bitte die Eingaben prüfen und die Administration verständigen.'
  if (error instanceof TypeError) return 'Die Datenbankverbindung ist fehlgeschlagen. Bitte die Verbindung prüfen und erneut versuchen.'
  return 'Die Datenbankanfrage ist fehlgeschlagen. Bitte die Administration verständigen.'
}

export async function saveVaccinationDate(db, clubId, value) {
  const payload = vaccinationDatePayload(value)
  if (!clubId) throw new Error('Die Vereinszuordnung fehlt. Bitte erneut anmelden.')
  let query = db.from('vaccination_dates')
  query = value.id
    ? query.update(payload).eq('id', value.id).eq('club_id', clubId)
    : query.insert({ ...payload, club_id: clubId })
  try {
    const { data, error } = await query.select('*').single()
    if (error) throw error
    if (!data) throw { code: 'PGRST116' }
    return data
  } catch (error) {
    throw new Error(vaccinationDateError(error))
  }
}
