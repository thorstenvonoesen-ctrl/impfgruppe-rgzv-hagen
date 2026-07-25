import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminSupabase } from './_supabase-admin.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_LIFETIME_MS = 10 * 60 * 1000
const PROFILE_FIELDS = 'firstname, lastname, street, housenumber, zipcode, city, phone, tsk_number, animal_type'

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, email: rawEmail, slug, lookupToken } = req.body || {}
    const supabase = createAdminSupabase()

    if (action === 'check') {
      const email = normalizeEmail(rawEmail)
      if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' })
      }

      const clubId = await getClubId(supabase, slug)
      if (!clubId) return res.status(200).json({ found: false })

      const participant = await getLatestParticipant(supabase, email, clubId, 'created_at')
      return res.status(200).json({
        found: Boolean(participant),
        lookupToken: participant ? createLookupToken(email, clubId) : undefined
      })
    }

    if (action === 'retrieve') {
      const email = normalizeEmail(rawEmail)
      if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' })
      }

      const clubId = await getClubId(supabase, slug)
      if (!clubId || !isValidLookupToken(lookupToken, email, clubId)) {
        return res.status(400).json({ error: 'Die Datenübernahme ist nicht mehr gültig.' })
      }

      const participant = await getLatestParticipant(
        supabase,
        email,
        clubId,
        PROFILE_FIELDS
      )
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
