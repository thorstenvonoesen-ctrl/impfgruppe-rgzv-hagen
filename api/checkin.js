import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    const supabase = createAdminSupabase()
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Ungültige Anmeldung.' })

    const { token, vaccinationDateId, checkedIn = true } = req.body || {}
    if (!token || !vaccinationDateId || typeof checkedIn !== 'boolean') {
      return res.status(400).json({ error: 'Ungültige Check-in-Anfrage.' })
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates').select('id, club_id').eq('id', vaccinationDateId).single()
    if (appointmentError || !appointment) return res.status(404).json({ error: 'Impftermin nicht gefunden.' })

    const { data: memberships } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role, active')
      .eq('user_id', userResult.user.id).eq('active', true)
    const permitted = (memberships || []).some(member => member.role === 'superadmin' || member.club_id === appointment.club_id)
    if (!permitted) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })

    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, vaccination_date_id, checked_in')
      .eq('checkin_token', token).single()
    if (participantError || !participant) return res.status(404).json({ error: 'QR-Code nicht gefunden.' })
    if (participant.club_id !== appointment.club_id || participant.vaccination_date_id !== appointment.id) {
      return res.status(403).json({ error: 'QR-Code gehört nicht zu diesem Impftermin.' })
    }

    const { data: updated, error: updateError } = await supabase
      .from('participants')
      .update({ checked_in: checkedIn, checked_in_at: checkedIn ? new Date().toISOString() : null, checked_in_by: checkedIn ? userResult.user.id : null })
      .eq('id', participant.id).select('id, checked_in, checked_in_at').single()
    if (updateError) throw updateError
    return res.status(200).json({ success: true, participant: updated })
  } catch (error) {
    return res.status(500).json({ error: 'Check-in konnte nicht gespeichert werden.' })
  }
}
