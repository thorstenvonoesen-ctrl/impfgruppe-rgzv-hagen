import { createClient } from '@supabase/supabase-js'
import { createAdminSupabase, getBearerToken } from '../server/_supabase-admin.js'

function isMissingArchiveColumn(error) {
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return detail.includes('archived') && (detail.includes('column') || detail.includes('schema cache') || detail.includes('42703'))
}

function createAuthenticatedSupabase(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase authenticated client configuration is incomplete.')
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  })
}

function logArchiveFailure(code, error) {
  console.error('[admin-vaccination-date]', {
    code,
    databaseCode: error?.code || null,
    message: error?.message || String(error)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createAdminSupabase()
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      logArchiveFailure('AUTH_MISSING', new Error('Authorization bearer token is missing.'))
      return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    }
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) {
      logArchiveFailure('AUTH_INVALID', userError || new Error('Authenticated user is missing.'))
      return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    }

    const { vaccinationDateId, clubId, archived } = req.body || {}
    if (!vaccinationDateId || !clubId || typeof archived !== 'boolean') {
      logArchiveFailure('INVALID_REQUEST', new Error('Required archive request fields are invalid.'))
      return res.status(400).json({ error: 'Ungültige Archivanfrage.' })
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role')
      .eq('user_id', userResult.user.id)
      .eq('active', true)
    if (membershipError) {
      logArchiveFailure('ADMIN_MEMBERSHIP_QUERY_FAILED', membershipError)
      return res.status(500).json({ error: 'Die Administratorberechtigung konnte nicht geprüft werden.' })
    }
    const authorized = (memberships || []).some(membership =>
      membership.role === 'superadmin' ||
      (membership.role === 'clubadmin' && String(membership.club_id) === String(clubId))
    )
    if (!authorized) {
      logArchiveFailure('ADMIN_MEMBERSHIP_NOT_FOUND', new Error('No matching active administrator membership.'))
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates')
      .select('id, club_id, archived')
      .eq('id', vaccinationDateId)
      .eq('club_id', clubId)
      .maybeSingle()
    if (appointmentError) {
      if (isMissingArchiveColumn(appointmentError)) {
        logArchiveFailure('ARCHIVE_COLUMN_MISSING', appointmentError)
        return res.status(503).json({ error: 'Die Archivfunktion ist in der Datenbank noch nicht eingerichtet.' })
      }
      logArchiveFailure('DATE_QUERY_FAILED', appointmentError)
      return res.status(500).json({ error: 'Der Impftermin konnte nicht geprüft werden.' })
    }
    if (!appointment) {
      logArchiveFailure('DATE_NOT_FOUND', new Error('Vaccination date does not match the requested club.'))
      return res.status(404).json({ error: 'Impftermin nicht gefunden.' })
    }
    if (appointment.archived === archived) {
      return res.status(200).json({ success: true, archived, unchanged: true })
    }

    // Perform the mutation as the authenticated administrator. This preserves
    // the verified user identity for RLS and the archive-protection trigger.
    const authenticatedSupabase = createAuthenticatedSupabase(accessToken)
    const { data: updated, error: updateError } = await authenticatedSupabase
      .from('vaccination_dates')
      .update({ archived })
      .eq('id', appointment.id)
      .eq('club_id', appointment.club_id)
      .eq('archived', appointment.archived)
      .select('id, archived')
      .maybeSingle()
    if (updateError) {
      logArchiveFailure('ARCHIVE_UPDATE_FAILED', updateError)
      return res.status(500).json({ error: 'Der Archivstatus konnte nicht gespeichert werden.' })
    }
    if (!updated) {
      logArchiveFailure('ARCHIVE_CONFLICT', new Error('Archive status changed concurrently.'))
      return res.status(409).json({ error: 'Der Archivstatus wurde zwischenzeitlich geändert. Bitte neu laden.' })
    }

    return res.status(200).json({ success: true, archived: updated.archived })
  } catch (error) {
    logArchiveFailure('ARCHIVE_REQUEST_FAILED', error)
    return res.status(500).json({ error: 'Der Archivstatus konnte nicht gespeichert werden.' })
  }
}
