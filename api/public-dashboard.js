import { createAdminSupabase } from './_supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const slug = String(req.query?.slug || '').trim()
    if (!slug) return res.status(400).json({ error: 'Verein fehlt.' })
    const supabase = createAdminSupabase()
    const { data: club } = await supabase.from('clubs').select('*').eq('slug', slug).maybeSingle()
    if (!club) return res.status(404).json({ error: 'Verein nicht gefunden.' })
    const [{ data: participants, error: participantsError }, { data: dates, error: datesError }] = await Promise.all([
      supabase.from('participants').select('animal_count').eq('club_id', club.id),
      supabase.from('vaccination_dates').select('date,title,venue_name,street,house_number,postal_code,city,address_public').eq('club_id', club.id).order('date', { ascending: true })
    ])
    if (participantsError || datesError) throw participantsError || datesError
    return res.status(200).json({
      club,
      participants: participants?.length || 0,
      animals: (participants || []).reduce((sum, item) => sum + Number(item.animal_count || 0), 0),
      dates: dates || []
    })
  } catch (error) {
    return res.status(500).json({ error: 'Statistik konnte nicht geladen werden.' })
  }
}
