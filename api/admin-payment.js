import nodemailer from 'nodemailer'
import { emailSignatureHtml } from './_email-signature.js'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

const clubMailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

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
      action === 'set-admin-membership-active' ||
      action === 'set-admin-membership-role' ||
      action === 'delete-administrator'
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

      if (action === 'delete-administrator') {
        const email = String(req.body?.email || '').trim().toLowerCase()
        const club = String(req.body?.club || '').trim()
        const role = String(req.body?.role || '').trim()
        if (!email || !club || !role) {
          return res.status(400).json({ error: 'Der Administrator konnte nicht gelöscht werden.' })
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
          return res.status(400).json({ error: 'Ein Superadmin kann über diese Funktion nicht gelöscht werden.' })
        }
        if (clubMembership.role !== role || !['clubadmin', 'checkin_admin'].includes(role)) {
          return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        }

        if (selectedMemberships.length === 1) {
          const { error: deleteUserError } = await supabase.auth.admin.deleteUser(selectedUser.id)
          if (deleteUserError) throw deleteUserError
        } else {
          const { error: deleteMembershipError } = await supabase
            .from('club_admin_memberships')
            .delete()
            .eq('id', clubMembership.id)
          if (deleteMembershipError) throw deleteMembershipError
        }
        return res.status(200).json({ success: true })
      }

      if (action === 'set-admin-membership-role') {
        const email = String(req.body?.email || '').trim().toLowerCase()
        const club = String(req.body?.club || '').trim()
        const currentRole = String(req.body?.currentRole || '').trim()
        const newRole = String(req.body?.newRole || '').trim()
        if (!['clubadmin', 'checkin_admin'].includes(newRole)) {
          return res.status(400).json({ error: 'Die ausgewählte Rolle ist nicht zulässig.' })
        }
        if (!email || !club || !['clubadmin', 'checkin_admin'].includes(currentRole)) {
          return res.status(400).json({ error: 'Die Rolle des Administrators konnte nicht geändert werden.' })
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
          return res.status(400).json({ error: 'Die Superadmin-Rolle kann über diese Funktion nicht geändert werden.' })
        }
        if (clubMembership.role !== currentRole || !['clubadmin', 'checkin_admin'].includes(clubMembership.role)) {
          return res.status(404).json({ error: 'Der Administrator wurde nicht gefunden.' })
        }
        const { error: updateRoleError } = await supabase
          .from('club_admin_memberships')
          .update({ role: newRole })
          .eq('id', clubMembership.id)
        if (updateRoleError) throw updateRoleError
        return res.status(200).json({ success: true })
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
          .select('id, name')
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
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo,
            data: { first_name: firstName, last_name: lastName }
          }
        })
        const invitedUser = inviteData?.user
        const invitationLink = inviteData?.properties?.action_link
        if (inviteError || !invitedUser || !invitationLink) {
          return res.status(500).json({ error: 'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.' })
        }

        const { error: membershipError } = await supabase
          .from('club_admin_memberships')
          .insert({
            user_id: invitedUser.id,
            club_id: club.id,
            role,
            active: true
          })
        if (membershipError) {
          await supabase.auth.admin.deleteUser(invitedUser.id)
          return res.status(500).json({ error: 'Der Administrator konnte nicht angelegt werden.' })
        }
        try {
          await clubMailTransporter.sendMail({
            from: `"RGZV Hagen und Umgebung seit 1903 e.V." <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Einladung zum Adminbereich des Impfgruppenmanagers',
            html: `
              <p>Guten Tag ${escapeHtml(firstName)} ${escapeHtml(lastName)},</p>

              <p>
                Sie wurden als Administrator für den Impfgruppenmanager des Vereins
                <strong>${escapeHtml(club.name)}</strong> angelegt.
              </p>

              <p>Über den folgenden Link können Sie Ihr persönliches Passwort festlegen:</p>

              <p><a href="${escapeHtml(invitationLink)}">Persönliches Passwort festlegen</a></p>

              <p>
                Nach der Passwortvergabe können Sie sich über den bestehenden Admin-Login
                mit Ihrer E-Mail-Adresse und Ihrem persönlichen Passwort anmelden.
              </p>

              ${emailSignatureHtml()}

              <hr>

              <p style="font-size:12px;color:#666;">
                Diese E-Mail wurde automatisch über das Anmeldesystem des
                RGZV Hagen und Umgebung seit 1903 e.V. erstellt.
              </p>
            `
          })
        } catch {
          await supabase
            .from('club_admin_memberships')
            .delete()
            .eq('user_id', invitedUser.id)
            .eq('club_id', club.id)
          await supabase.auth.admin.deleteUser(invitedUser.id)
          return res.status(500).json({ error: 'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.' })
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
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('club_id, email, firstname, lastname, registration_status, payment_status, payment_method, payment_id')
      .eq('id', participantId)
      .single()
    if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    const { data: memberships } = await supabase.from('club_admin_memberships').select('club_id, role').eq('user_id', userResult.user.id).eq('active', true)
    if (!(memberships || []).some(member => member.role === 'superadmin' || member.club_id === participant.club_id)) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
    const providerPaymentMethods = new Set(['paypal', 'stripe', 'card', 'sepa', 'sepa_debit'])
    const paymentMethod = String(participant.payment_method || '').toLowerCase()
    const hasProviderPayment = Boolean(participant.payment_id) || providerPaymentMethods.has(paymentMethod)
    const isConfirmedBarRegistration =
      paymentMethod === 'bar' &&
      participant.registration_status === 'bar_registered' &&
      participant.payment_status === 'offen' &&
      participant.payment_id === null

    if (paid && participant.payment_status === 'bezahlt') {
      return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
    }
    if (!paid && participant.payment_status === 'offen') {
      return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
    }
    if (!paid && hasProviderPayment) {
      return res.status(409).json({ error: 'Eine bereits über PayPal oder Stripe verbuchte Zahlung kann nicht manuell auf offen zurückgesetzt werden.' })
    }
    if (paid && hasProviderPayment) {
      return res.status(409).json({ error: 'Eine Zahlung mit vorhandener Anbieterreferenz muss über den zugehörigen Zahlungsanbieter verbucht werden.' })
    }
    if (paid && ['cancelled', 'expired', 'payment_failed'].includes(participant.registration_status)) {
      return res.status(409).json({ error: 'Eine abgebrochene oder fehlgeschlagene Onlinezahlung kann nicht manuell als bezahlt verbucht werden.' })
    }

    const update = paid
      ? {
          payment_status: 'bezahlt',
          payment_date: new Date().toISOString(),
          payment_method: participant.payment_method || 'bar',
          registration_status: 'completed'
        }
      : {
          payment_status: 'offen',
          payment_date: null,
          payment_method: participant.payment_method || 'bar',
          registration_status: 'bar_registered'
        }
    let updateQuery = supabase
      .from('participants')
      .update(update)
      .eq('id', participantId)
      .eq('club_id', participant.club_id)
      .eq('payment_status', participant.payment_status)
    updateQuery = participant.payment_method === null
      ? updateQuery.is('payment_method', null)
      : updateQuery.eq('payment_method', participant.payment_method)
    updateQuery = participant.payment_id === null
      ? updateQuery.is('payment_id', null)
      : updateQuery.eq('payment_id', participant.payment_id)
    const { data: updatedParticipant, error: updateError } = await updateQuery.select('id').maybeSingle()
    if (updateError) throw updateError
    if (!updatedParticipant) return res.status(409).json({ error: 'Der Zahlungsstatus wurde zwischenzeitlich geändert. Bitte die Ansicht neu laden.' })

    if (paid && isConfirmedBarRegistration) {
      return res.status(200).json({ success: true, emailSent: false, barPaymentRecorded: true })
    }

    if (paid && participant.email) {
      try {
        const emailResponse = await fetch(`https://${req.headers.host}/api/send-payment-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId })
        })
        if (!emailResponse.ok) {
          return res.status(200).json({
            success: true,
            emailSent: false,
            warning: 'Zahlung wurde verbucht, die Bestätigungsmail konnte jedoch nicht versendet werden.'
          })
        }
        return res.status(200).json({ success: true, emailSent: true })
      } catch {
        return res.status(200).json({
          success: true,
          emailSent: false,
          warning: 'Zahlung wurde verbucht, die Bestätigungsmail konnte jedoch nicht versendet werden.'
        })
      }
    }
    return res.status(200).json({ success: true, emailSent: false })
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
    if (action === 'set-admin-membership-role') {
      return res.status(500).json({ error: 'Die Rolle des Administrators konnte nicht geändert werden.' })
    }
    if (action === 'delete-administrator') {
      return res.status(500).json({ error: 'Der Administrator konnte nicht gelöscht werden.' })
    }
    return res.status(500).json({ error: 'Zahlungsstatus konnte nicht gespeichert werden.' })
  }
}
