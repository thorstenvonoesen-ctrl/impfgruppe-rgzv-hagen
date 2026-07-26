import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

function getAdminInviteRedirectUrl() {
  const configuredUrl =
    process.env.APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL
  if (!configuredUrl) return null
  const baseUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`
  return new URL('/admin-invite', baseUrl).toString()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const action = req.body?.action
  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })
    const supabase = createAdminSupabase()
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Ungültige Anmeldung.' })
    if (
      action === 'list-admin-memberships' ||
      action === 'get-admin-membership-detail' ||
      action === 'invite-administrator' ||
      action === 'set-admin-membership-active'
    ) {
      const { data: requesterMemberships, error: requesterError } = await supabase
        .from('club_admin_memberships')
        .select('role')
        .eq('user_id', userResult.user.id)
        .eq('active', true)
      if (requesterError) throw requesterError
      if (!(requesterMemberships || []).some(membership => membership.role === 'superadmin')) {
        return res.status(403).json({ error: 'Keine Berechtigung für die Adminverwaltung.' })
      }

      if (action === 'set-admin-membership-active') {
        const email = String(req.body?.email || '').trim().toLowerCase()
        const club = String(req.body?.club || '').trim()
        const role = String(req.body?.role || '').trim()
        const active = req.body?.active
        if (!email || !club || !role || typeof active !== 'boolean') {
          return res.status(400).json({ error: 'Der Status des Administrators konnte nicht geändert werden.' })
        }
        const users = []
        for (let page = 1; ; page += 1) {
          const { data: pageData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
          if (usersError) throw usersError
          users.push(...(pageData?.users || []))
          if ((pageData?.users || []).length < 1000) break
        }
        const selectedUser = users.find(user => String(user.email || '').toLowerCase() === email)
        if (!selectedUser) return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        const { data: selectedMemberships, error: selectedMembershipsError } = await supabase
          .from('club_admin_memberships')
          .select('id, role, clubs(name)')
          .eq('user_id', selectedUser.id)
        if (selectedMembershipsError) throw selectedMembershipsError
        const clubMembership = (selectedMemberships || []).find(
          membership => (membership.clubs?.name || '') === club
        )
        if (!clubMembership) return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        if (selectedUser.id === userResult.user.id || clubMembership.role === 'superadmin') {
          return res.status(400).json({ error: 'Ein Superadmin kann über diese Funktion nicht gesperrt werden.' })
        }
        if (clubMembership.role !== role || !['clubadmin', 'checkin_admin'].includes(role)) {
          return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        }
        const { error: updateMembershipError } = await supabase
          .from('club_admin_memberships')
          .update({ active })
          .eq('id', clubMembership.id)
        if (updateMembershipError) throw updateMembershipError
        return res.status(200).json({ success: true })
      }

      if (action === 'invite-administrator') {
        const firstName = String(req.body?.firstName || '').trim()
        const lastName = String(req.body?.lastName || '').trim()
        const email = String(req.body?.email || '').trim().toLowerCase()
        const clubId = String(req.body?.clubId || '').trim()
        const role = String(req.body?.role || '').trim()
        if (!firstName || !lastName || !email || !clubId || !role) {
          return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' })
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' })
        }
        if (!['clubadmin', 'checkin_admin'].includes(role)) {
          return res.status(400).json({ error: 'Der Administrator konnte nicht angelegt werden.' })
        }
        const { data: club, error: clubError } = await supabase
          .from('clubs')
          .select('id')
          .eq('id', clubId)
          .maybeSingle()
        if (clubError || !club) {
          return res.status(400).json({ error: 'Der Administrator konnte nicht angelegt werden.' })
        }

        const users = []
        for (let page = 1; ; page += 1) {
          const { data: pageData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
          if (usersError) throw usersError
          users.push(...(pageData?.users || []))
          if ((pageData?.users || []).length < 1000) break
        }
        const existingUser = users.find(user => String(user.email || '').toLowerCase() === email)
        if (existingUser) {
          const { data: existingMemberships, error: existingMembershipsError } = await supabase
            .from('club_admin_memberships')
            .select('user_id')
            .eq('user_id', existingUser.id)
            .limit(1)
          if (existingMembershipsError) throw existingMembershipsError
          if (existingMemberships?.length) {
            return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits als Administrator vorhanden.' })
          }
        }

        const redirectTo = getAdminInviteRedirectUrl()
        if (!redirectTo) {
          return res.status(500).json({ error: 'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.' })
        }
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { first_name: firstName, last_name: lastName }
        })
        if (inviteError || !inviteData?.user) {
          return res.status(500).json({ error: 'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.' })
        }

        const { error: membershipError } = await supabase
          .from('club_admin_memberships')
          .insert({
            user_id: inviteData.user.id,
            club_id: club.id,
            role,
            active: true
          })
        if (membershipError) {
          await supabase.auth.admin.deleteUser(inviteData.user.id)
          return res.status(500).json({ error: 'Der Administrator konnte nicht angelegt werden.' })
        }
        return res.status(201).json({ success: true })
      }

      const users = []
      for (let page = 1; ; page += 1) {
        const { data: pageData, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (usersError) throw usersError
        users.push(...(pageData?.users || []))
        if ((pageData?.users || []).length < 1000) break
      }

      if (action === 'get-admin-membership-detail') {
        const email = String(req.body?.email || '').trim().toLowerCase()
        const club = String(req.body?.club || '').trim()
        const role = String(req.body?.role || '').trim()
        const selectedUser = users.find(user => String(user.email || '').toLowerCase() === email)
        if (!selectedUser) return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        const { data: selectedMemberships, error: selectedMembershipsError } = await supabase
          .from('club_admin_memberships')
          .select('role, active, created_at, clubs(name)')
          .eq('user_id', selectedUser.id)
        if (selectedMembershipsError) throw selectedMembershipsError
        const selectedMembership = (selectedMemberships || []).find(
          membership => membership.role === role && (membership.clubs?.name || '') === club
        )
        if (!selectedMembership) return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        return res.status(200).json({
          administrator: {
            firstName: selectedUser.user_metadata?.first_name || selectedUser.user_metadata?.firstname || '',
            lastName: selectedUser.user_metadata?.last_name || selectedUser.user_metadata?.lastname || '',
            email: selectedUser.email || '',
            club: selectedMembership.clubs?.name || '',
            role: selectedMembership.role,
            active: Boolean(selectedMembership.active),
            createdAt: selectedMembership.created_at,
            lastSignInAt: selectedUser.last_sign_in_at || null
          }
        })
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('club_admin_memberships')
        .select('user_id, role, active, created_at, clubs(name)')
        .order('created_at', { ascending: true })
      if (membershipsError) throw membershipsError
      const userById = new Map(users.map(user => [user.id, user]))
      return res.status(200).json({
        administrators: (memberships || []).map(membership => {
          const user = userById.get(membership.user_id)
          return {
            email: user?.email || '',
            club: membership.clubs?.name || '',
            role: membership.role,
            active: Boolean(membership.active),
            createdAt: membership.created_at
          }
        })
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
    if (action === 'get-admin-membership-detail') {
      return res.status(500).json({ error: 'Die Administratordaten konnten nicht geladen werden.' })
    }
    if (action === 'invite-administrator') {
      return res.status(500).json({ error: 'Der Administrator konnte nicht angelegt werden.' })
    }
    if (action === 'set-admin-membership-active') {
      return res.status(500).json({ error: 'Der Status des Administrators konnte nicht geändert werden.' })
    }
    return res.status(500).json({ error: 'Zahlungsstatus konnte nicht gespeichert werden.' })
  }
}
