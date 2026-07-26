import { randomUUID } from 'node:crypto'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'
import { createPaymentMailProof } from './_email-signature.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const accessToken = getBearerToken(req)
    if (!accessToken) return res.status(401).json({ error: 'Authentifizierung erforderlich.' })

    const supabase = createAdminSupabase()
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
    if (userError || !userResult.user) return res.status(401).json({ error: 'Ungültige Anmeldung.' })

    const { participantId, paid } = req.body || {}
    if (!participantId || typeof paid !== 'boolean') {
      return res.status(400).json({ error: 'Ungültige Zahlungsanfrage.' })
    }

    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, email, payment_status, payment_method, payment_id')
      .eq('id', participantId)
      .single()

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
    }

    const { data: memberships } = await supabase
      .from('club_admin_memberships')
      .select('club_id, role')
      .eq('user_id', userResult.user.id)
      .eq('active', true)

    const authorized = (memberships || []).some(member =>
      member.role === 'superadmin' ||
      (member.role === 'clubadmin' && String(member.club_id) === String(participant.club_id))
    )
    if (!authorized) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
    }

    if (paid) {
      if (participant.payment_status === 'bezahlt') {
        return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
      }
      if (participant.payment_method !== null || participant.payment_id !== null) {
        return res.status(409).json({ error: 'Eine bestehende Zahlung darf nicht überschrieben werden.' })
      }

      const paymentId = `admin-bar-${randomUUID()}`
      const { data: updated, error: updateError } = await supabase
        .from('participants')
        .update({
          payment_status: 'bezahlt',
          payment_method: 'bar',
          payment_date: new Date().toISOString(),
          payment_id: paymentId
        })
        .eq('id', participant.id)
        .eq('club_id', participant.club_id)
        .eq('payment_status', 'offen')
        .is('payment_method', null)
        .is('payment_id', null)
        .select('id')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updated) {
        return res.status(200).json({ success: true, alreadyProcessed: true, emailSent: false })
      }

      let emailSent = false
      if (participant.email) {
        const authorization = createPaymentMailProof({
          participantId: participant.id,
          paymentMethod: 'bar',
          paymentId
        })
        const emailResponse = await fetch(`https://${req.headers.host}/api/send-payment-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorization })
        })
        const emailResult = await emailResponse.json().catch(() => ({}))
        emailSent = Boolean(emailResponse.ok && emailResult.emailSent)
      }
      return res.status(200).json({ success: true, emailSent })
    }

    if (participant.payment_status !== 'bezahlt') {
      return res.status(200).json({ success: true, alreadyProcessed: true })
    }
    if (participant.payment_method && participant.payment_method !== 'bar') {
      return res.status(409).json({ error: 'Eine Onlinezahlung darf hier nicht aufgehoben werden.' })
    }

    const { error: updateError } = await supabase
      .from('participants')
      .update({
        payment_status: 'offen',
        payment_method: null,
        payment_date: null,
        payment_id: null,
        payment_email_sent_at: null,
        payment_email_reference: null
      })
      .eq('id', participant.id)
      .eq('club_id', participant.club_id)
      .eq('payment_status', 'bezahlt')
      .in('payment_method', ['bar'])

    if (updateError) throw updateError
    return res.status(200).json({ success: true })
  } catch {
    return res.status(500).json({ error: 'Zahlungsstatus konnte nicht gespeichert werden.' })
  }
}
