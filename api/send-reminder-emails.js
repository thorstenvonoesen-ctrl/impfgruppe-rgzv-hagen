import { Resend } from 'resend'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizeEmail = value => String(value || '').trim().toLowerCase()
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character])

function isTestAppointment(appointment) {
  return Object.values(appointment || {}).some(
    value => typeof value === 'string' && value.toLowerCase().includes('test')
  )
}

async function authenticateAdmin(req, supabase, clubId) {
  const accessToken = getBearerToken(req)
  if (!accessToken) return null
  const { data: userResult, error } = await supabase.auth.getUser(accessToken)
  if (error || !userResult.user) return null
  const { data: memberships } = await supabase
    .from('club_admin_memberships')
    .select('club_id, role')
    .eq('user_id', userResult.user.id)
    .eq('active', true)
  const authorized = (memberships || []).some(
    membership => membership.role === 'superadmin' || String(membership.club_id) === String(clubId)
  )
  return authorized ? userResult.user : null
}

async function handleSmartAssistant(req, res, supabase) {
  const { clubId } = req.body || {}
  if (!clubId) return res.status(400).json({ error: 'Verein fehlt.' })
  const user = await authenticateAdmin(req, supabase, clubId)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })

  const [
    { data: club, error: clubError },
    { data: participants, error: participantsError },
    { data: appointments, error: appointmentsError }
  ] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', clubId).single(),
    supabase.from('participants').select('id, firstname, lastname, email, phone, animal_type, animal_count, vaccine, payment_status, payment_method, registration_status, vaccination_date_id').eq('club_id', clubId),
    supabase.from('vaccination_dates').select('*').eq('club_id', clubId).order('date', { ascending: true })
  ])
  if (clubError || participantsError || appointmentsError) {
    throw clubError || participantsError || appointmentsError
  }

  const tasks = []
  const addTask = (priority, id, title, detail, action, actionLabel) => {
    tasks.push({ priority, id, title, detail, action, actionLabel })
  }
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const regularAppointments = (appointments || []).filter(appointment => !isTestAppointment(appointment))
  const futureAppointments = regularAppointments.filter(appointment => appointment.date >= todayKey)
  const nextAppointment = futureAppointments[0] || null
  const activeYear = nextAppointment
    ? Number(String(nextAppointment.date).slice(0, 4))
    : now.getFullYear()
  const appointmentById = new Map(regularAppointments.map(appointment => [String(appointment.id), appointment]))
  const activeParticipants = (participants || []).filter(participant => {
    const appointment = appointmentById.get(String(participant.vaccination_date_id))
    return appointment &&
      ['completed', 'bar_registered'].includes(participant.registration_status) &&
      Number(String(appointment.date).slice(0, 4)) === activeYear
  })

  const openPayments = activeParticipants.filter(participant => participant.payment_status !== 'bezahlt')
  if (openPayments.length) {
    addTask('yellow', 'open-payments', `${openPayments.length} Zahlung${openPayments.length === 1 ? '' : 'en'} offen`, 'Zahlungsstatus der aktuellen Termine prüfen.', 'participants', 'Teilnehmer anzeigen')
  }
  const missingEmail = activeParticipants.filter(participant => !EMAIL_PATTERN.test(normalizeEmail(participant.email)))
  if (missingEmail.length) {
    addTask('yellow', 'missing-email', `${missingEmail.length} Teilnehmer ohne gültige E-Mail-Adresse`, 'Kontaktdaten vervollständigen.', 'participants', 'Teilnehmer anzeigen')
  }
  const missingPhone = activeParticipants.filter(participant => !String(participant.phone || '').trim())
  if (missingPhone.length) {
    addTask('yellow', 'missing-phone', `${missingPhone.length} Teilnehmer ohne Telefonnummer`, 'Eine Telefonnummer erleichtert kurzfristige Rückfragen.', 'participants', 'Teilnehmer anzeigen')
  }
  const incomplete = activeParticipants.filter(participant =>
    !participant.firstname || !participant.lastname || !participant.animal_type ||
    Number(participant.animal_count || 0) < 1 || !participant.vaccine || !participant.vaccination_date_id
  )
  if (incomplete.length) {
    addTask('yellow', 'incomplete-participants', `${incomplete.length} unvollständige Teilnehmerdatensätze`, 'Pflichtangaben der Anmeldung kontrollieren.', 'participants', 'Datensätze prüfen')
  }
  const duplicateKeys = new Map()
  for (const participant of activeParticipants) {
    const email = normalizeEmail(participant.email)
    if (!EMAIL_PATTERN.test(email)) continue
    const key = `${participant.vaccination_date_id}|${email}`
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1)
  }
  const duplicateCount = [...duplicateKeys.values()].filter(count => count > 1).length
  if (duplicateCount) {
    addTask('yellow', 'duplicate-participants', `${duplicateCount} mögliche Doppelanmeldung${duplicateCount === 1 ? '' : 'en'}`, 'Gleiche E-Mail-Adresse ist für denselben Termin mehrfach vorhanden.', 'participants', 'Doppelungen prüfen')
  }

  if (!nextAppointment) {
    addTask('red', 'no-future-appointment', 'Kein zukünftiger Impftermin vorhanden', 'Bitte einen regulären Impftermin anlegen.', 'appointments', 'Impftermin anlegen')
  } else {
    const appointmentMoment = new Date(`${nextAppointment.date}T23:59:59`)
    const hoursUntilAppointment = (appointmentMoment.getTime() - now.getTime()) / 3600000
    const nextParticipants = activeParticipants.filter(
      participant => String(participant.vaccination_date_id) === String(nextAppointment.id)
    )
    if (!nextParticipants.length) {
      addTask('red', 'appointment-without-participants', 'Nächster Termin hat noch keine Teilnehmer', `${nextAppointment.title || 'Impftermin'} am ${nextAppointment.date}.`, 'participants', 'Teilnehmer anzeigen')
    }
    if (hoursUntilAppointment <= 168 && hoursUntilAppointment > 48) {
      addTask('yellow', 'appointment-soon', 'Impftermin in weniger als 7 Tagen', 'Organisation und Unterlagen jetzt abschließend prüfen.', 'appointments', 'Termin öffnen')
    }
    if (hoursUntilAppointment <= 168 && !nextAppointment.vet_certificate_generated_at) {
      addTask(hoursUntilAppointment <= 48 ? 'red' : 'yellow', 'vet-certificate-missing', 'Sammelimpfbescheinigung noch nicht erstellt', 'Die Tierarztunterlagen für den nächsten Termin fehlen.', 'vet', 'Tierarztfunktion öffnen')
    } else if (hoursUntilAppointment <= 168 && !nextAppointment.vet_certificate_sent_at) {
      addTask(hoursUntilAppointment <= 48 ? 'red' : 'yellow', 'vet-certificate-unsent', 'Tierarzt-PDF noch nicht versendet', 'Die erstellten Unterlagen müssen noch an den Tierarzt gesendet werden.', 'vet', 'Tierarztfunktion öffnen')
  }
}
  const missingClubFields = ['name', 'slug'].filter(field => !String(club?.[field] || '').trim())
  if (missingClubFields.length) {
    addTask('red', 'club-data-missing', 'Kritische Vereinsdaten fehlen', 'Vereinsname oder Vereinskennung ist nicht vollständig hinterlegt.', 'club', 'Vereinsdaten öffnen')
  }
  if (!process.env.VET_RECIPIENT_EMAIL) {
    addTask('yellow', 'vet-email-missing', 'Tierarzt-E-Mail nicht konfiguriert', 'Für den produktiven Versand muss VET_RECIPIENT_EMAIL hinterlegt werden.', 'system', 'Konfiguration prüfen')
  }
  const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET)
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  if (!paypalConfigured && !stripeConfigured) {
    addTask('red', 'payment-missing', 'Keine Zahlungsart vollständig konfiguriert', 'PayPal oder Stripe muss serverseitig eingerichtet sein.', 'system', 'Konfiguration prüfen')
  }

  const priorityOrder = { red: 0, yellow: 1 }
  tasks.sort((first, second) => priorityOrder[first.priority] - priorityOrder[second.priority])
  const status = tasks.some(task => task.priority === 'red')
    ? 'red'
    : tasks.length
      ? 'yellow'
      : 'green'
  return res.status(200).json({
    status,
    taskCount: tasks.length,
    tasks,
    checkedAt: new Date().toISOString()
  })
}

async function handleExistingReminder(req, res, supabase) {
  const { vaccinationDateId, type, newTime, newMeetingPoint } = req.body || {}
  const { data: participants, error } = await supabase
    .from('participants')
    .select('*')
    .eq('vaccination_date_id', vaccinationDateId)
    .in('registration_status', ['completed', 'bar_registered'])
  if (error) return res.status(500).json({ error: error.message })
  let sent = 0
  for (const participant of participants || []) {
    const isTimeChange = type === 'time'
    const subject = isTimeChange
      ? 'Änderung der Uhrzeit Ihres Impftermins'
      : 'Änderung des Treffpunkts Ihres Impftermins'
    const detail = isTimeChange
      ? `<p><strong>Neue Uhrzeit:</strong> ${escapeHtml(newTime)}</p>`
      : `<p><strong>Neuer Treffpunkt:</strong> ${escapeHtml(newMeetingPoint)}</p>`
    await resend.emails.send({
      from: 'RGZV Hagen <onboarding@resend.dev>',
      to: participant.email,
      subject,
      html: `<h2>${isTimeChange ? 'Änderung der Uhrzeit' : 'Änderung des Treffpunkts'}</h2>
        <p>Hallo ${escapeHtml(participant.firstname)} ${escapeHtml(participant.lastname)},</p>
        <p>${isTimeChange ? 'Die Uhrzeit' : 'Der Treffpunkt'} Ihres Impftermins wurde geändert.</p>
        ${detail}
        <p>Mit freundlichen Grüßen<br>RGZV Hagen und Umgebung seit 1903 e.V.</p>`
    })
    sent += 1
  }
  return res.status(200).json({ success: true, sent })
}

export default async function handler(req, res) {
  const supabase = createAdminSupabase()
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const action = req.body?.action
    if (action === 'smart-assistant') return await handleSmartAssistant(req, res, supabase)
    return await handleExistingReminder(req, res, supabase)
  } catch (error) {
    const status = error.code === 'TEST_APPOINTMENT' ? 400 : error.code === 'NOT_FIRST_REGULAR' ? 409 : 500
    return res.status(status).json({ error: error.message || 'Erinnerungs-E-Mail konnte nicht verarbeitet werden.' })
  }
}
