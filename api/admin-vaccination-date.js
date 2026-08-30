import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

function isMissingArchiveColumn(error) {
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return detail.includes('archived') && (detail.includes('column') || detail.includes('schema cache') || detail.includes('42703'))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { vaccinationDateId, clubId, archived } = req.body || {}
    if (!vaccinationDateId || !clubId || typeof archived !== 'boolean') {
      return res.status(400).json({ error: 'Ungültige Archivanfrage.' })
    }

    const supabase = createAdminSupabase()
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })

    const { data: memberships, error: membershipError } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role')
      .eq('user_id', userResult.user.id)
      .eq('active', true)
    if (membershipError) throw membershipError
    const authorized = (memberships || []).some(membership =>
      membership.role === 'superadmin' ||
      (membership.role === 'clubadmin' && String(membership.club_id) === String(clubId))
    )
    if (!authorized) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })

    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates')
      .select('id, club_id, archived')
      .eq('id', vaccinationDateId)
      .eq('club_id', clubId)
      .maybeSingle()
    if (appointmentError) {
      if (isMissingArchiveColumn(appointmentError)) {
        return res.status(503).json({ error: 'Die Archivfunktion ist in der Datenbank noch nicht eingerichtet.' })
      }
      throw appointmentError
    }
    if (!appointment) return res.status(404).json({ error: 'Impftermin nicht gefunden.' })
    if (appointment.archived === archived) {
      return res.status(200).json({ success: true, archived, unchanged: true })
    }

    const { data: updated, error: updateError } = await supabase
      .from('vaccination_dates')
      .update({ archived })
      .eq('id', appointment.id)
      .eq('club_id', appointment.club_id)
      .eq('archived', appointment.archived)
      .select('id, archived')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return res.status(409).json({ error: 'Der Archivstatus wurde zwischenzeitlich geändert. Bitte neu laden.' })

    return res.status(200).json({ success: true, archived: updated.archived })
  } catch (error) {
    console.error('Archivstatus konnte nicht gespeichert werden:', error)
    return res.status(500).json({ error: 'Der Archivstatus konnte nicht gespeichert werden.' })
  }
}
