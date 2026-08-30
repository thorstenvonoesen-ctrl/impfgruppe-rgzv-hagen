import { createAdminSupabase } from './_supabase-admin.js'

function currentDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function selectNextAppointment(dates, todayKey) {
  return (dates || []).find(appointment => appointment.date > todayKey) || null
}

function isMissingArchiveColumn(error) {
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return detail.includes('archived') && (detail.includes('column') || detail.includes('schema cache') || detail.includes('42703'))
}

async function loadActiveDates(supabase, clubId) {
  const publicFields = 'id,date,title,venue_name,street,house_number,postal_code,city,address_public'
  let result = await supabase
    .from('vaccination_dates')
    .select(`${publicFields},archived`)
    .eq('club_id', clubId)
    .or('archived.eq.false,archived.is.null')
    .order('date', { ascending: true })

  // Keep existing appointments visible during a deployment where application
  // code reaches production before the additive archive migration.
  if (result.error && isMissingArchiveColumn(result.error)) {
    result = await supabase
      .from('vaccination_dates')
      .select(publicFields)
      .eq('club_id', clubId)
      .order('date', { ascending: true })
  }
  return result
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const slug = String(req.query?.slug || '').trim()
    if (!slug) return res.status(400).json({ error: 'Verein fehlt.' })
    const supabase = createAdminSupabase()
    const { data: club } = await supabase
      .from('clubs')
      .select('id,name,slug')
      .eq('slug', slug)
      .maybeSingle()
    if (!club) return res.status(404).json({ error: 'Verein nicht gefunden.' })
    const { data: dates, error: datesError } = await loadActiveDates(supabase, club.id)
    if (datesError) throw datesError
    // A date without an explicit event time is considered completed once its
    // calendar day has started. Always advance to the following appointment so
    // the public countdown and its statistics refer to the same record.
    const activeAppointment = selectNextAppointment(dates, currentDateKey())
    let participants = []
    if (activeAppointment) {
      const { data, error } = await supabase
        .from('participants')
        .select('animal_count')
        .eq('club_id', club.id)
        .eq('vaccination_date_id', activeAppointment.id)
        .in('registration_status', ['completed', 'bar_registered'])
      if (error) throw error
      participants = data || []
    }
    return res.status(200).json({
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug
      },
      participants: participants?.length || 0,
      animals: (participants || []).reduce((sum, item) => sum + Number(item.animal_count || 0), 0),
      activeAppointment,
      dates: dates || []
    })
  } catch (error) {
    return res.status(500).json({ error: 'Statistik konnte nicht geladen werden.' })
  }
}
