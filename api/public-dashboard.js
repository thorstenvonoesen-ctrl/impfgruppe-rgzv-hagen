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
    const { data: dates, error: datesError } = await supabase
      .from('vaccination_dates')
      .select('id,date,title,venue_name,street,house_number,postal_code,city,address_public')
      .eq('club_id', club.id)
      .order('date', { ascending: true })
    if (datesError) throw datesError
    const activeAppointment = (dates || []).find(appointment => appointment.date >= currentDateKey()) || null
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
