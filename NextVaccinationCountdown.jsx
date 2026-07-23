import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function NextVaccinationCountdown() {
  const [nextDate, setNextDate] = useState(null)
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    loadNextDate()
  }, [])

  useEffect(() => {
    if (!nextDate) return

    const timer = setInterval(() => {
      const now = new Date()
      const target = new Date(nextDate)

      const diff = target - now

      if (diff <= 0) {
        loadNextDate()
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)

      setRemaining(
        `${days} Tage · ${hours} Stunden · ${minutes} Minuten · ${seconds} Sekunden`
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [nextDate])

  async function loadNextDate() {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('vaccination_dates')
      .select('date')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()

    setNextDate(data?.date ?? null)
  }

  if (!nextDate) {
    return null
  }

  return (
    <div
      style={{
        color: '#f28c28',
        fontSize: '17px',
        fontWeight: 400,
        whiteSpace: 'nowrap',
        marginTop: '8px'
      }}
    >
      ⏳ Nächster Impftermin: {new Date(nextDate).toLocaleDateString('de-DE')} • Noch {remaining}
    </div>
  )
}
