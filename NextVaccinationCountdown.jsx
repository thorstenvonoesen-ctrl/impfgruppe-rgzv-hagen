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
        `${days} Tage • ${hours} Std • ${minutes} Min • ${seconds} Sek`
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [nextDate])

  async function loadNextDate() {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('vaccination_dates')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()

    if (data) {
      setNextDate(data.date)
    } else {
      setNextDate(null)
    }
  }

  if (!nextDate) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '14px',
          color: '#ffffff',
          fontSize: '16px'
        }}
      >
        🩺 Zurzeit ist kein Impftermin geplant.
      </div>
    )
  }

  return (
    <div
      style={{
        textAlign: 'right',
        padding: '14px 10px',
        background: 'rgba(255,255,255,.04)',
        borderBottom: '1px solid rgba(255,255,255,.08)'
      }}
    >
      <div
        style={{
          color: '#f28c28',
          fontWeight: 700,
          fontSize: '15px',
          marginBottom: '4px'
        }}
      >
        🩺 Nächster Impftermin
      </div>

      <div
        style={{
          color: '#ffffff',
          fontSize: '15px'
        }}
      >
        {new Date(nextDate).toLocaleDateString('de-DE')}
      </div>

      <div
        style={{
          color: '#d8d8d8',
          fontSize: '14px',
          marginTop: '4px'
        }}
      >
        Noch {remaining}
      </div>
    </div>
  )
}
