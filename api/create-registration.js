import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminSupabase } from './_supabase-admin.js'
import { sendParticipantEmail } from './send-payment-email.js'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.body?.action === 'lookup-participant') return handleParticipantLookup(req, res)

  try {
    const { vaccination_date_id: vaccinationDateId, member_code: memberCode, ...input } = req.body || {}
    if (!vaccinationDateId || !input.firstname || !input.lastname || !input.email || !input.tsk_number) {
      return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' })
    }
    const animalRegistration = buildAnimalRegistration(input)
    if (animalRegistration.error) {
      return res.status(400).json({ error: animalRegistration.error })
    }
    const paymentMethod = normalizeRegistrationPaymentMethod(input.payment_method)
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Die ausgewählte Zahlungsart ist nicht zulässig.' })
    }
    const {
      counts: animalCounts,
      total: animalCount,
      animalType
    } = animalRegistration
    const supabase = createAdminSupabase()
    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates').select('club_id').eq('id', vaccinationDateId).single()
    if (appointmentError || !appointment) return res.status(400).json({ error: 'Ungültiger Impftermin.' })
    const { data: club } = await supabase.from('clubs').select('member_code').eq('id', appointment.club_id).single()
    const isMember = Boolean(memberCode && club?.member_code && memberCode.trim().toUpperCase() === club.member_code.trim().toUpperCase())
    const participant = Object.fromEntries(fields.map(field => [field, typeof input[field] === 'string' ? input[field].trim() : input[field]]))
    const { data, error } = await supabase.from('participants').insert({
      ...participant,
      vaccine: REGISTRATION_VACCINE,
      animal_type: animalType,
      animal_count: animalCount,
      ...animalCounts,
      vaccination_date_id: vaccinationDateId,
      club_id: appointment.club_id,
      is_member: isMember,
      payment_status: 'offen',
      payment_amount: isMember ? 5 : 10,
      payment_method: paymentMethod === 'bar' ? 'bar' : null
    }).select('id, payment_amount').single()
    if (error) throw error

    let emailSent
    if (paymentMethod === 'bar') {
      try {
        const emailResult = await sendParticipantEmail({
          participantId: data.id,
          emailType: 'bar-registration'
        })
        emailSent = Boolean(emailResult?.success)
      } catch (emailError) {
        emailSent = false
        console.error('Anmeldebestätigung für Barzahlung konnte nicht versendet werden:', emailError)
      }
    }

    return res.status(201).json({
      participantId: data.id,
      paymentAmount: Number(data.payment_amount),
      ...(paymentMethod === 'bar' ? { emailSent } : {})
    })
  } catch (error) {
    return res.status(500).json({ error: 'Anmeldung konnte nicht gespeichert werden.' })
  }
}
