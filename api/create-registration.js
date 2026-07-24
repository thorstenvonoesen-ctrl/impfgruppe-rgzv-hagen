import { createAdminSupabase } from './_supabase-admin.js'

const fields = ['firstname', 'lastname', 'street', 'housenumber', 'zipcode', 'city', 'email', 'phone', 'tsk_number', 'animal_type', 'vaccine']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { vaccination_date_id: vaccinationDateId, animal_count: animalCount, member_code: memberCode, ...input } = req.body || {}
    if (!vaccinationDateId || !input.firstname || !input.lastname || !input.email || !input.tsk_number || !input.vaccine || !animalCount) {
      return res.status(400).json({ error: 'Bitte alle Pflichtfelder ausfüllen.' })
    }
    const supabase = createAdminSupabase()
    const { data: appointment, error: appointmentError } = await supabase
      .from('vaccination_dates').select('club_id').eq('id', vaccinationDateId).single()
    if (appointmentError || !appointment) return res.status(400).json({ error: 'Ungültiger Impftermin.' })
    const { data: club } = await supabase.from('clubs').select('member_code').eq('id', appointment.club_id).single()
    const isMember = Boolean(memberCode && club?.member_code && memberCode.trim().toUpperCase() === club.member_code.trim().toUpperCase())
    const participant = Object.fromEntries(fields.map(field => [field, typeof input[field] === 'string' ? input[field].trim() : input[field]]))
    const { data, error } = await supabase.from('participants').insert({
      ...participant,
      animal_count: Number(animalCount),
      vaccination_date_id: vaccinationDateId,
      club_id: appointment.club_id,
      is_member: isMember,
      payment_status: 'offen',
      payment_amount: isMember ? 5 : 10
    }).select('id, payment_amount').single()
    if (error) throw error
    return res.status(201).json({ participantId: data.id, paymentAmount: Number(data.payment_amount) })
  } catch (error) {
    return res.status(500).json({ error: 'Anmeldung konnte nicht gespeichert werden.' })
  }
}
