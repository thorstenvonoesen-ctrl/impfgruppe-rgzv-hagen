import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const action = req.body?.action
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    const supabase = createAdminSupabase()
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Ungültige Anmeldung.' })
    if (action === 'list-admin-memberships') {
      const { data: requesterMemberships, error: requesterError } = await supabase
        .from('club_admin_memberships')
        .select('role')
        .eq('user_id', userResult.user.id)
        .eq('active', true)
      if (requesterError) throw requesterError
      if (!(requesterMemberships || []).some(membership => membership.role === 'superadmin')) {
        return res.status(403).json({ error: 'Keine Berechtigung für die Adminverwaltung.' })
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('club_admin_memberships')
        .select('user_id, role, active, created_at, clubs(name)')
        .order('created_at', { ascending: true })
      if (membershipsError) throw membershipsError

      const users = []
      for (let page = 1; ; page += 1) {
        const { data: pageData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (usersError) throw usersError
        users.push(...(pageData?.users || []))
        if ((pageData?.users || []).length < 1000) break
      }
      const emailByUserId = new Map(users.map(user => [user.id, user.email || '']))
      return res.status(200).json({
        administrators: (memberships || []).map(membership => ({
          email: emailByUserId.get(membership.user_id) || '',
          club: membership.clubs?.name || '',
          role: membership.role,
          active: Boolean(membership.active),
          createdAt: membership.created_at
        }))
      })
    }
    const { participantId, paid } = req.body || {}
    if (!participantId || typeof paid !== 'boolean') return res.status(400).json({ error: 'Ungültige Zahlungsanfrage.' })
    const { data: participant, error: participantError } = await supabase.from('participants').select('club_id, email, firstname, lastname').eq('id', participantId).single()
    if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    const { data: memberships } = await supabase.from('club_admin_memberships').select('club_id, role').eq('user_id', userResult.user.id).eq('active', true)
    if (!(memberships || []).some(member => member.role === 'superadmin' || member.club_id === participant.club_id)) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
    const { error: updateError } = await supabase.from('participants').update({ payment_status: paid ? 'bezahlt' : 'offen', payment_date: paid ? new Date().toISOString() : null }).eq('id', participantId)
    if (updateError) throw updateError
    if (paid && participant.email) await fetch(`https://${req.headers.host}/api/send-payment-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId }) })
    return res.status(200).json({ success: true })
  } catch (error) {
    if (action === 'list-admin-memberships') {
      return res.status(500).json({ error: 'Die Administratoren konnten nicht geladen werden.' })
    }
    return res.status(500).json({ error: 'Zahlungsstatus konnte nicht gespeichert werden.' })
  }
}
