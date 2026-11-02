export const emptyMember = () => ({ firstname: '', lastname: '', email: '', member_number: '', is_active: true, notes: '' })

export function cleanMember(value) {
  const result = Object.fromEntries(['firstname', 'lastname', 'email', 'member_number', 'notes'].map(key => [key, String(value[key] ?? '').trim()]))
  result.email = result.email.toLowerCase()
  if (!result.firstname || !result.lastname) throw new Error('Vorname und Nachname sind erforderlich.')
  if (result.firstname.length > 100 || result.lastname.length > 100) throw new Error('Vorname und Nachname dürfen jeweils höchstens 100 Zeichen enthalten.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || result.email.length > 254) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.')
  if (result.member_number.length > 64 || result.notes.length > 2000) throw new Error('Mitgliedsnummer: maximal 64 Zeichen; Bemerkungen: maximal 2000 Zeichen.')
  if (typeof value.is_active !== 'boolean') throw new Error('Der Mitgliedschaftsstatus muss aktiv oder inaktiv sein.')
  result.is_active = value.is_active
  result.member_number ||= null
  result.notes ||= null
  return result
}

const headerKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
const headers = {
  vorname: 'firstname', firstname: 'firstname', nachname: 'lastname', lastname: 'lastname',
  email: 'email', emailadresse: 'email', mitgliedsnummer: 'member_number', membernumber: 'member_number',
  aktiv: 'is_active', active: 'is_active', isactive: 'is_active', status: 'is_active', mitgliedschaft: 'is_active',
  bemerkungen: 'notes', bemerkung: 'notes', notes: 'notes'
}

// RFC-style quoted CSV, including escaped quotes, separators and multiline notes.
export function parseMemberCsv(input) {
  if (input.length > 1024 * 1024) throw new Error('Die CSV-Datei darf höchstens 1 MB groß sein.')
  const text = input.replace(/^\uFEFF/, '').replace(/^sep=([;,\t])\r?\n/i, '')
  const first = text.split(/\r?\n/, 1)[0]
  const delimiter = (input.match(/^\uFEFF?sep=([;,\t])/i)?.[1]) || (first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',')
  const records = []
  let row = [], field = '', quoted = false, closed = false
  const pushField = () => { row.push(field); field = ''; closed = false }
  const pushRow = () => { pushField(); if (row.some(v => v.trim())) records.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } }
      else field += c
    } else if (c === delimiter) pushField()
    else if (c === '\r' || c === '\n') { pushRow(); if (c === '\r' && text[i + 1] === '\n') i++ }
    else if (c === '"' && !field && !closed) quoted = true
    else if (closed && !/\s/.test(c)) throw new Error('Ungültige CSV: Zeichen hinter einem schließenden Anführungszeichen.')
    else if (!closed) { if (c === '"') throw new Error('Ungültige CSV-Anführungszeichen.'); field += c }
  }
  if (quoted) throw new Error('Ungültige CSV: Ein Anführungszeichen wurde nicht geschlossen.')
  if (field || row.length || closed) pushRow()
  if (records.length < 2) throw new Error('Die CSV benötigt eine Kopfzeile und mindestens ein Mitglied.')
  if (records.length > 501) throw new Error('Pro Import sind höchstens 500 Mitglieder erlaubt.')
  const columns = records.shift().map(h => headers[headerKey(h)])
  for (const key of ['firstname', 'lastname', 'email']) if (!columns.includes(key)) throw new Error('CSV-Kopfzeile benötigt Vorname, Nachname und E-Mail.')
  if (columns.filter(Boolean).length !== new Set(columns.filter(Boolean)).size) throw new Error('Eine CSV-Spalte ist mehrfach vorhanden.')
  const rows = [], errors = [], emails = new Set(), numbers = new Set()
  let duplicates = 0
  records.forEach((record, index) => {
    try {
      if (record.length !== columns.length) throw new Error('Die Anzahl der Spalten passt nicht zur Kopfzeile.')
      const value = emptyMember()
      columns.forEach((key, i) => { if (key) value[key] = record[i] })
      const status = String(value.is_active).trim().toLowerCase()
      if (!['true','false','aktiv','inaktiv','active','inactive','ja','nein','1','0',''].includes(status)) throw new Error('Status muss aktiv oder inaktiv sein.')
      value.is_active = !['false','inaktiv','inactive','nein','0'].includes(status)
      const member = cleanMember(value)
      const number = member.member_number?.toLowerCase()
      if (emails.has(member.email) || (number && numbers.has(number))) { duplicates++; return }
      emails.add(member.email); if (number) numbers.add(number)
      rows.push(member)
    } catch (error) { errors.push(`Datensatz ${index + 2}: ${error.message}`) }
  })
  return { rows, errors, duplicates, total: records.length }
}

export function memberError(error) {
  if (['42P01','42703','PGRST204','PGRST205','42883','PGRST202'].includes(error?.code)) return 'Die Mitgliederverwaltung ist in Supabase noch nicht vollständig eingerichtet. Bitte die Migration 20261104_add_club_members.sql ausführen.'
  if (error?.code === '23505') return 'Diese E-Mail-Adresse oder Mitgliedsnummer ist im Verein bereits vorhanden. Bitte den bestehenden Eintrag bearbeiten oder reaktivieren.'
  if (error?.code === '42501') return 'Keine Berechtigung für die Mitgliederverwaltung dieses Vereins. Bitte die aktive Administratorzuordnung prüfen.'
  if (error?.code === 'PGRST116') return 'Der Eintrag wurde inzwischen geändert oder ist nicht mehr zugänglich. Bitte die Liste aktualisieren.'
  if (['23514','23502','22023'].includes(error?.code)) return 'Die Mitgliedsdaten sind unvollständig oder ungültig. Bitte Eingaben und CSV-Datei prüfen.'
  return 'Die Mitgliedsdaten konnten nicht verarbeitet werden. Bitte Verbindung und Anmeldung prüfen.'
}

export function memberService(db) {
  return {
    async list(clubId, search = '', page = 0) {
      let query = db.from('club_members').select('*', { count: 'exact' }).eq('club_id', clubId)
      if (search.trim()) query = query.ilike('search_text', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
      const { data, error, count } = await query.order('lastname').order('firstname').order('id').range(page * 50, page * 50 + 49)
      if (error) throw new Error(memberError(error))
      return { rows: data || [], count: count || 0 }
    },
    async save(clubId, value) {
      const payload = cleanMember(value)
      let query = db.from('club_members')
      query = value.id ? query.update(payload).eq('club_id', clubId).eq('id', value.id).eq('updated_at', value.updated_at) : query.insert({ ...payload, club_id: clubId })
      const { data, error } = await query.select('*').single()
      if (error || !data) throw new Error(memberError(error || { code: 'PGRST116' }))
      return data
    },
    async remove(clubId, member) {
      const { data, error } = await db.from('club_members').delete()
        .eq('club_id', clubId).eq('id', member.id).eq('updated_at', member.updated_at)
        .select('id').single()
      if (error || !data) throw new Error(memberError(error || { code: 'PGRST116' }))
      return data
    },
    async import(clubId, rows) {
      const { data, error } = await db.rpc('import_club_members', { target_club: clubId, members: rows.map(cleanMember) })
      if (error) throw new Error(memberError(error))
      return data
    }
  }
}
