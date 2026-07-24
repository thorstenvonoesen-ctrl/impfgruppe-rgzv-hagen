import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    const supabase = createAdminSupabase()
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Ungültige Anmeldung.' })
    const { participantId, paid } = req.body || {}
    if (!participantId || typeof paid !== 'boolean') return res.status(400).json({ error: 'Ungültige Zahlungsanfrage.' })
    const { data: participant, error: participantError } = await supabase.from('participants').select('club_id, email, firstname, lastname').eq('id', participantId).single()
    if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    const { data: memberships } = await supabase.from('club_admin_memberships').select('club_id, role').eq('user_id', userResult.user.id).eq('active', true)
    if (!(memberships || []).some(member => member.role === 'superadmin' || member.club_id === participant.club_id)) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
    const { error: updateError } = await supabase.from('participants').update({ payment_status: paid ? 'bezahlt' : 'offen', payment_date: paid ? new Date().toISOString() : null }).eq('id', participantId)
    if (updateError) throw updateError
    if (paid && participant.email) await fetch(`https://${req.headers.host}/api/send-payment-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(participant) })
    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: 'Zahlungsstatus konnte nicht gespeichert werden.' })
  }
}
