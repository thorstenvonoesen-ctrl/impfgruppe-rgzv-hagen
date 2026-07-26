import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

const SEARCH_FIELDS = ['firstname', 'lastname', 'email', 'phone', 'tsk_number']

function cleanSearchTerm(value) {
  return String(value || '')
    .trim()
    .replace(/[\\()",%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLocaleLowerCase('de-DE')
}

function maskEmail(value) {
  const [localPart = '', domain = ''] = String(value || '').split('@')
  if (!domain) return ''
  const visible = localPart.slice(0, Math.min(2, localPart.length))
  return `${visible}${localPart.length > visible.length ? '***' : ''}@${domain}`
}

function phoneSuffix(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? digits.slice(-4) : ''
}

function formatSearchResult(participant, appointments, selectedVaccinationDateId) {
  const appointment = appointments.get(String(participant.vaccination_date_id))
  return {
    id: participant.id,
    firstname: participant.firstname,
    lastname: participant.lastname,
    city: participant.city || '',
    email_masked: maskEmail(participant.email),
    phone_suffix: phoneSuffix(participant.phone),
    animal_count: participant.animal_count,
    payment_status: participant.payment_status,
    payment_method: participant.payment_method,
    payment_date: participant.payment_date,
    checked_in: participant.checked_in,
    checked_in_at: participant.checked_in_at,
    vaccination_date_id: participant.vaccination_date_id,
    vaccination_date: appointment?.date || '',
    vaccination_title: appointment?.title || 'Impftermin',
    other_appointment: String(participant.vaccination_date_id) !== String(selectedVaccinationDateId)
  }
}

async function authenticateAdmin(req, supabase) {
  const accessToken = getBearerToken(req)
  if (!accessToken) return { error: 'Authentifizierung erforderlich.', status: 401 }
  const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userResult.user) return { error: 'Ungültige Anmeldung.', status: 401 }
  const { data: memberships, error: membershipError } = await supabase
    .from('club_admin_memberships')
    .select('club_id, role, active')
    .eq('user_id', userResult.user.id)
    .eq('active', true)
  if (membershipError) throw membershipError
  return { user: userResult.user, memberships: memberships || [] }
}

function canManageClub(memberships, clubId) {
  return memberships.some(member => member.role === 'superadmin' || member.club_id === clubId)
}

function canManagePayments(memberships, clubId) {
  return memberships.some(member =>
    member.role === 'superadmin' || (member.role === 'clubadmin' && member.club_id === clubId)
  )
}

async function getAuthorizedAppointment(supabase, memberships, vaccinationDateId) {
  const { data: appointment, error } = await supabase
    .from('vaccination_dates')
    .select('id, club_id, title, date')
    .eq('id', vaccinationDateId)
    .single()
  if (error || !appointment) return { error: 'Impftermin nicht gefunden.', status: 404 }
  if (!canManageClub(memberships, appointment.club_id)) {
    return { error: 'Keine Berechtigung für diesen Verein.', status: 403 }
  }
  return { appointment }
}

async function searchParticipants(supabase, clubId, selectedVaccinationDateId, rawQuery) {
  const query = cleanSearchTerm(rawQuery)
  if (query.length < 2) return []

  const terms = [...new Set([query, ...query.split(' ').filter(term => term.length >= 2)])]
  const responses = await Promise.all(terms.map(term => {
    const pattern = `*${term}*`
    const filters = SEARCH_FIELDS.map(field => `${field}.ilike.${pattern}`).join(',')
    return supabase
      .from('participants')
      .select('id, firstname, lastname, city, email, phone, tsk_number, animal_count, payment_status, payment_method, payment_date, checked_in, checked_in_at, vaccination_date_id')
      .eq('club_id', clubId)
      .eq('vaccination_date_id', selectedVaccinationDateId)
      .or(filters)
      .limit(75)
  }))
  const queryError = responses.find(response => response.error)?.error
  if (queryError) throw queryError

  const uniqueParticipants = new Map()
  responses.forEach(({ data }) => (data || []).forEach(participant => uniqueParticipants.set(participant.id, participant)))
  const normalizedQuery = normalizeSearchValue(query)
  const normalizedTerms = normalizedQuery.split(' ').filter(Boolean)
  const matches = [...uniqueParticipants.values()].filter(participant => {
    const searchable = normalizeSearchValue([
      participant.firstname,
      participant.lastname,
      `${participant.firstname || ''} ${participant.lastname || ''}`,
      participant.email,
      participant.phone,
      participant.tsk_number
    ].join(' '))
    return searchable.includes(normalizedQuery) || normalizedTerms.every(term => searchable.includes(term))
  })

  const appointmentIds = [...new Set(matches.map(participant => participant.vaccination_date_id).filter(Boolean))]
  let appointments = new Map()
  if (appointmentIds.length) {
    const { data, error } = await supabase
      .from('vaccination_dates')
      .select('id, title, date')
      .eq('club_id', clubId)
      .in('id', appointmentIds)
    if (error) throw error
    appointments = new Map((data || []).map(appointment => [String(appointment.id), appointment]))
  }

  return matches
    .map(participant => formatSearchResult(participant, appointments, selectedVaccinationDateId))
    .sort((left, right) => {
      if (left.other_appointment !== right.other_appointment) return left.other_appointment ? 1 : -1
      return `${left.lastname} ${left.firstname}`.localeCompare(`${right.lastname} ${right.firstname}`, 'de')
    })
    .slice(0, 50)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createAdminSupabase()
    const authentication = await authenticateAdmin(req, supabase)
    if (authentication.error) return res.status(authentication.status).json({ error: authentication.error })
    const { user, memberships } = authentication
    const { action = 'qr-checkin' } = req.body || {}

    if (action === 'search-participants') {
      const { vaccinationDateId, query } = req.body || {}
      if (!vaccinationDateId || cleanSearchTerm(query).length < 2) {
        return res.status(400).json({ error: 'Bitte mindestens zwei Zeichen eingeben.' })
      }
      const authorization = await getAuthorizedAppointment(supabase, memberships, vaccinationDateId)
      if (authorization.error) return res.status(authorization.status).json({ error: authorization.error })
      const participants = await searchParticipants(
        supabase,
        authorization.appointment.club_id,
        vaccinationDateId,
        query
      )
      return res.status(200).json({ participants })
    }

    if (action === 'manual-update') {
      const { participantId, vaccinationDateId, markPaid = false, checkIn = false } = req.body || {}
      if (!participantId || !vaccinationDateId || (!markPaid && !checkIn)) {
        return res.status(400).json({ error: 'Ungültige manuelle Aktion.' })
      }
      const authorization = await getAuthorizedAppointment(supabase, memberships, vaccinationDateId)
      if (authorization.error) return res.status(authorization.status).json({ error: authorization.error })
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .select('id, club_id, vaccination_date_id, checked_in, payment_status, email')
        .eq('id', participantId)
        .single()
      if (participantError || !participant) return res.status(404).json({ error: 'Teilnehmer nicht gefunden.' })
      if (participant.club_id !== authorization.appointment.club_id) {
        return res.status(403).json({ error: 'Teilnehmer gehört nicht zum ausgewählten Verein.' })
      }
      if (String(participant.vaccination_date_id) !== String(authorization.appointment.id)) {
        return res.status(403).json({ error: 'Teilnehmer gehört nicht zum ausgewählten Impftermin.' })
      }
      if (markPaid && !canManagePayments(memberships, participant.club_id)) {
        return res.status(403).json({ error: 'Keine Berechtigung zum Ändern des Zahlungsstatus.' })
      }
      if (markPaid && participant.payment_status === 'bezahlt') {
        return res.status(409).json({ error: 'Diese Zahlung wurde bereits verbucht.' })
      }
      if (checkIn && participant.checked_in) {
        return res.status(409).json({ error: 'Dieser Teilnehmer ist bereits eingecheckt.' })
      }
      if (checkIn && !markPaid && participant.payment_status !== 'bezahlt') {
        return res.status(409).json({ error: 'Eine offene Zahlung muss vor dem Check-in verbucht werden.' })
      }

      const update = {}
      const now = new Date().toISOString()
      if (markPaid && participant.payment_status !== 'bezahlt') {
        update.payment_status = 'bezahlt'
        update.payment_method = 'bar'
        update.payment_date = now
      }
      if (checkIn) {
        update.checked_in = true
        update.checked_in_at = now
        update.checked_in_by = user.id
        update.checkin_method = 'manual'
      }
      let updateQuery = supabase
        .from('participants')
        .update(update)
        .eq('id', participant.id)
        .eq('club_id', participant.club_id)
        .eq('vaccination_date_id', authorization.appointment.id)
      if (markPaid) updateQuery = updateQuery.eq('payment_status', 'offen')
      if (checkIn) updateQuery = updateQuery.eq('checked_in', false)
      const { data: updated, error: updateError } = await updateQuery
        .select('id, payment_status, payment_method, payment_date, checked_in, checked_in_at')
        .maybeSingle()
      if (updateError) throw updateError
      if (!updated) {
        return res.status(409).json({ error: 'Die Aktion wurde bereits ausgeführt. Bitte Status aktualisieren.' })
      }

      if (markPaid && participant.payment_status !== 'bezahlt' && participant.email) {
        await fetch(`https://${req.headers.host}/api/send-payment-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: participant.id })
        }).catch(() => null)
      }
      return res.status(200).json({ success: true, participant: updated })
    }

    const { token, vaccinationDateId, checkedIn = true } = req.body || {}
    if (!token || !vaccinationDateId || typeof checkedIn !== 'boolean') {
      return res.status(400).json({ error: 'Ungültige Check-in-Anfrage.' })
    }

    const authorization = await getAuthorizedAppointment(supabase, memberships, vaccinationDateId)
    if (authorization.error) return res.status(authorization.status).json({ error: authorization.error })
    const { appointment } = authorization

    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, club_id, vaccination_date_id, checked_in')
      .eq('checkin_token', token)
      .single()
    if (participantError || !participant) return res.status(404).json({ error: 'QR-Code nicht gefunden.' })
    if (participant.club_id !== appointment.club_id || participant.vaccination_date_id !== appointment.id) {
      return res.status(403).json({ error: 'QR-Code gehört nicht zu diesem Impftermin.' })
    }
    if (checkedIn && participant.checked_in) {
      return res.status(409).json({ error: 'Dieser Teilnehmer ist bereits eingecheckt.' })
    }

    let checkinUpdate = supabase
      .from('participants')
      .update({
        checked_in: checkedIn,
        checked_in_at: checkedIn ? new Date().toISOString() : null,
        checked_in_by: checkedIn ? user.id : null,
        checkin_method: checkedIn ? 'qr' : null
      })
      .eq('id', participant.id)
      .eq('club_id', appointment.club_id)
      .eq('vaccination_date_id', appointment.id)
    if (checkedIn) checkinUpdate = checkinUpdate.eq('checked_in', false)
    const { data: updated, error: updateError } = await checkinUpdate
      .select('id, checked_in, checked_in_at')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return res.status(409).json({ error: 'Dieser Teilnehmer ist bereits eingecheckt.' })
    return res.status(200).json({ success: true, participant: updated })
  } catch (error) {
    console.error('Check-in request failed:', error)
    return res.status(500).json({ error: 'Check-in konnte nicht verarbeitet werden.' })
  }
}
