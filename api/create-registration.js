import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { createAdminSupabase, verifyPaymentReturnToken } from '../server/_supabase-admin.js'
import { saveRegistrationWithConfirmation } from '../server/registration-confirmation.js'
import { canEditRegistration, validEmail } from '../server/mail-rules.js'
import manageRegistration from '../server/manage-registration.js'
import { handleMembershipRequest, registrationTariff } from '../server/membership-tariff.js'
import { registrationFailure } from '../server/registration-errors.js'

const fields = ['firstname', 'lastname', 'street', 'housenumber', 'zipcode', 'city', 'email', 'phone', 'tsk_number']
const REGISTRATION_VACCINE = 'Newcastle'
const ANIMAL_COUNT_FIELDS = [
  { field: 'chicken_count', label: 'Hühner' },
  { field: 'bantam_count', label: 'Zwerghühner' },
  { field: 'turkey_count', label: 'Puten' }
]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_LIFETIME_MS = 10 * 60 * 1000
const PROFILE_FIELDS = 'firstname, lastname, street, housenumber, zipcode, city, phone, tsk_number, animal_type'
const REGISTRATION_PAYMENT_METHODS = new Set(['paypal', 'stripe', 'bar'])

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function parseAnimalCount(value) {
  if (value === '' || value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null
  const count = Number(value)
  return Number.isSafeInteger(count) && count >= 0 ? count : null
}

export function buildAnimalRegistration(input = {}) {
  const counts = Object.fromEntries(
    ANIMAL_COUNT_FIELDS.map(({ field }) => [field, parseAnimalCount(input[field])])
  )
  if (Object.values(counts).some(count => count === null)) {
    return { error: 'Die Tierzahlen sind ungültig.' }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (total < 1) {
    return { error: 'Bitte geben Sie für mindestens eine Tierart eine Anzahl ein.' }
  }

  const animalType = ANIMAL_COUNT_FIELDS
    .filter(({ field }) => counts[field] > 0)
    .map(({ label }) => label)
    .join(', ')

  return { counts, total, animalType }
}

export function normalizeRegistrationPaymentMethod(value) {
  const paymentMethod = String(value || 'paypal').trim().toLowerCase()
  return REGISTRATION_PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : null
}

function tokenSecret() {
  const secret = process.env.PARTICIPANT_LOOKUP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Participant lookup is not configured.')
  return secret
}

function sign(payload) {
  return createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
}

function createLookupToken(email, clubId) {
  const expiresAt = Date.now() + TOKEN_LIFETIME_MS
  const signature = sign(`${email}|${clubId}|${expiresAt}`)
  return `${expiresAt}.${signature}`
}

function isValidLookupToken(token, email, clubId) {
  const [expiresAt, signature] = String(token || '').split('.')
  if (!expiresAt || !signature || Number(expiresAt) < Date.now()) return false

  const expected = sign(`${email}|${clubId}|${expiresAt}`)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

async function getClubId(supabase, slug) {
  const { data, error } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', String(slug || '').trim())
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function getLatestParticipant(supabase, email, clubId, select) {
  const escapedEmail = email.replace(/[\\%_]/g, character => `\\${character}`)
  const { data, error } = await supabase
    .from('participants')
    .select(select)
    .eq('club_id', clubId)
    .ilike('email', escapedEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function handleParticipantLookup(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const { lookupAction, email: rawEmail, slug, lookupToken } = req.body || {}
    const email = normalizeEmail(rawEmail)
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' })
    }

    const supabase = createAdminSupabase()
    const clubId = await getClubId(supabase, slug)

    if (lookupAction === 'check') {
      if (!clubId) return res.status(200).json({ found: false })

      const participant = await getLatestParticipant(supabase, email, clubId, 'created_at')
      return res.status(200).json({
        found: Boolean(participant),
        lookupToken: participant ? createLookupToken(email, clubId) : undefined
      })
    }

    if (lookupAction === 'retrieve') {
      if (!clubId || !isValidLookupToken(lookupToken, email, clubId)) {
        return res.status(400).json({ error: 'Die Datenübernahme ist nicht mehr gültig.' })
      }

      const participant = await getLatestParticipant(supabase, email, clubId, PROFILE_FIELDS)
      if (!participant) return res.status(404).json({ error: 'Keine frühere Anmeldung gefunden.' })

      return res.status(200).json({ profile: participant })
    }

    return res.status(400).json({ error: 'Ungültige Anfrage.' })
  } catch (error) {
    console.error('Teilnehmer-Wiederanmeldung fehlgeschlagen:', error)
    return res.status(500).json({
      error: 'Die automatische Datenübernahme ist derzeit nicht verfügbar.'
    })
  }
}

async function handlePaymentCancellation(req, res) {
  const provider = String(req.body?.provider || '').toLowerCase()
  if (!['paypal', 'stripe'].includes(provider)) {
    return res.status(400).json({ error: 'Ungültiger Zahlungsanbieter.' })
  }
  const tokenData = verifyPaymentReturnToken(req.body?.cancelToken, provider)
  if (!tokenData) return res.status(400).json({ error: 'Die Abbruchbestätigung ist ungültig oder abgelaufen.' })

  const supabase = createAdminSupabase()
  const { data: participant } = await supabase
    .from('participants')
    .select('vaccination_date_id')
    .eq('id', tokenData.participantId)
    .maybeSingle()
  if (participant?.vaccination_date_id) {
    const { data: appointment } = await supabase
      .from('vaccination_dates')
      .select('archived')
      .eq('id', participant.vaccination_date_id)
      .maybeSingle()
    if (appointment?.archived) {
      return res.status(409).json({ error: 'Dieser Impftermin ist bereits abgeschlossen. Änderungen an der Anmeldung sind nicht mehr möglich.' })
    }
  }
  let updateQuery = supabase
    .from('participants')
    .update({ registration_status: 'cancelled' })
    .eq('id', tokenData.participantId)
    .eq('registration_status', 'pending_payment')
    .eq('payment_status', 'offen')
    .is('payment_method', null)
    .is('payment_id', null)
  if (provider === 'paypal') updateQuery = updateQuery.not('paypal_order_id', 'is', null)
  const { data, error } = await updateQuery.select('id').maybeSingle()
  if (error) throw error
  return res.status(200).json({ success: true, cancelled: Boolean(data) })
}

export const config = { maxDuration: 60 }
export function createRegistrationHandler({ createDb = createAdminSupabase, transport, scheduleMail } = {}) {
return async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.body?.action === 'manage-registration') {
    try { return await manageRegistration(req, res, {db:createDb(),transport}) } catch { return res.status(500).json({ error: 'Die Anmeldung konnte nicht verarbeitet werden.' }) }
  }
  if (req.body?.action === 'lookup-participant') return handleParticipantLookup(req, res)
  if (req.body?.action === 'cancel-payment') return handlePaymentCancellation(req, res)
  if (['membership-challenge','membership-verify','registration-price'].includes(req.body?.action)) {
    try { return await handleMembershipRequest(req,res,createDb(),{transport}) }
    catch (error) {
      console.error('MEMBERSHIP_VERIFICATION_FAILED',{code:['EAUTH','SMTP_CONFIG','PGRST202','42P01','42883'].includes(error.code)?error.code:'VERIFICATION_ERROR'})
      return res.status(error.publicMessage?400:503).json({error:error.publicMessage||'Die E-Mail-Prüfung ist derzeit nicht verfügbar. Bitte später erneut versuchen oder den gültigen Mitgliedercode verwenden.'})
    }
  }

  const reference=randomUUID()
  let stage='VALIDATE_REQUEST'
  try {
    const { vaccination_date_id: vaccinationDateId, member_code: memberCode, ...input } = req.body || {}
    if (!vaccinationDateId || !input.firstname || !input.lastname || !input.email || !input.tsk_number) {
      return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' })
    }
    const animalRegistration = buildAnimalRegistration(input)
    if (animalRegistration.error) {
      return res.status(400).json({ error: animalRegistration.error })
    }
    const paymentMethod = 'bar'
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Die ausgewählte Zahlungsart ist nicht zulässig.' })
    }
    const {
      counts: animalCounts,
      total: animalCount,
      animalType
    } = animalRegistration
    stage='SERVER_CONFIG'
    const supabase = createDb()
    stage='APPOINTMENT_LOOKUP'
    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates').select('*').eq('id', vaccinationDateId).single()
    if (appointmentError) throw appointmentError
    if (!appointment) return res.status(400).json({ error: 'Ungültiger Impftermin.' })
    if (appointment.archived) {
      return res.status(409).json({ error: 'Dieser Impftermin ist bereits abgeschlossen. Änderungen an der Anmeldung sind nicht mehr möglich.' })
    }
    const normalizedEmail = normalizeEmail(input.email)
    if (!validEmail(normalizedEmail)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' })
    if (!canEditRegistration(appointment)) return res.status(409).json({ error: 'Die Anmeldung für diesen Impftermin ist geschlossen.' })
    // Public mail links are validated by the mail builder after the atomic commit.
    // A broken APP_URL must not discard a valid registration and its durable job.
    stage='DUPLICATE_LOOKUP'
    const escapedEmail = normalizedEmail.replace(/[\\%_]/g, character => `\\${character}`)
    const { data: existingRegistration, error: duplicateError } = await supabase
      .from('participants')
      .select('registration_status')
      .eq('club_id', appointment.club_id)
      .eq('vaccination_date_id', vaccinationDateId)
      .ilike('email', escapedEmail)
      .in('registration_status', ['pending_payment', 'completed', 'bar_registered'])
      .limit(1)
      .maybeSingle()
    if (duplicateError) throw duplicateError
    if (existingRegistration?.registration_status === 'pending_payment') {
      return res.status(409).json({ error: 'Für diese E-Mail-Adresse besteht bereits eine noch nicht abgeschlossene Onlinezahlung.' })
    }
    if (existingRegistration) {
      return res.status(409).json({ error: 'Für diese E-Mail-Adresse besteht bereits eine verbindliche Anmeldung zu diesem Impftermin.' })
    }
    stage='TARIFF_LOOKUP'
    const tariff = await registrationTariff(supabase,{clubId:appointment.club_id,appointmentId:appointment.id,email:normalizedEmail,memberCode,proof:input.membership_proof,deferMembershipFailure:true})
    const participant = Object.fromEntries(fields.map(field => [field, typeof input[field] === 'string' ? input[field].trim() : input[field]]))
    stage='REGISTRATION_COMMIT'
    const data = await saveRegistrationWithConfirmation(supabase, {
      ...participant,
      email: normalizedEmail,
      vaccine: REGISTRATION_VACCINE,
      animal_type: animalType,
      animal_count: animalCount,
      ...animalCounts,
      vaccination_date_id: vaccinationDateId,
      club_id: appointment.club_id,
      is_member: tariff.isMember,
      payment_status: 'offen',
      payment_amount: tariff.amount,
      payment_method: paymentMethod === 'bar' ? 'bar' : null,
      registration_status: paymentMethod === 'bar' ? 'bar_registered' : 'pending_payment'
    }, { transport, reference, scheduleMail, tariff: { member_code: String(memberCode||''), verified_email: tariff.verifiedEmail, tariff_review_required:tariff.reviewRequired===true } })
    console.info('REGISTRATION_SAVED',{reference,participantId:data.id,emailStatus:data.emailStatus,
      quotedTariffSource:tariff.source,paymentAmount:Number(data.payment_amount),tariffReviewRequired:data.tariff_review_required===true})

    return res.status(201).json({
      participantId: data.id,
      paymentAmount: Number(data.payment_amount),
      emailSent: data.emailSent,
      emailStatus: data.emailStatus,
      tariffReviewRequired:data.tariff_review_required===true,
      notice:data.tariff_review_required===true?'Ihre Anmeldung ist verbindlich gespeichert. Die Mitgliedschaft konnte noch nicht abschließend geprüft werden; der ausgewiesene reguläre Betrag ist bis zur Klärung durch den Verein vorläufig.':null
    })
  } catch (error) {
    if (error.publicMessage) return res.status(400).json({error:error.publicMessage})
    const failure=registrationFailure(error,stage)
    console.error('REGISTRATION_FAILED',{reference,...failure.diagnostic})
    return res.status(failure.status).json({error:`${failure.text} Referenz: ${reference}`,reference})
  }
}
}

export default createRegistrationHandler({ scheduleMail: waitUntil })
