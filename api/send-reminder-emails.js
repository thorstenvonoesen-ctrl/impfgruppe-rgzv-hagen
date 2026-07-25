import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import { createAdminSupabase, getBearerToken } from './_supabase-admin.js'
import { emailSignatureHtml } from './_email-signature.js'

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

function tokenSecret() {
  return process.env.SEASON_MAIL_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
}

function unsubscribeToken(clubId, email) {
  const payload = Buffer.from(JSON.stringify({ clubId, email: normalizeEmail(email) })).toString('base64url')
  const signature = createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifyUnsubscribeToken(token) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature || !tokenSecret()) return null
  const expected = createHmac('sha256', tokenSecret()).update(payload).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return decoded.clubId && EMAIL_PATTERN.test(decoded.email) ? decoded : null
  } catch {
    return null
  }
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

async function seasonContext(supabase, vaccinationDateId) {
  const { data: appointment, error } = await supabase
    .from('vaccination_dates').select('*').eq('id', vaccinationDateId).single()
  if (error || !appointment) throw new Error('Impftermin nicht gefunden.')
  if (isTestAppointment(appointment)) {
    const testError = new Error('Saisonerinnerungen werden für Testtermine nicht versendet.')
    testError.code = 'TEST_APPOINTMENT'
    throw testError
  }

  const seasonYear = Number(String(appointment.date || '').slice(0, 4))
  if (!seasonYear) throw new Error('Der Impftermin hat kein gültiges Datum.')
  const seasonStart = `${seasonYear}-01-01`
  const seasonEnd = `${seasonYear + 1}-01-01`
  const { data: seasonDates, error: datesError } = await supabase
    .from('vaccination_dates')
    .select('*')
    .eq('club_id', appointment.club_id)
    .gte('date', seasonStart)
    .lt('date', seasonEnd)
    .order('created_at', { ascending: true })
  if (datesError) throw datesError
  const regularDates = (seasonDates || []).filter(date => !isTestAppointment(date))
  if (!regularDates.length || String(regularDates[0].id) !== String(appointment.id)) {
    const regularError = new Error('Dieser Termin ist nicht der erste reguläre Impftermin der Saison.')
    regularError.code = 'NOT_FIRST_REGULAR'
    throw regularError
  }

  const previousStart = `${seasonYear - 1}-01-01`
  const { data: previousDates, error: previousDatesError } = await supabase
    .from('vaccination_dates')
    .select('id')
    .eq('club_id', appointment.club_id)
    .gte('date', previousStart)
    .lt('date', seasonStart)
  if (previousDatesError) throw previousDatesError
  const previousDateIds = (previousDates || []).map(date => date.id)
  let participants = []
  if (previousDateIds.length) {
    const { data, error: participantsError } = await supabase
      .from('participants')
      .select('id, firstname, lastname, email')
      .eq('club_id', appointment.club_id)
      .in('vaccination_date_id', previousDateIds)
    if (participantsError) throw participantsError
    participants = data || []
  }

  const { data: preferences, error: preferencesError } = await supabase
    .from('season_email_preferences')
    .select('email_normalized')
    .eq('club_id', appointment.club_id)
    .eq('unsubscribed', true)
  if (preferencesError) throw preferencesError
  const unsubscribed = new Set((preferences || []).map(item => item.email_normalized))
  const recipients = new Map()
  let withoutEmail = 0
  for (const participant of participants) {
    const email = normalizeEmail(participant.email)
    if (!EMAIL_PATTERN.test(email)) {
      withoutEmail += 1
      continue
    }
    if (unsubscribed.has(email) || recipients.has(email)) continue
    recipients.set(email, { ...participant, email })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('season_email_campaigns')
    .select('*')
    .eq('club_id', appointment.club_id)
    .eq('season_year', seasonYear)
    .maybeSingle()
  if (campaignError) throw campaignError
  return {
    appointment,
    seasonYear,
    participants,
    recipients: [...recipients.values()],
    withoutEmail,
    campaign
  }
}

async function handleSeasonPreview(req, res, supabase) {
  const context = await seasonContext(supabase, req.body?.vaccinationDateId)
  const user = await authenticateAdmin(req, supabase, context.appointment.club_id)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  return res.status(200).json({
    eligible: !context.campaign && context.participants.length > 0,
    seasonYear: context.seasonYear,
    previousParticipants: context.participants.length,
    deliverableEmails: context.recipients.length,
    withoutEmail: context.withoutEmail,
    status: context.campaign?.status || 'not_sent'
  })
}

async function handleSeasonStatuses(req, res, supabase) {
  const { clubId } = req.body || {}
  if (!clubId) return res.status(400).json({ error: 'Verein fehlt.' })
  const user = await authenticateAdmin(req, supabase, clubId)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  const { data, error } = await supabase
    .from('season_email_campaigns')
    .select('vaccination_date_id, season_year, status, sent_count, failed_count')
    .eq('club_id', clubId)
  if (error) throw error
  const campaigns = data || []
  const campaignYears = new Set(campaigns.map(campaign => campaign.season_year))
  const { data: dates, error: datesError } = await supabase
    .from('vaccination_dates')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
  if (datesError) throw datesError
  const firstRegularByYear = new Map()
  for (const date of (dates || []).filter(item => !isTestAppointment(item))) {
    const year = Number(String(date.date || '').slice(0, 4))
    if (year && !firstRegularByYear.has(year)) firstRegularByYear.set(year, date)
  }
  for (const [year, date] of firstRegularByYear) {
    if (campaignYears.has(year)) continue
    try {
      const context = await seasonContext(supabase, date.id)
      if (context.participants.length > 0) {
        campaigns.push({
          vaccination_date_id: date.id,
          season_year: year,
          status: 'not_sent',
          sent_count: 0,
          failed_count: 0
        })
      }
    } catch {
      // Years without eligible previous participants do not need a status entry.
    }
  }
  return res.status(200).json({ campaigns })
}

async function handleCampaignDashboard(req, res, supabase) {
  const { clubId } = req.body || {}
  if (!clubId) return res.status(400).json({ error: 'Verein fehlt.' })
  const user = await authenticateAdmin(req, supabase, clubId)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  const { data, error } = await supabase.rpc('season_campaign_summary', {
    target_club_id: clubId
  })
  if (error) throw error
  const campaigns = (data || []).map(campaign => ({
    ...campaign,
    sent_count: Number(campaign.sent_count || 0),
    returned_count: Number(campaign.returned_count || 0),
    open_count: Number(campaign.open_count || 0),
    failed_count: Number(campaign.failed_count || 0),
    response_rate: campaign.response_rate == null ? null : Number(campaign.response_rate)
  }))
  const calendarYear = new Date().getFullYear()
  const currentYear = Math.max(calendarYear, ...campaigns.map(campaign => campaign.season_year))
  return res.status(200).json({
    currentYear,
    current: campaigns.find(campaign => campaign.season_year === currentYear) || null,
    history: campaigns
  })
}

async function handleCampaignDetail(req, res, supabase) {
  const { clubId, campaignId } = req.body || {}
  if (!clubId || !campaignId) return res.status(400).json({ error: 'Kampagne fehlt.' })
  const user = await authenticateAdmin(req, supabase, clubId)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  const { data: campaign, error: campaignError } = await supabase
    .from('season_email_campaigns')
    .select('id, club_id, season_year, status, finished_at')
    .eq('id', campaignId)
    .eq('club_id', clubId)
    .single()
  if (campaignError || !campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden.' })
  const { data, error } = await supabase.rpc('season_campaign_detail', {
    target_campaign_id: campaignId,
    target_club_id: clubId
  })
  if (error) throw error
  return res.status(200).json({ campaign, recipients: data || [] })
}

async function handleSmartAssistant(req, res, supabase) {
  const { clubId } = req.body || {}
  if (!clubId) return res.status(400).json({ error: 'Verein fehlt.' })
  const user = await authenticateAdmin(req, supabase, clubId)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })

  const [
    { data: club, error: clubError },
    { data: participants, error: participantsError },
    { data: appointments, error: appointmentsError },
    { data: campaignSummary, error: campaignError }
  ] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', clubId).single(),
    supabase.from('participants').select('id, firstname, lastname, email, phone, animal_type, animal_count, vaccine, payment_status, payment_method, vaccination_date_id').eq('club_id', clubId),
    supabase.from('vaccination_dates').select('*').eq('club_id', clubId).order('date', { ascending: true }),
    supabase.rpc('season_campaign_summary', { target_club_id: clubId })
  ])
  if (clubError || participantsError || appointmentsError || campaignError) {
    throw clubError || participantsError || appointmentsError || campaignError
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
  const activeSeasonYear = nextAppointment
    ? Number(String(nextAppointment.date).slice(0, 4))
    : now.getFullYear()
  const appointmentById = new Map(regularAppointments.map(appointment => [String(appointment.id), appointment]))
  const seasonParticipants = (participants || []).filter(participant => {
    const appointment = appointmentById.get(String(participant.vaccination_date_id))
    return appointment && Number(String(appointment.date).slice(0, 4)) === activeSeasonYear
  })

  const openPayments = seasonParticipants.filter(participant => participant.payment_status !== 'bezahlt')
  if (openPayments.length) {
    addTask('yellow', 'open-payments', `${openPayments.length} Zahlung${openPayments.length === 1 ? '' : 'en'} offen`, 'Zahlungsstatus der aktuellen Saison prüfen.', 'participants', 'Teilnehmer anzeigen')
  }
  const missingEmail = seasonParticipants.filter(participant => !EMAIL_PATTERN.test(normalizeEmail(participant.email)))
  if (missingEmail.length) {
    addTask('yellow', 'missing-email', `${missingEmail.length} Teilnehmer ohne gültige E-Mail-Adresse`, 'Kontaktdaten vervollständigen.', 'participants', 'Teilnehmer anzeigen')
  }
  const missingPhone = seasonParticipants.filter(participant => !String(participant.phone || '').trim())
  if (missingPhone.length) {
    addTask('yellow', 'missing-phone', `${missingPhone.length} Teilnehmer ohne Telefonnummer`, 'Eine Telefonnummer erleichtert kurzfristige Rückfragen.', 'participants', 'Teilnehmer anzeigen')
  }
  const incomplete = seasonParticipants.filter(participant =>
    !participant.firstname || !participant.lastname || !participant.animal_type ||
    Number(participant.animal_count || 0) < 1 || !participant.vaccine || !participant.vaccination_date_id
  )
  if (incomplete.length) {
    addTask('yellow', 'incomplete-participants', `${incomplete.length} unvollständige Teilnehmerdatensätze`, 'Pflichtangaben der Anmeldung kontrollieren.', 'participants', 'Datensätze prüfen')
  }
  const duplicateKeys = new Map()
  for (const participant of seasonParticipants) {
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
    const nextParticipants = seasonParticipants.filter(
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

  const campaign = (campaignSummary || []).find(item => item.season_year === activeSeasonYear)
  const previousYearDateIds = new Set(
    regularAppointments
      .filter(appointment => Number(String(appointment.date).slice(0, 4)) === activeSeasonYear - 1)
      .map(appointment => String(appointment.id))
  )
  const hasPreviousParticipants = (participants || []).some(
    participant => previousYearDateIds.has(String(participant.vaccination_date_id))
  )
  if (nextAppointment && hasPreviousParticipants && !campaign) {
    addTask('yellow', 'season-not-started', 'Saisonkampagne noch nicht gestartet', 'Frühere Teilnehmer können zur neuen Saison eingeladen werden.', 'season', 'Erinnerungen versenden')
  } else if (campaign?.campaign_status === 'sending') {
    addTask('yellow', 'season-sending', 'Saisonkampagne wird derzeit versendet', 'Die Auswertung steht nach Abschluss des Versands bereit.', 'season', 'Kampagne öffnen')
  } else if (campaign?.response_rate != null && Number(campaign.response_rate) < 25) {
    addTask('yellow', 'season-low-response', 'Ungewöhnlich niedrige Rücklaufquote', `Aktuell haben sich ${Number(campaign.response_rate).toLocaleString('de-DE')} % erneut angemeldet.`, 'season', 'Kampagne prüfen')
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

async function handleSeasonDisable(req, res, supabase) {
  const context = await seasonContext(supabase, req.body?.vaccinationDateId)
  const user = await authenticateAdmin(req, supabase, context.appointment.club_id)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  const { data, error } = await supabase.from('season_email_campaigns').insert({
    club_id: context.appointment.club_id,
    season_year: context.seasonYear,
    vaccination_date_id: context.appointment.id,
    status: 'disabled',
    created_by: user.id,
    finished_at: new Date().toISOString()
  }).select('status').single()
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Für diese Saison wurde bereits eine Entscheidung gespeichert.' })
  }
  if (error) throw error
  return res.status(200).json({ success: true, status: data.status })
}

async function handleSeasonSend(req, res, supabase) {
  const context = await seasonContext(supabase, req.body?.vaccinationDateId)
  const user = await authenticateAdmin(req, supabase, context.appointment.club_id)
  if (!user) return res.status(403).json({ error: 'Keine Berechtigung für diesen Verein.' })
  if (!context.recipients.length) {
    return res.status(400).json({ error: 'Es sind keine versandfähigen E-Mail-Adressen vorhanden.' })
  }

  let campaign = context.campaign
  if (!campaign) {
    const { data, error } = await supabase.from('season_email_campaigns').insert({
      club_id: context.appointment.club_id,
      season_year: context.seasonYear,
      vaccination_date_id: context.appointment.id,
      status: 'sending',
      created_by: user.id,
      started_at: new Date().toISOString()
    }).select('*').single()
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Der Saisonversand wurde bereits gestartet oder abgeschlossen.' })
    }
    if (error) throw error
    campaign = data
  } else if (campaign.status === 'partial') {
    const { data, error } = await supabase.from('season_email_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('status', 'partial')
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(409).json({ error: 'Der Saisonversand wird bereits verarbeitet.' })
    campaign = data
  } else {
    return res.status(409).json({ error: 'Der Saisonversand wurde bereits gestartet, abgeschlossen oder deaktiviert.' })
  }

  const recipientRows = context.recipients.map(recipient => ({
    campaign_id: campaign.id,
    email_normalized: recipient.email,
    participant_id: recipient.id,
    status: 'pending'
  }))
  const { error: recipientsError } = await supabase
    .from('season_email_recipients')
    .upsert(recipientRows, { onConflict: 'campaign_id,email_normalized', ignoreDuplicates: true })
  if (recipientsError) throw recipientsError
  const { data: pending, error: pendingError } = await supabase
    .from('season_email_recipients')
    .select('id, email_normalized')
    .eq('campaign_id', campaign.id)
    .in('status', ['pending', 'failed'])
  if (pendingError) throw pendingError

  const participantByEmail = new Map(context.recipients.map(recipient => [recipient.email, recipient]))
  const appUrl = process.env.APP_BASE_URL || `https://${req.headers.host}`
  let sent = 0
  let failed = 0
  for (const recipientRow of pending || []) {
    const recipient = participantByEmail.get(recipientRow.email_normalized)
    if (!recipient) continue
    const token = unsubscribeToken(context.appointment.club_id, recipient.email)
    const unsubscribeUrl = `${appUrl}/api/send-reminder-emails?action=unsubscribe&token=${encodeURIComponent(token)}`
    try {
      const result = await resend.emails.send({
        from: 'RGZV Hagen <onboarding@resend.dev>',
        to: recipient.email,
        subject: 'Die neue Newcastle-Impfsaison ist eröffnet',
        html: `
          <p>Guten Tag,</p>
          <p>Sie haben im vergangenen Jahr an einer Sammelimpfung über den Impfgruppenmanager teilgenommen.</p>
          <p>Für die neue Impfsaison wurde inzwischen der erste Impftermin veröffentlicht. Die Anmeldung ist ab sofort möglich.</p>
          <p>Dank der integrierten Teilnehmererkennung können Ihre bisherigen Stammdaten bei einer erneuten Anmeldung auf Wunsch übernommen werden. Tierzahl, Impfstoff und Impftermin wählen Sie selbstverständlich erneut aus.</p>
          <p><a href="${appUrl}/#signup" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#f28c28;color:#fff;text-decoration:none;font-weight:700">Jetzt zur neuen Impfsaison anmelden</a></p>
          ${emailSignatureHtml()}
          <hr style="margin:28px 0 18px;border:0;border-top:1px solid #e5e7eb">
          <p style="font-size:13px;color:#64748b">Sie erhalten diese Nachricht, weil Sie im vergangenen Jahr an einer Sammelimpfung teilgenommen und dabei Ihre E-Mail-Adresse angegeben haben.</p>
          <p style="font-size:13px"><a href="${unsubscribeUrl}">Erinnerungsmails künftig nicht mehr erhalten</a></p>
        `
      }, { idempotencyKey: `season/${campaign.id}/${recipientRow.id}` })
      if (result.error) throw new Error(result.error.message || 'E-Mail-Versand fehlgeschlagen.')
      await supabase.from('season_email_recipients').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: result.data?.id || null,
        last_error: null
      }).eq('id', recipientRow.id).neq('status', 'sent')
      sent += 1
    } catch (error) {
      await supabase.from('season_email_recipients').update({
        status: 'failed',
        last_error: String(error.message || error).slice(0, 1000)
      }).eq('id', recipientRow.id).neq('status', 'sent')
      failed += 1
    }
  }

  const { data: recipientStatuses, error: statusError } = await supabase
    .from('season_email_recipients')
    .select('status')
    .eq('campaign_id', campaign.id)
  if (statusError) throw statusError
  const totalSent = (recipientStatuses || []).filter(recipient => recipient.status === 'sent').length
  const totalFailed = (recipientStatuses || []).filter(recipient => recipient.status === 'failed').length
  const status = totalFailed > 0 ? 'partial' : 'sent'
  await supabase.from('season_email_campaigns').update({
    status,
    sent_count: totalSent,
    failed_count: totalFailed,
    finished_at: new Date().toISOString()
  }).eq('id', campaign.id).eq('status', 'sending')
  const { error: syncError } = await supabase.rpc('sync_season_campaign_returns', {
    target_campaign_id: campaign.id
  })
  if (syncError) throw syncError
  return res.status(200).json({ success: true, status, sent: totalSent, failed: totalFailed })
}

async function handleUnsubscribe(req, res, supabase) {
  const decoded = verifyUnsubscribeToken(req.query?.token)
  if (!decoded) return res.status(400).send('Der Abmeldelink ist ungültig.')
  const { error } = await supabase.from('season_email_preferences').upsert({
    club_id: decoded.clubId,
    email_normalized: normalizeEmail(decoded.email),
    unsubscribed: true,
    unsubscribed_at: new Date().toISOString()
  }, { onConflict: 'club_id,email_normalized' })
  if (error) throw error
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send('<!doctype html><html lang="de"><meta charset="utf-8"><title>Erinnerungen deaktiviert</title><body style="font-family:system-ui;padding:48px;color:#1f2937"><h1>Erinnerungen deaktiviert</h1><p>Sie erhalten künftig keine saisonalen Erinnerungsmails mehr.</p></body></html>')
}

async function handleExistingReminder(req, res, supabase) {
  const { vaccinationDateId, type, newTime, newMeetingPoint } = req.body || {}
  const { data: participants, error } = await supabase
    .from('participants')
    .select('*')
    .eq('vaccination_date_id', vaccinationDateId)
    .eq('payment_status', 'bezahlt')
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
    if (req.method === 'GET' && req.query?.action === 'unsubscribe') {
      return await handleUnsubscribe(req, res, supabase)
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const action = req.body?.action
    if (action === 'smart-assistant') return await handleSmartAssistant(req, res, supabase)
    if (action === 'campaign-dashboard') return await handleCampaignDashboard(req, res, supabase)
    if (action === 'campaign-detail') return await handleCampaignDetail(req, res, supabase)
    if (action === 'season-status') return await handleSeasonStatuses(req, res, supabase)
    if (action === 'season-preview') return await handleSeasonPreview(req, res, supabase)
    if (action === 'season-disable') return await handleSeasonDisable(req, res, supabase)
    if (action === 'season-send') return await handleSeasonSend(req, res, supabase)
    return await handleExistingReminder(req, res, supabase)
  } catch (error) {
    const status = error.code === 'TEST_APPOINTMENT' ? 400 : error.code === 'NOT_FIRST_REGULAR' ? 409 : 500
    return res.status(status).json({ error: error.message || 'Saisonerinnerung konnte nicht verarbeitet werden.' })
  }
}
