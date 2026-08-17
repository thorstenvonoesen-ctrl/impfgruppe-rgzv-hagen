import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Syringe, ShieldCheck, Users, Euro, Download, Search, Lock, LogOut, CalendarDays, Navigation, FileText, CreditCard, Mail, QrCode, Check, Clock, ScanLine, FileX, Settings2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { supabase, hasSupabase, supabaseConfigMessage } from './supabase.js'
import { createPoultryQuizRound, poultryQuizMeta } from './quizQuestions.js'
async function getDefaultClubId() {
  if (!hasSupabase) return null

  const { data, error } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', getCurrentSlug())
    .maybeSingle()

  if (error) {
  console.error('Club konnte nicht geladen werden:', error)
  return null
}

console.log('Club-Datensatz:', data)

return data?.id ?? null
}
function getCurrentSlug() {
  const path = window.location.pathname
    .replace(/^\/+|\/+$/g, '')

  if (path) return path

  return APP.slug
}
import './styles.css'
import logo from './public/Logoklein.jpg'
import pdfWatermarkLogo from './public/LogoTransparent.png'
import { APP } from './config'
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || ''
const MEMBER_CODE = 'RGZV2026'
const PAYPAL_ENABLED = false
const STRIPE_ENABLED = false
const PDF_WATERMARK_OPACITY = 0.1
const PDF_WATERMARK_WIDTH_RATIO = 0.62
const PDF_WATERMARK_ASPECT_RATIO = 1772 / 748
let pdfWatermarkImagePromise

function loadPdfWatermarkImage() {
  if (!pdfWatermarkImagePromise) {
    pdfWatermarkImagePromise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Das PDF-Wasserzeichen konnte nicht geladen werden.'))
      image.src = pdfWatermarkLogo
    })
  }
  return pdfWatermarkImagePromise
}

async function addPdfWatermark(doc) {
  const image = await loadPdfWatermarkImage()
  const pageCount = doc.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const watermarkWidth = pageWidth * PDF_WATERMARK_WIDTH_RATIO
    const watermarkHeight = watermarkWidth / PDF_WATERMARK_ASPECT_RATIO
    const x = (pageWidth - watermarkWidth) / 2
    const y = (pageHeight - watermarkHeight) / 2
    const pageContent = doc.internal.pages[pageNumber]
    const originalCommandCount = pageContent.length

    doc.setGState(new doc.GState({ opacity: PDF_WATERMARK_OPACITY }))
    doc.addImage(image, 'PNG', x, y, watermarkWidth, watermarkHeight, undefined, 'FAST')
    doc.setGState(new doc.GState({ opacity: 1 }))

    const watermarkCommands = pageContent.splice(originalCommandCount)
    pageContent.unshift(...watermarkCommands)
  }
}
const weatherPreviewCache = new Map()

function PremiumBackground() {
  const pointerLightRef = useRef(null)

  useEffect(() => {
    const supportsPointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!supportsPointer.matches || prefersReducedMotion.matches || !pointerLightRef.current) return

    const pointerLight = pointerLightRef.current
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let currentX = targetX
    let currentY = targetY
    let frameId

    const updateTarget = event => {
      targetX = event.clientX
      targetY = event.clientY
    }

    const animate = () => {
      currentX += (targetX - currentX) * 0.055
      currentY += (targetY - currentY) * 0.055
      pointerLight.style.setProperty('--premium-pointer-x', `${currentX}px`)
      pointerLight.style.setProperty('--premium-pointer-y', `${currentY}px`)
      frameId = requestAnimationFrame(animate)
    }

    window.addEventListener('pointermove', updateTarget, { passive: true })
    frameId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('pointermove', updateTarget)
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className="premium-background" aria-hidden="true">
      <div className="premium-orb premium-orb-one" />
      <div className="premium-orb premium-orb-two" />
      <div className="premium-orb premium-orb-three" />
      <div ref={pointerLightRef} className="premium-pointer-light" />
    </div>
  )
}

function emptyForm() {
  return {
  firstname:'',
  lastname:'',
  street:'',
  housenumber:'',
  zipcode:'',
  city:'',
  email:'',
  phone:'',
tsk_number:'',
chicken_count:'',
bantam_count:'',
turkey_count:'',
vaccine:'Newcastle',
  vaccination_date_id:'',
member_code:''
}
}

const participantAnimalCountFields = [
  { field: 'chicken_count', label: 'Hühner' },
  { field: 'bantam_count', label: 'Zwerghühner' },
  { field: 'turkey_count', label: 'Puten' }
]

function participantAnimalBreakdown(participant) {
  const hasStructuredCounts = participantAnimalCountFields.some(
    ({ field }) => participant?.[field] !== null && participant?.[field] !== undefined
  )
  if (hasStructuredCounts) {
    return participantAnimalCountFields
      .map(({ field, label }) => ({ label, count: Number(participant?.[field] || 0) }))
      .filter(item => item.count > 0)
  }
  const legacyCount = Number(participant?.animal_count || 0)
  return legacyCount > 0
    ? [{ label: participant?.animal_type || 'Tiere', count: legacyCount }]
    : []
}

function formatParticipantAnimals(participant) {
  const breakdown = participantAnimalBreakdown(participant)
  const total = Number(participant?.animal_count || breakdown.reduce((sum, item) => sum + item.count, 0))
  const details = breakdown.map(item => `${item.count} ${item.label}`).join(', ')
  return details ? `${details} – Gesamt: ${total}` : `Gesamt: ${total}`
}

function checkedInParticipantsForVaccinationDate(participants, vaccinationDate) {
  if (!vaccinationDate?.id) return []
  return participants.filter(participant =>
    isBindingRegistration(participant) &&
    participant.checked_in === true &&
    String(participant.vaccination_date_id) === String(vaccinationDate.id) &&
    (!vaccinationDate.club_id || String(participant.club_id) === String(vaccinationDate.club_id))
  )
}

const bindingRegistrationStatuses = new Set(['completed', 'bar_registered'])
const registrationStatusLabels = {
  pending_payment: 'Onlinezahlung noch nicht abgeschlossen',
  completed: 'Verbindlich angemeldet',
  bar_registered: 'Verbindlich angemeldet · Barzahlung vor Ort',
  cancelled: 'Zahlung abgebrochen',
  expired: 'Zahlungsversuch abgelaufen',
  payment_failed: 'Zahlung fehlgeschlagen'
}
function isBindingRegistration(participant) {
  return bindingRegistrationStatuses.has(participant?.registration_status)
}

function App() {
  const [page, setPage] = useState(location.hash || '#')
const [showForm, setShowForm] = useState(false)
  
  useEffect(() => {
    const onHash = () => setPage(location.hash || '#')

    addEventListener('hashchange', onHash)

    return () =>
      removeEventListener('hashchange', onHash)
  }, [])
  if (location.pathname === '/admin-invite') return <AdminInvitePassword />
  if (page === '#info') return <InfoPage />
  if (page === '#info-newcastle') return <InfoNewcastle />
  if (page === '#info-pflicht') return <InfoPflicht />
  if (page === '#info-sammelimpfung') return <InfoSammelimpfung />
  if (page === '#info-anmeldung') return <InfoAnmeldung />
  if (page === '#impfwart-grusswort') return <ImpfwartGrusswort />
  if (page === '#vorsitzender-grusswort') return <VorsitzenderGrusswort />
  if (page === '#lust-auf-verein') return <LustAufVerein />
  if (page === '#quiz') return <PoultryQuiz />
if (page === '#signup') return <PublicSignup />
  if (page === '#admin') return <Admin />
  if (page === '#datenschutz') return <Datenschutz />
  if (page === '#impressum') return <Impressum />
if (page === '#register') return <ClubRegistration />
  if (page === '#register-info') return <RegisterInfo />
  if (page === '#club-login-info') return <ClubLoginInfo />
  if (page === '#club-login') return <ClubLogin />
  if (page === '#club-dashboard') return <ClubDashboard />
  if (page === '#') return <ClubSelect />
return <PublicSignup />
}

function AdminInvitePassword() {
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let active = true
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.user?.invited_at) setSessionReady(true)
    })

    async function establishInviteSession() {
      try {
        const inviteUrl = new URL(window.location.href)
        const authorizationCode = inviteUrl.searchParams.get('code')
        const hashParameters = new URLSearchParams(inviteUrl.hash.replace(/^#/, ''))
        const accessToken = hashParameters.get('access_token')
        const refreshToken = hashParameters.get('refresh_token')

        let session = null
        if (authorizationCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authorizationCode)
          if (error) throw error
          session = data.session
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          if (error) throw error
          session = data.session
        } else {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          session = data.session
        }

        if (!session) throw new Error('Invite session is missing.')
        const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token)
        if (userError || !userData.user?.invited_at) throw userError || new Error('Invite user is missing.')
        if (!active) return
        window.history.replaceState({}, '', '/admin-invite')
        setSessionReady(true)
      } catch (error) {
        console.error('Admin-Einladung: Sitzung konnte nicht übernommen werden.', error)
        if (active) {
          setSessionReady(false)
          setMessage('Der Einladungslink ist ungültig oder abgelaufen.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    establishInviteSession()
    return () => {
      active = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  async function savePassword() {
    setMessage('')
    if (!password || password !== passwordConfirmation) {
      setMessage('Bitte geben Sie das Passwort in beiden Feldern identisch ein.')
      return
    }
    setSaving(true)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const session = sessionData?.session
    const { data: userData, error: userError } = session
      ? await supabase.auth.getUser(session.access_token)
      : { data: { user: null }, error: sessionError }
    if (sessionError || userError || !session || !userData.user?.invited_at) {
      console.error('Admin-Einladung: Keine gültige Invite-Sitzung beim Passwortspeichern.', sessionError || userError)
      setMessage('Das Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.')
      setSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      console.error('Admin-Einladung: Passwort konnte nicht gespeichert werden.', error)
      setMessage('Das Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.')
      setSaving(false)
      return
    }
    await supabase.auth.signOut()
    setPassword('')
    setPasswordConfirmation('')
    setSuccess(true)
    setSaving(false)
  }

  return (
    <div className="page admin-login-page">
      <Header />
      <main className="admin-login-shell">
        <section className="card admin-login-card">
          <div className="admin-login-icon"><Lock size={28}/></div>
          <div className="admin-login-heading">
            <span>RGZV Hagen</span>
            <h2>Persönliches Passwort festlegen</h2>
          </div>
          {loading && <p>Einladung wird geprüft …</p>}
          {!loading && success && (
            <>
              <p>Ihr Passwort wurde gespeichert. Sie können sich jetzt im Adminbereich anmelden.</p>
              <a className="primary admin-login-submit" href="/#admin">Zum Admin-Login</a>
            </>
          )}
          {!loading && !success && sessionReady && (
            <>
              <label className="admin-login-field"><span>Passwort</span><input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label>
              <label className="admin-login-field"><span>Passwort bestätigen</span><input value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} type="password" autoComplete="new-password" /></label>
              <button className="primary admin-login-submit" onClick={savePassword} disabled={saving}>{saving ? 'Passwort wird gespeichert …' : 'Passwort speichern'}</button>
            </>
          )}
          {message && <p role="alert" className="admin-login-error">{message}</p>}
        </section>
      </main>
      <Footer />
    </div>
  )
}


function ClubLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const navigate = hash => (window.location.hash = hash)

  return (
    <div className="container">
      <h2>Vereins-Login</h2>

      <input
        placeholder="E-Mail"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        type="password"
        placeholder="Passwort"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={() => navigate('#club-dashboard')}>
        Anmelden
      </button>
    </div>
  )
}

function ClubDashboard() {
  return (
    <div className="container">
      <h2>Vereins-Dashboard</h2>
      <p>Dieser Bereich wird Schritt für Schritt aufgebaut.</p>
    </div>
  )
}

function emptyVaccinationAddress() {
  return { venue_name: '', street: '', house_number: '', postal_code: '', city: '', address_public: false }
}
function AnimatedMetric({ value, currency = false }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(value)
      return
    }
    const duration = 1200
    const start = performance.now()
    let frame
    const animate = now => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(value * eased)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return currency
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(displayed)
    : Math.round(displayed).toLocaleString('de-DE')
}

function getAppointmentDetails(appointment) {
  if (!appointment) return null
  const timeMatch = appointment.title?.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)
  const time = timeMatch?.[0] || null
  const target = new Date(`${appointment.date}T${time || '00:00'}:00`)
  return { ...appointment, time, target }
}

function getNextAppointment(dates) {
  const now = Date.now()
  return (dates || []).map(getAppointmentDetails).find(appointment => appointment.target.getTime() > now) || null
}

function formatVaccinationAddress(appointment) {
  if (!appointment) return []
  const venue = appointment.venue_name?.trim()
  const street = [appointment.street, appointment.house_number].filter(Boolean).join(' ').trim()
  const locality = [appointment.postal_code, appointment.city].filter(Boolean).join(' ').trim()
  return [venue, street, locality].filter(Boolean)
}

function hasVaccinationRouteAddress(appointment) {
  return Boolean(appointment?.city?.trim())
}

function getVaccinationRouteAddress(appointment) {
  return formatVaccinationAddress(appointment).join(', ')
}

function openVaccinationRoute(appointment) {
  const destination = getVaccinationRouteAddress(appointment)
  if (!destination) return
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank', 'noopener,noreferrer')
}

function getWeatherLocation(club, appointment) {
  const appointmentAddress = formatVaccinationAddress(appointment)
  if (appointment?.postal_code && appointment?.city) return `${appointment.postal_code} ${appointment.city}`
  if (appointment?.city) return appointment.city
  if (appointmentAddress.length) return appointmentAddress.join(', ')
  if (!club) return null
  const directLocation = club.weather_location || club.location || club.venue || club.city || club.place
  if (typeof directLocation === 'string' && directLocation.trim()) return directLocation.trim()
  const address = [club.address, club.street, club.zipcode, club.city].filter(Boolean).join(', ')
  return address || null
}

function weatherInfo(code) {
  if (code === 0) return { icon: '☀️', label: 'Sonnig' }
  if ([1, 2].includes(code)) return { icon: '⛅', label: 'Leicht bewölkt' }
  if (code === 3) return { icon: '☁️', label: 'Bedeckt' }
  if ([45, 48].includes(code)) return { icon: '🌫️', label: 'Neblig' }
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: '🌦️', label: 'Nieselregen' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: '🌧️', label: 'Regnerisch' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: '❄️', label: 'Schnee' }
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', label: 'Gewitter' }
  return { icon: '🌤️', label: 'Wechselhaft' }
}

async function loadWeatherPreview(location, date) {
  const cacheKey = `${location}|${date}`
  if (weatherPreviewCache.has(cacheKey)) return weatherPreviewCache.get(cacheKey)

  const request = (async () => {
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de&format=json`
    const geocodingResponse = await fetch(geocodingUrl)
    if (!geocodingResponse.ok) throw new Error('Ort nicht verfügbar')
    const geocodingData = await geocodingResponse.json()
    const place = geocodingData.results?.[0]
    if (!place) throw new Error('Ort nicht verfügbar')

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`
    const forecastResponse = await fetch(forecastUrl)
    if (!forecastResponse.ok) throw new Error('Wetter nicht verfügbar')
    const forecastData = await forecastResponse.json()
    const code = forecastData.daily?.weather_code?.[0]
    const temperature = forecastData.daily?.temperature_2m_max?.[0]
    const precipitation = forecastData.daily?.precipitation_probability_max?.[0]
    if (typeof code !== 'number' || typeof temperature !== 'number') throw new Error('Wetter nicht verfügbar')
    return { ...weatherInfo(code), temperature, precipitation: Number(precipitation || 0) }
  })()

  weatherPreviewCache.set(cacheKey, request)
  try {
    return await request
  } catch (error) {
    weatherPreviewCache.delete(cacheKey)
    throw error
  }
}

function WeatherPreview({ location, date }) {
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    let active = true
    const targetDate = new Date(`${date}T00:00:00`)
    const daysUntil = Math.ceil((targetDate.getTime() - Date.now()) / 86400000)
    if (!location) {
      setStatus('unavailable')
      return () => { active = false }
    }
    if (daysUntil > 16) {
      setStatus('later')
      return () => { active = false }
    }
    setStatus('loading')
    loadWeatherPreview(location, date)
      .then(data => { if (active) { setWeather(data); setStatus('ready') } })
      .catch(() => { if (active) setStatus('unavailable') })
    return () => { active = false }
  }, [location, date])

  if (status === 'later') return <button type="button" className="appointment-weather-button" disabled title="Erst kurz vor dem Impftermin verfügbar">🌤 Wettervorhersage</button>
  if (status === 'unavailable') return <button type="button" className="appointment-weather-button" disabled title="Wettervorhersage derzeit nicht verfügbar">🌤 Wettervorhersage</button>
  if (status !== 'ready' || !weather) return <button type="button" className="appointment-weather-button" disabled>🌤 Wetter wird geladen</button>

  return <button type="button" className="appointment-weather-button appointment-weather-ready" title={`Regenwahrscheinlichkeit: ${weather.precipitation} %`}>{weather.icon} {Math.round(weather.temperature)} °C · {weather.label}</button>
}

function AppointmentCountdown({ appointments, club, isAdmin }) {
  const [now, setNow] = useState(Date.now())
  const appointment = useMemo(() => getNextAppointment(appointments), [appointments, now])

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [appointments])

  if (!appointment) return <strong className="dashboard-stat-date">Aktuell ist kein neuer Impftermin geplant.</strong>

  const difference = Math.max(0, appointment.target.getTime() - now)
  const days = Math.floor(difference / 86400000)
  const hours = Math.floor((difference / 3600000) % 24)
  const minutes = Math.floor((difference / 60000) % 60)
  const seconds = Math.floor((difference / 1000) % 60)
  const routeAddress = getVaccinationRouteAddress(appointment)
  const showPublicAddress = Boolean(appointment.address_public) && hasVaccinationRouteAddress(appointment)
  const canOpenRoute = hasVaccinationRouteAddress(appointment) && (isAdmin || Boolean(appointment.address_public))

  return (
    <div className="appointment-countdown">
      <strong>{appointment.title}</strong>
      <small>{appointment.target.toLocaleDateString('de-DE')}{appointment.time ? ` · ${appointment.time} Uhr` : ''}</small>
      <div className="appointment-countdown-units" aria-label={`Noch ${days} Tage, ${hours} Stunden, ${minutes} Minuten und ${seconds} Sekunden`}>
        <span><b>{days}</b><small>Tage</small></span>
        <span><b>{hours}</b><small>Stunden</small></span>
        <span><b>{minutes}</b><small>Minuten</small></span>
        <span className="appointment-countdown-seconds"><b key={seconds}>{seconds}</b><small>Sekunden</small></span>
      </div>
      {showPublicAddress && <small className="appointment-public-address">{routeAddress}</small>}
      <div className="appointment-action-buttons">
        {canOpenRoute && <button type="button" className="appointment-route-button" onClick={() => openVaccinationRoute(appointment)}><Navigation size={14} />{isAdmin ? 'Route prüfen' : 'Route starten'}</button>}
        <WeatherPreview location={getWeatherLocation(club, appointment)} date={appointment.date} />
      </div>
    </div>
  )
}

function InteractiveStatCard({ className, icon, label, value, loading, currency = false, appointmentDates = [], club = null, isAppointment = false, isAdmin = false, tone = '', animationIndex = 0 }) {
  const updateTilt = event => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const rotateX = ((event.clientY - bounds.top) / bounds.height - .5) * -4
    const rotateY = ((event.clientX - bounds.left) / bounds.width - .5) * 5
    event.currentTarget.style.setProperty('--stat-rotate-x', `${rotateX}deg`)
    event.currentTarget.style.setProperty('--stat-rotate-y', `${rotateY}deg`)
  }
  const resetTilt = event => {
    event.currentTarget.style.removeProperty('--stat-rotate-x')
    event.currentTarget.style.removeProperty('--stat-rotate-y')
  }

  return (
    <div className={`${className} dashboard-stat-card ${tone}`} style={{ '--dashboard-delay': `${animationIndex * 120}ms` }} onMouseMove={updateTilt} onMouseLeave={resetTilt}>
      <div className="dashboard-stat-icon">{icon}</div>
      <div className="dashboard-stat-content">
        <span>{label}</span>
        {loading ? <i className="dashboard-stat-skeleton" aria-label="Daten werden geladen" /> : isAppointment ? <AppointmentCountdown appointments={appointmentDates} club={club} isAdmin={isAdmin} /> : <strong><AnimatedMetric value={Number(value || 0)} currency={currency} /></strong>}
      </div>
    </div>
  )
}

const HOME_BENEFITS = [
  [Clock, 'Anmeldung in wenigen Minuten', 'Schnell erledigt', 'Die Anmeldung dauert in der Regel nur wenige Minuten und kann vollständig online abgeschlossen werden.'],
  [CreditCard, 'Sichere Onlinezahlung', 'Flexibel bezahlen', 'Bezahlen Sie bequem per PayPal, Kreditkarte oder – falls angeboten – per Barzahlung am Impftermin.'],
  [Mail, 'QR-Code automatisch per E-Mail', 'Direkt per E-Mail', 'Ihren persönlichen QR-Code erhalten Sie automatisch per E-Mail. Dieser dient am Impftag zum schnellen Check-in.'],
  [FileX, 'Kein Papier am Impftag', 'Alles digital', 'Ihre Anmeldung liegt bereits digital vor. Zusätzliche Formulare müssen am Impftag nicht mitgebracht werden.'],
  [ScanLine, 'Schneller Check-in', 'Ein Scan genügt', 'QR-Code vorzeigen, scannen lassen und direkt einchecken – schnell und unkompliziert.'],
  [Settings2, 'Weniger Verwaltungsaufwand', 'Mehr Zeit fürs Wesentliche', 'Digitale Teilnehmerlisten, Zahlungsübersichten und Auswertungen erleichtern die Organisation der Impfgruppe.']
]

function HomeBenefitInfoField({ benefit, index, isOpen, onOpen, onClose, onToggle }) {
  const [Icon, label, title, description] = benefit
  const fieldRef = useRef(null)
  const popoverRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const popoverId = `home-benefit-info-${index}`

  const updatePopoverPosition = () => {
    const field = fieldRef.current
    const popover = popoverRef.current
    if (!field || !popover) return

    const fieldBounds = field.getBoundingClientRect()
    const viewportGap = 12
    const fieldGap = 10
    const width = Math.min(320, window.innerWidth - viewportGap * 2)
    popover.style.setProperty('--benefit-popover-width', `${width}px`)
    const popoverBounds = popover.getBoundingClientRect()
    const height = popoverBounds.height
    const centeredLeft = fieldBounds.left + fieldBounds.width / 2 - width / 2
    const left = Math.min(
      Math.max(centeredLeft, viewportGap),
      window.innerWidth - width - viewportGap
    )
    const fitsBelow = fieldBounds.bottom + fieldGap + height <= window.innerHeight - viewportGap
    const top = fitsBelow
      ? fieldBounds.bottom + fieldGap
      : Math.max(viewportGap, fieldBounds.top - height - fieldGap)

    popover.style.setProperty('--benefit-popover-left', `${left}px`)
    popover.style.setProperty('--benefit-popover-top', `${top}px`)
    popover.dataset.placement = fitsBelow ? 'below' : 'above'
  }

  useLayoutEffect(() => {
    if (!isOpen) return undefined
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [isOpen])

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), [])

  const handleMouseEnter = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = window.setTimeout(onOpen, 250)
  }

  const handleMouseLeave = () => {
    window.clearTimeout(hoverTimerRef.current)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) onClose()
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      onClose()
      event.currentTarget.blur()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <>
      <div
        ref={fieldRef}
        className={`home-benefit-info-field${isOpen ? ' is-open' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popoverId : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={event => {
          if (event.currentTarget.matches(':focus-visible')) onOpen()
        }}
        onBlur={onClose}
        onKeyDown={handleKeyDown}
        onPointerUp={event => {
          if (event.pointerType !== 'mouse') onToggle()
        }}
      >
        <span><Icon size={18} strokeWidth={2}/></span>
        {label}
      </div>
      {createPortal(
        <div
          ref={popoverRef}
          id={popoverId}
          className={`home-benefit-popover${isOpen ? ' is-open' : ''}`}
          role="tooltip"
          aria-hidden={!isOpen}
        >
          <strong>{title}</strong>
          <p>{description}</p>
          <span className="home-benefit-popover-arrow" aria-hidden="true" />
        </div>,
        document.body
      )}
    </>
  )
}

function LiveSignupStats({ club }) {
  const [stats, setStats] = useState({ participants: 0, animals: 0, dates: [] })
  const [ready, setReady] = useState(false)
  const [openBenefitIndex, setOpenBenefitIndex] = useState(null)
  const benefitsRef = useRef(null)

  useEffect(() => {
    let active = true
    async function loadStats() {
      if (!hasSupabase) {
        if (active) setReady(true)
        return
      }
      const response = await fetch(`/api/public-dashboard?slug=${encodeURIComponent(getCurrentSlug())}`)
      const result = response.ok ? await response.json() : null
      if (!active) return
      setStats({
        participants: result?.participants || 0,
        animals: result?.animals || 0,
        dates: result?.dates || []
      })
      setReady(true)
    }
    loadStats()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const closeOpenBenefit = event => {
      if (!benefitsRef.current?.contains(event.target)) setOpenBenefitIndex(null)
    }
    document.addEventListener('pointerdown', closeOpenBenefit)
    return () => document.removeEventListener('pointerdown', closeOpenBenefit)
  }, [])

  return (
    <section className="live-signup-stats home-dashboard-grid" aria-label="Nächster Impftermin und Vorteile der Online-Anmeldung">
      <InteractiveStatCard className="live-stat-card home-countdown-card" icon={<CalendarDays size={30}/>} label="Nächster Impftermin" loading={!ready} appointmentDates={stats.dates} club={club} isAppointment tone="stat-date" animationIndex={0} />
      <div className="home-dashboard-support">
      <div className="home-community-card">
        <div className="home-community-heading">
          <h2>Bereits angemeldet</h2>
        </div>
        <div className="home-community-metrics">
          <div><span><Users size={22}/></span><strong>{ready ? <AnimatedMetric value={Number(stats.participants || 0)}/> : '–'}</strong><small>Geflügelhalter</small></div>
          <div><span><Syringe size={22}/></span><strong>{ready ? <AnimatedMetric value={Number(stats.animals || 0)}/> : '–'}</strong><small>Tiere</small></div>
        </div>
        <p>Bereits für den nächsten Termin angemeldet.</p>
      </div>
      <div className="home-benefits-card premium-home-surface">
        <div className="home-benefits-heading">
          <span>Digital. Sicher. Zeitsparend.</span>
          <h2>Warum online anmelden?</h2>
          <p>Von der Registrierung bis zum Impftag begleitet Sie ein klarer, vollständig digitaler Ablauf.</p>
        </div>
        <div className="home-benefits-list" ref={benefitsRef}>
          {HOME_BENEFITS.map((benefit, index) => (
            <HomeBenefitInfoField
              key={benefit[1]}
              benefit={benefit}
              index={index}
              isOpen={openBenefitIndex === index}
              onOpen={() => setOpenBenefitIndex(index)}
              onClose={() => setOpenBenefitIndex(current => current === index ? null : current)}
              onToggle={() => setOpenBenefitIndex(current => current === index ? null : index)}
            />
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}
function ClubSelect() {
  const [clubs, setClubs] = useState([])

  useEffect(() => {
    async function loadClubs() {
      if (!hasSupabase) return
      const { data } = await supabase
        .from('clubs')
        .select('id,name,slug,guest_price,member_price')
        .order('name')
      setClubs(data || [])
    }

    loadClubs()
  }, [])

  const currentClub = clubs.find(club => club.slug === getCurrentSlug()) || null

  return (
    <div className="page final-home-page">
      <style>{`
        .final-home-page {
          min-height: 100vh !important;
          min-height: 100dvh !important;
          display: flex;
          flex-direction: column;
          background: transparent !important;
        }

        .final-home {
          flex: 1 0 auto;
          width: min(calc(100% - 32px), 1440px);
          margin: 12px auto 0;
          display: grid;
          gap: 16px;
        }

        .final-home-hero {
          min-height: 184px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 166px;
          align-items: center;
          gap: 24px;
          padding: 22px 32px;
          color: #fff;
          overflow: hidden;
          border-radius: 24px;
          background: rgba(255,255,255,.075) !important;
          border: 1px solid rgba(255,255,255,.15) !important;
          box-shadow: 0 18px 44px rgba(0,0,0,.28) !important;
          backdrop-filter: blur(14px);
        }

        .final-home-hero-copy {
          min-width: 0;
          display: grid;
          align-content: center;
        }

        .final-home-hero-copy h1 {
          max-width: 1040px;
          margin: 0;
          color: #fff;
          font-size: clamp(32px, 2.4vw, 36px);
          line-height: .98;
          letter-spacing: -1.8px;
          white-space: nowrap;
        }

        .final-home-hero-copy h2 {
          margin: 10px 0 0;
          color: rgba(255,255,255,.94);
          font-size: clamp(22px, 2vw, 30px);
          line-height: 1.15;
          white-space: nowrap;
        }

        .final-home-hero-copy p {
          max-width: 920px;
          margin: 8px 0 0;
          color: rgba(237,245,241,.78);
          font-size: 14px;
          line-height: 1.35;
          white-space: nowrap;
        }

        .final-home-club-link {
          display: inline-flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 8px 15px;
          color: #f59e0b;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,.38);
          border-radius: 10px;
          background: rgba(255,255,255,.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.13);
          transition: .2s ease;
        }

        .final-home-hero-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          width: min(100%, 940px);
          gap: 12px;
          margin-top: 14px;
        }

        .final-home-club-link:hover {
          background: rgba(255,255,255,.14);
          border-color: rgba(255,255,255,.58);
          transform: translateY(-2px);
        }

        .final-home-logo-stage {
          display: grid;
          place-items: center;
          width: 146px;
          height: 146px;
          justify-self: center;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(242,140,40,.15), rgba(255,255,255,.025) 68%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 16px 34px rgba(0,0,0,.18);
        }

        .final-home-logo-stage img {
          width: 126px;
          height: 126px;
          object-fit: contain;
        }

        .final-home .home-dashboard-grid {
          width: 100%;
          margin: 0 !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1.78fr) minmax(330px, .92fr) !important;
          grid-template-rows: 280px !important;
          gap: 16px !important;
          align-items: stretch;
        }

        .final-home .home-countdown-card {
          grid-column: 1 !important;
          grid-row: 1 !important;
          min-height: 280px !important;
          height: 280px !important;
        }

        .final-home .home-countdown-card.dashboard-stat-card {
          display: grid !important;
          grid-template-columns: 52px minmax(0,1fr) !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 16px 24px !important;
        }

        .final-home .home-countdown-card .dashboard-stat-icon {
          width: 46px !important;
          height: 46px !important;
          border-radius: 12px !important;
        }

        .final-home .home-countdown-card .dashboard-stat-content {
          min-width: 0;
          text-align: center;
        }

        .final-home .home-countdown-card .dashboard-stat-content > span {
          margin: 0 0 2px !important;
          font-size: 10px !important;
          letter-spacing: .12em;
        }

        .final-home .home-countdown-card .appointment-countdown {
          display: grid;
          justify-items: center;
          gap: 2px;
        }

        .final-home .home-countdown-card .appointment-countdown strong {
          font-size: clamp(27px, 2.6vw, 38px) !important;
          line-height: 1 !important;
        }

        .final-home .home-countdown-card .appointment-countdown > small {
          font-size: 11px !important;
          line-height: 1.2;
        }

        .final-home .home-countdown-card .appointment-countdown-units {
          width: min(100%, 430px) !important;
          margin-top: 4px !important;
          gap: 6px !important;
        }

        .final-home .home-countdown-card .appointment-countdown-units > span {
          min-height: 57px !important;
          padding: 5px 6px !important;
          border-radius: 11px !important;
        }

        .final-home .home-countdown-card .appointment-countdown-units b {
          font-size: clamp(25px, 2.4vw, 33px) !important;
          line-height: .95 !important;
        }

        .final-home .home-countdown-card .appointment-countdown-units small {
          margin-top: 3px !important;
          font-size: 7px !important;
        }

        .final-home .home-countdown-card .appointment-public-address {
          margin-top: 2px !important;
          font-size: 10px !important;
        }

        .final-home .appointment-action-buttons {
          width: min(100%, 400px) !important;
          margin-top: 0;
          gap: 10px !important;
        }

        .final-home .appointment-action-buttons .appointment-route-button,
        .final-home .appointment-weather-button {
          min-height: 33px !important;
          margin-top: 3px !important;
          padding: 6px 14px !important;
          font-size: 10px !important;
          border-radius: 10px !important;
        }

        .final-home .home-dashboard-support {
          grid-column: 2 !important;
          grid-row: 1 !important;
          display: grid !important;
          grid-template-columns: 1fr !important;
          grid-template-rows: 92px 172px !important;
          gap: 16px !important;
          min-width: 0;
        }

        .final-home .home-community-card {
          grid-column: auto !important;
          grid-row: auto !important;
          min-height: 0 !important;
          padding: 7px 11px !important;
        }

        .final-home .home-community-heading h2 {
          margin: 0 0 2px !important;
          font-size: 17px !important;
        }

        .final-home .home-community-metrics {
          margin: 0 !important;
          gap: 8px !important;
        }

        .final-home .home-community-metrics > div {
          min-height: 46px !important;
          padding: 3px 7px !important;
        }

        .final-home .home-community-metrics span {
          width: 27px !important;
          height: 27px !important;
        }

        .final-home .home-community-metrics strong {
          font-size: 26px !important;
        }

        .final-home .home-community-metrics small {
          font-size: 8px !important;
        }

        .final-home .home-community-card > p {
          margin-top: 1px !important;
          font-size: 9px !important;
          line-height: 1.15 !important;
        }

        .final-home .home-benefits-card {
          grid-column: auto !important;
          grid-row: auto !important;
          min-height: 0 !important;
          padding: 10px 14px !important;
          gap: 5px !important;
        }

        .final-home .home-benefits-heading > span {
          font-size: 8px !important;
        }

        .final-home .home-benefits-heading h2 {
          margin: 2px 0 !important;
          font-size: 18px !important;
        }

        .final-home .home-benefits-heading p {
          margin: 0 !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
        }

        .final-home .home-benefits-list {
          gap: 3px !important;
        }

        .final-home .home-benefits-list > div {
          min-height: 26px !important;
          padding: 2px 6px !important;
          gap: 6px !important;
          font-size: 9px !important;
          border-radius: 9px !important;
        }

        .final-home .home-benefits-list > div > span {
          width: 22px !important;
          height: 22px !important;
          border-radius: 7px !important;
        }

        .final-home .home-benefits-list svg {
          width: 13px !important;
          height: 13px !important;
        }

        .final-home-nav {
          display: grid;
          grid-template-columns: minmax(0,1fr);
          gap: 16px;
        }

        .final-home-nav-card {
          min-height: 118px;
          display: grid;
          grid-template-columns: 42px minmax(0,1fr) auto;
          grid-template-rows: 1fr;
          gap: 12px 16px;
          align-items: center;
          padding: 16px 20px;
          color: #fff;
          text-align: left;
          border-radius: 19px;
          background: rgba(255,255,255,.07) !important;
          border: 1px solid rgba(255,255,255,.14) !important;
          box-shadow: 0 15px 36px rgba(0,0,0,.24) !important;
          cursor: pointer;
          transition: transform .2s ease, border-color .2s ease, background .2s ease;
        }

        .final-home-nav-card:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,.1) !important;
          border-color: rgba(255,255,255,.25) !important;
        }

        .final-home-nav-primary {
          border-color: rgba(242,140,40,.44) !important;
          background: linear-gradient(135deg, rgba(105,75,34,.55), rgba(20,65,48,.42)) !important;
        }

        .final-home-nav-icon {
          grid-column: 1;
          grid-row: 1;
          font-size: 30px;
          line-height: 1;
        }

        .final-home-nav-text {
          grid-column: 2;
          grid-row: 1;
          min-width: 0;
        }

        .final-home-nav-text strong {
          display: block;
          margin-bottom: 7px;
          color: #fff;
          font-size: 18px;
          line-height: 1.15;
        }

        .final-home-nav-text small {
          display: block;
          color: rgba(237,245,241,.76);
          font-size: 12px;
          line-height: 1.38;
        }

        .final-home-nav-text em {
          display: block;
          margin-top: 4px;
          color: #f28c28;
          font-size: 10px;
          font-style: normal;
          font-weight: 800;
        }

        .final-home-nav-action {
          grid-column: 3;
          grid-row: 1;
          justify-self: end;
          padding: 11px 16px;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          border-radius: 9px;
          background: #f28c28;
        }

        .final-home-page > footer {
          margin-top: 12px;
          padding-top: 16px !important;
          padding-bottom: 16px !important;
          font-size: 12px !important;
        }

        .final-home-page > footer .footer-content {
          width: min(100%, 1100px);
          margin: 0 auto;
          line-height: 1.65;
        }

        .final-home-page > footer .footer-signature {
          margin-top: 5px;
        }

        @media (min-width: 1081px) {
          .final-home {
            margin-top: 12px;
            gap: 16px;
            align-content: space-evenly;
          }

          .final-home-hero {
            min-height: 184px;
            padding-top: 22px;
            padding-bottom: 22px;
          }

          .final-home-hero-actions {
            margin-top: 14px;
          }

          .final-home-logo-stage {
            width: 146px;
            height: 146px;
          }

          .final-home-logo-stage img {
            width: 126px;
            height: 126px;
          }

          .final-home .home-dashboard-grid {
            grid-template-rows: 280px !important;
            gap: 16px !important;
          }

          .final-home .home-countdown-card {
            min-height: 280px !important;
            height: 280px !important;
          }

          .final-home .home-countdown-card.dashboard-stat-card {
            padding-top: 16px !important;
            padding-bottom: 16px !important;
          }

          .final-home .home-countdown-card .appointment-countdown {
            gap: 2px;
          }

          .final-home .home-countdown-card .appointment-countdown-units {
            margin-top: 4px !important;
          }

          .final-home .appointment-action-buttons {
            margin-top: 0;
          }

          .final-home .home-dashboard-support {
            grid-template-rows: 92px 172px !important;
            gap: 16px !important;
          }

          .final-home .home-community-card {
            padding-top: 7px !important;
            padding-bottom: 7px !important;
          }

          .final-home .home-benefits-card {
            padding-top: 10px !important;
            padding-bottom: 10px !important;
            gap: 5px !important;
          }

          .final-home-nav-card {
            min-height: 118px;
            padding-top: 16px;
            padding-bottom: 16px;
          }

          .final-home-page > footer {
            flex: 0 0 auto;
            margin-top: 12px;
            padding-top: 16px !important;
            padding-bottom: 16px !important;
          }
        }

        @media (min-width: 1200px) and (min-height: 850px) {
          .final-home-page {
            min-height: 100vh;
            overflow: visible;
          }
        }

        @media (max-width: 1080px) {
          .final-home-page {
            height: auto;
            overflow: visible;
          }

          .final-home {
            width: min(calc(100% - 28px), 920px);
          }

          .final-home-hero {
            grid-template-columns: minmax(0,1fr) 135px;
            padding: 22px;
          }

          .final-home-hero-copy h1,
          .final-home-hero-copy h2,
          .final-home-hero-copy p {
            white-space: normal;
          }

          .final-home-logo-stage {
            width: 125px;
            height: 125px;
          }

          .final-home-logo-stage img {
            width: 106px;
            height: 106px;
          }

          .final-home-hero-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .final-home .home-dashboard-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto !important;
          }

          .final-home .home-countdown-card {
            height: auto !important;
            min-height: 260px !important;
          }

          .final-home .home-dashboard-support {
            grid-column: 1 !important;
            grid-row: 2 !important;
            grid-template-columns: 1fr 1.25fr !important;
            grid-template-rows: auto !important;
          }

          .final-home-nav {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .final-home-hero {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .final-home-logo-stage {
            grid-row: 1;
            margin: 0 auto;
          }

          .final-home-hero-actions {
            width: 100%;
            grid-template-columns: 1fr;
          }

          .final-home-club-link {
            width: 100%;
            white-space: normal;
          }

          .final-home .home-countdown-card.dashboard-stat-card {
            grid-template-columns: 1fr !important;
          }

          .final-home .home-countdown-card .dashboard-stat-icon {
            margin: 0 auto;
          }

          .final-home .home-dashboard-support {
            grid-template-columns: 1fr !important;
          }

          .final-home-nav-card {
            min-height: 0;
            grid-template-columns: 38px minmax(0,1fr);
            grid-template-rows: auto auto;
            padding: 16px;
          }

          .final-home-nav-action {
            grid-column: 1 / -1;
            grid-row: 2;
            width: 100%;
            justify-self: stretch;
            text-align: center;
          }
        }
      `}</style>

      <Header />

      <main className="final-home">
        <section className="home-command-center">
          <div className="home-command-intro">
            <section className="final-home-hero premium-home-surface">
              <div className="final-home-hero-copy">
                <h1>Online-Anmeldung beim RGZV Hagen und Umgebung seit 1903 e.V.</h1>
                <h2>zur Newcastle-Sammelimpfung</h2>
                <p>Geflügelbestand sicher online anmelden, bequem bezahlen und am Impftag digital einchecken.</p>

                <div className="final-home-hero-actions">
                  <a
                    className="final-home-club-link"
                    href="https://www.rgzv-hagen-westfalen.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    RGZV Hagen kennenlernen
                  </a>
                  <a className="final-home-club-link" href="#lust-auf-verein">
                    ❤️ Lust auf Verein?
                  </a>
                </div>
              </div>

              <div className="final-home-logo-stage" aria-hidden="true">
                <img src="/shield-orange.png" alt="" />
              </div>
            </section>

            <section className="final-home-nav" aria-label="Weitere Bereiche">
              <button
                type="button"
                className="final-home-nav-card final-home-nav-primary premium-home-surface"
                onClick={() => { window.location.hash = '#info' }}
              >
                <span className="final-home-nav-icon" aria-hidden="true">👥</span>
                <span className="final-home-nav-text">
                  <strong>Zur Impfanmeldung</strong>
                  <small>Direkt zur Anmeldung Ihrer Tiere für den nächsten Impftermin des RGZV Hagen.</small>
                </span>
                <span className="final-home-nav-action">Zur Impfanmeldung →</span>
              </button>
            </section>
          </div>

          <aside className="home-command-data" aria-label="Impftermin und Anmeldung">
            <LiveSignupStats club={currentClub} />
          </aside>
        </section>
      </main>

      <Footer showDeveloper />
    </div>
  )
}

function ImpfwartGrusswort() {
  const paragraphs = [
    'ich freue mich sehr, Sie auf der Online-Anmeldeseite zu unseren Sammelimpfungen begrüßen zu dürfen.',
    'Als Impfwart des RGZV Hagen und Umgebung seit 1903 e. V. ist es mir ein besonderes Anliegen, Sie bei der verantwortungsvollen Haltung und Versorgung Ihrer Tiere bestmöglich zu unterstützen. Die Gesundheit unserer Geflügelbestände steht dabei immer an erster Stelle.',
    'Mit dem Impfgruppenmanager möchten wir Ihnen die Anmeldung zu unseren Impfterminen so einfach, bequem und übersichtlich wie möglich machen. Sie können die für die Organisation erforderlichen Angaben in Ruhe eingeben und erhalten alle wichtigen Informationen zu Ihrem gewählten Impftermin.',
    'Gleichzeitig hilft uns die digitale Anmeldung dabei, die Anzahl der teilnehmenden Tierhalter und Tiere frühzeitig zu erfassen. Dadurch können wir den benötigten Impfstoff bedarfsgerecht bestellen und den Ablauf der jeweiligen Impfaktion zuverlässig vorbereiten.',
    'Eine regelmäßige und ordnungsgemäße Impfung ist ein wichtiger Bestandteil einer verantwortungsvollen Geflügelhaltung. Sie dient nicht nur dem Schutz des eigenen Tierbestandes, sondern trägt auch dazu bei, die Ausbreitung ansteckender Krankheiten zu verhindern.',
    'Jeder Geflügelhalter übernimmt mit der Teilnahme an einer Sammelimpfung Verantwortung – für seine eigenen Tiere, für die Bestände anderer Halter und für die Gemeinschaft insgesamt. Gerade bei Krankheiten, die sich schnell verbreiten können, sind Vorsorge, Zuverlässigkeit und gemeinsames Handeln von großer Bedeutung.',
    'Unsere Sammelimpfungen sollen allen Geflügelhalterinnen und Geflügelhaltern eine unkomplizierte Möglichkeit bieten, ihre Tiere entsprechend den geltenden Vorgaben schützen zu lassen. Dabei spielt es für uns keine Rolle, ob Sie Mitglied unseres Vereins sind, einem anderen Verein angehören oder Ihre Tiere als Hobbyhalter betreuen. Entscheidend ist das gemeinsame Ziel, unsere Geflügelbestände gesund zu erhalten.',
    'Durch die digitale Anmeldung können wir die Impfaktionen besser planen, Wartezeiten reduzieren und die notwendigen Unterlagen übersichtlich vorbereiten. Dies erleichtert nicht nur unsere Arbeit als Verein, sondern soll auch für Sie zu einem angenehmeren und transparenteren Ablauf führen.',
    'Bitte achten Sie bei der Anmeldung darauf, alle erforderlichen Angaben vollständig und korrekt einzutragen. Besonders wichtig sind die Anzahl und Art der zu impfenden Tiere, der gewünschte Impfstoff, der ausgewählte Impftermin sowie Ihre Kontaktdaten.',
    'Die Impfstoffbestellung erfolgt auf Grundlage der eingegangenen Anmeldungen. Sollten sich Ihre Angaben nachträglich ändern oder sollten Sie einen vereinbarten Termin nicht wahrnehmen können, bitten wir Sie darum, uns möglichst frühzeitig zu informieren. So können wir die Planung entsprechend anpassen und unnötige Kosten oder nicht benötigte Impfstoffmengen vermeiden.',
    'Mir ist bewusst, dass digitale Anmeldesysteme für manche Teilnehmer zunächst ungewohnt sein können. Sollten bei der Anmeldung Fragen oder Schwierigkeiten auftreten, lassen wir Sie selbstverständlich nicht allein. Sprechen Sie uns bitte an, damit wir gemeinsam eine Lösung finden können.',
    'Auch bei allgemeinen Fragen zum Ablauf der Sammelimpfung, zu den benötigten Angaben oder zur Organisation des Impftermins stehe ich Ihnen gerne zur Verfügung.',
    'Ich möchte mich bereits heute herzlich für Ihr Vertrauen, Ihre Unterstützung und Ihre Teilnahme bedanken. Nur durch die Bereitschaft vieler verantwortungsbewusster Geflügelhalter ist es möglich, solche Impfaktionen zuverlässig und regelmäßig durchzuführen.',
    'Mein Dank gilt ebenfalls allen Helferinnen und Helfern, die bei der Vorbereitung, Organisation und Durchführung unserer Impfaktionen mitwirken. Eine gut organisierte Sammelimpfung ist immer eine Gemeinschaftsleistung und ohne ehrenamtliches Engagement kaum möglich.',
    'Der RGZV Hagen und Umgebung seit 1903 e. V. steht seit vielen Jahren für Gemeinschaft, Erfahrung und die verantwortungsvolle Haltung und Zucht von Geflügel. Mit dem Impfgruppenmanager möchten wir traditionelle Vereinsarbeit und moderne Organisation sinnvoll miteinander verbinden.',
    'Unser Ziel ist es, Ihnen einen einfachen Zugang zu unseren Impfangeboten zu ermöglichen und gleichzeitig die notwendigen Abläufe so zuverlässig wie möglich zu gestalten.',
    'Ich wünsche Ihnen viel Freude mit Ihren Tieren, gesunde Bestände, erfolgreiche Zuchtergebnisse und weiterhin viel Begeisterung für unser gemeinsames Hobby.',
    'Ich freue mich darauf, Sie bei einem unserer nächsten Impftermine persönlich begrüßen zu dürfen.'
  ]

  return (
    <div className="page impfwart-greeting-page">
      <Header />
      <main className="impfwart-greeting-shell">
        <article className="impfwart-greeting-card">
          <header className="impfwart-greeting-heading">
            <small>RGZV Hagen und Umgebung seit 1903 e. V.</small>
            <div className="impfwart-greeting-title-row">
              <span aria-hidden="true">🐔</span>
              <h1>Grußwort unseres Impfwartes</h1>
            </div>
          </header>

          <div className="impfwart-greeting-copy">
            <p className="impfwart-greeting-salutation">Liebe Geflügelhalterinnen und Geflügelhalter,</p>
            {paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}

            <div className="impfwart-greeting-signature">
              <p>Mit freundlichen Grüßen</p>
              <strong>Rainer Koplin</strong>
              <span>Impfwart</span>
              <span>RGZV Hagen und Umgebung seit 1903 e. V.</span>
            </div>
          </div>

          <button type="button" className="impfwart-greeting-back" onClick={() => { window.location.hash = '#' }}>
            ← Zurück zur Informationsseite
          </button>
        </article>
      </main>
      <Footer />
    </div>
  )
}

function VorsitzenderGrusswort() {
  const paragraphs = [
    'ich freue mich sehr, Sie auf der Online-Anmeldung zur Newcastle-Sammelimpfung unseres RGZV Hagen und Umgebung seit 1903 e.V. begrüßen zu dürfen.',
    'Unser Verein blickt auf eine über 120-jährige Geschichte zurück. Seit Generationen verbindet uns die Leidenschaft für die Rassegeflügelzucht, der verantwortungsvolle Umgang mit unseren Tieren und eine lebendige Gemeinschaft, in der Erfahrung, gegenseitige Unterstützung und Freundschaft einen hohen Stellenwert haben.',
    'Mit dem Impfgruppenmanager gehen wir einen weiteren Schritt in die Zukunft. Unser Ziel ist es, Ihnen die Anmeldung zur gesetzlich vorgeschriebenen Newcastle-Impfung so einfach, komfortabel und transparent wie möglich zu gestalten. Lange Wartezeiten und unnötiger Papieraufwand gehören damit der Vergangenheit an.',
    'Gleichzeitig bleibt eines unverändert: Der persönliche Kontakt zu unseren Mitgliedern und Gästen steht für uns auch weiterhin an erster Stelle. Moderne Technik soll unsere Vereinsarbeit unterstützen – sie ersetzt jedoch niemals das Miteinander, das unseren Verein seit vielen Jahrzehnten auszeichnet.',
    'Mein besonderer Dank gilt allen ehrenamtlichen Helferinnen und Helfern, unserem Impfwart sowie allen Beteiligten, die mit großem Engagement dazu beitragen, dass unsere Impfgruppen zuverlässig organisiert und durchgeführt werden können.',
    'Ebenso danke ich Ihnen für Ihr Vertrauen in unseren Verein. Mit Ihrer Teilnahme leisten Sie einen wichtigen Beitrag zum Schutz der Tiergesundheit und unterstützen gleichzeitig eine verantwortungsvolle und gesetzeskonforme Geflügelhaltung.',
    'Vielleicht lernen Sie unseren Verein im Rahmen eines Impftermins näher kennen. Wir freuen uns jederzeit über interessierte Gäste und heißen neue Mitglieder herzlich willkommen. Denn ein lebendiger Verein lebt von Menschen, die ihre Begeisterung für unser schönes Hobby teilen und gemeinsam die Zukunft gestalten möchten.',
    'Ich wünsche Ihnen eine angenehme Nutzung unseres Impfgruppenmanagers, eine unkomplizierte Anmeldung und freue mich darauf, Sie bei einem unserer nächsten Impftermine persönlich begrüßen zu dürfen.'
  ]

  return (
    <div className="page impfwart-greeting-page">
      <Header />
      <main className="impfwart-greeting-shell">
        <article className="impfwart-greeting-card">
          <header className="impfwart-greeting-heading">
            <small>RGZV Hagen und Umgebung seit 1903 e. V.</small>
            <div className="impfwart-greeting-title-row">
              <span aria-hidden="true">🐔</span>
              <h1>Grußwort unseres 1. Vorsitzenden</h1>
            </div>
          </header>

          <div className="impfwart-greeting-copy">
            <p className="impfwart-greeting-salutation">
              Liebe Geflügelfreunde,<br />
              liebe Vereinsmitglieder,<br />
              sehr geehrte Gäste,
            </p>
            {paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}

            <div className="impfwart-greeting-signature">
              <p>Mit freundlichen Grüßen</p>
              <strong>Frank Sternal</strong>
              <span>1. Vorsitzender</span>
              <span>RGZV Hagen und Umgebung seit 1903 e.V.</span>
            </div>
          </div>

          <button type="button" className="impfwart-greeting-back" onClick={() => { window.location.hash = '#' }}>
            ← Zurück zur Informationsseite
          </button>
        </article>
      </main>
      <Footer />
    </div>
  )
}

function LustAufVerein() {
  const questions = [
    [
      'Wann treffen wir uns?',
      <>
        <p>Unsere Vereinsabende finden regelmäßig <strong>an jedem ersten Mittwoch im Monat</strong> statt.</p>
        <p>Der genaue Veranstaltungsort kann gelegentlich wechseln und wird deshalb immer aktuell auf unserer Homepage im Laufband bekanntgegeben.</p>
      </>
    ],
    [
      'Muss ich Mitglied sein?',
      <>
        <p>Nein.</p>
        <p>Ganz im Gegenteil.</p>
        <p>Wir freuen uns immer über Gäste, die unseren Verein ganz unverbindlich kennenlernen möchten.</p>
      </>
    ],
    [
      'Kann ich einfach vorbeikommen?',
      <>
        <p>Ja.</p>
        <p>Eine Anmeldung ist nicht erforderlich.</p>
        <p>Schauen Sie einfach vorbei – wir freuen uns darauf, Sie persönlich kennenzulernen.</p>
      </>
    ],
    [
      'Was erwartet mich?',
      <>
        <p>Eine bunt gemischte Gemeinschaft von Menschen, die eines verbindet:</p>
        <p>Die Freude am schönen Rassegeflügel.</p>
        <p>Bei unseren Vereinsabenden wird gefachsimpelt, gelacht, Erfahrungen werden ausgetauscht und natürlich geht es auch um Zucht, Haltung, Ausstellungen und alles, was unser gemeinsames Hobby so besonders macht.</p>
        <p>Ganz gleich, ob Sie gerade erst anfangen oder schon viele Jahre Geflügel halten – bei uns findet jeder ein offenes Ohr und nette Gesprächspartner.</p>
      </>
    ],
    [
      'Wie werde ich Mitglied?',
      <>
        <p>Ganz unkompliziert.</p>
        <p>Sprechen Sie uns einfach bei einem Vereinsabend an.</p>
        <p>Wir beantworten gerne alle Ihre Fragen und freuen uns, wenn wir Sie vielleicht schon bald als neues Mitglied in unserem Verein begrüßen dürfen.</p>
      </>
    ]
  ]

  return (
    <div className="page impfwart-greeting-page membership-info-page">
      <Header />
      <main className="impfwart-greeting-shell">
        <article className="impfwart-greeting-card">
          <header className="impfwart-greeting-heading">
            <small>RGZV Hagen und Umgebung seit 1903 e. V.</small>
            <div className="impfwart-greeting-title-row">
              <span aria-hidden="true">🐔</span>
              <h1>❤️ Lust auf Verein?</h1>
            </div>
          </header>

          <div className="impfwart-greeting-copy membership-info-copy">
            <p className="membership-info-lead"><strong>Vielleicht sind Sie heute wegen der Newcastle-Impfung hier. Vielleicht entdecken Sie aber auch ein neues Hobby, das weit über den Impftag hinausgeht.</strong></p>
            <p>Der <strong>RGZV Hagen und Umgebung seit 1903 e. V.</strong> ist weit mehr als ein Verein für Rassegeflügelzüchter. Wir sind eine Gemeinschaft von Menschen, die ihre Begeisterung für Geflügel teilen, sich gegenseitig unterstützen und gemeinsam viel Freude an unserem schönen Hobby haben.</p>
            <p>Ganz gleich, ob Sie bereits Hühner, Zwerghühner, Tauben, Wachteln oder anderes Geflügel halten oder gerade erst damit beginnen – bei uns sind Sie jederzeit herzlich willkommen.</p>
            <p>Unsere Vereinsabende leben vom Austausch. Hier wird gefachsimpelt, gelacht, voneinander gelernt und natürlich auch über Zucht, Haltung, Gesundheit, Ausstellungen und viele andere Themen rund um unser gemeinsames Hobby gesprochen.</p>
            <p>Niemand muss bereits Erfahrung mitbringen. Viele unserer heutigen Mitglieder haben genauso angefangen – mit Interesse, Neugier und einem ersten Besuch bei einem Vereinsabend.</p>
            <p>Vielleicht entdecken auch Sie die Freude an der Rassegeflügelzucht. Vielleicht möchten Sie Ihre Tiere später einmal auf einer Ausstellung präsentieren oder einfach nette Menschen kennenlernen, die dieselbe Leidenschaft teilen.</p>
            <p>Eines können wir Ihnen versprechen:</p>
            <p className="membership-info-welcome"><strong>Bei uns sind Gäste jederzeit herzlich willkommen.</strong></p>

            <div className="membership-info-questions">
              {questions.map(([question, answer]) => (
                <section key={question}>
                  <h2>{question}</h2>
                  {answer}
                </section>
              ))}
            </div>

            <aside className="membership-info-cta">
              <h2>Neugierig geworden?</h2>
              <p>Dann besuchen Sie uns doch einfach einmal ganz unverbindlich bei einem unserer nächsten Vereinsabende.</p>
              <p>Wenn Sie anschließend Mitglied werden möchten, freuen wir uns natürlich ganz besonders.</p>
            </aside>

            <aside className="membership-info-final">
              <p className="membership-info-final-lead"><strong>Vielleicht sehen wir uns schon beim nächsten Vereinsabend. Wir würden uns freuen, Sie persönlich kennenzulernen!</strong></p>
              <p className="membership-info-final-note">Ganz gleich, ob Sie direkt Mitglied werden möchten, unseren Verein erst noch näher kennenlernen oder zunächst zur Impf-Anmeldung zurückkehren möchten – wählen Sie einfach den für Sie passenden nächsten Schritt.</p>
              <div className="membership-info-final-actions">
                <a
                  href="https://formular.vereinsplaner.com/1c866a08-6853-4d40-9d07-5c64e17bc2ca"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📝 Jetzt Mitglied werden
                </a>
                <a
                  href="https://www.rgzv-hagen-westfalen.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📍 RGZV Hagen kennenlernen
                </a>
                <a
                  href="#signup"
                  onClick={() => window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))}
                >
                  🐔 Zur Impf-Anmeldung
                </a>
              </div>
            </aside>
          </div>

          <button type="button" className="impfwart-greeting-back" onClick={() => { window.location.hash = '#' }}>
            ← Zurück zur Informationsseite
          </button>
        </article>
      </main>
      <Footer />
    </div>
  )
}

function openInfoDetail(hash) {
  window.location.hash = hash
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("info-detail-start")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      })
    })
  })
}

function InfoPage() {
  const [openCard, setOpenCard] = useState(null)
  return (
    <div className="min-h-screen bg-slate-100">
<section
  className="relative overflow-hidden"
  style={{
    background:
      "linear-gradient(135deg,#0f172a 0%,#14532d 100%)"
  }}
>

  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(circle at top right, rgba(249,115,22,.25), transparent 35%)"
    }}
  />

  <div
    className="info-page-layout"
    style={{
      maxWidth: "1280px",
      margin: "0 auto",
      padding: "120px 60px",
      position: "relative",
      zIndex: 2,
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      gap: "64px",
      textAlign: "center"
    }}
  >

    <div className="info-page-hero">

      <h1
        className="info-page-title"
        style={{
          color: "#fff",
          fontSize: "72px",
          lineHeight: "1.05",
          fontWeight: "900",
          margin: 0
        }}
      >
        Newcastle-Sammelimpfung
      </h1>

      <p
        className="info-page-intro"
        style={{
          marginTop: "28px",
          fontSize: "24px",
          lineHeight: "1.8",
          color: "#d1d5db",
          maxWidth: "850px",
          marginLeft: "auto",
          marginRight: "auto"
        }}
      >
        Erfüllen Sie die gesetzliche Impfpflicht bequem online: Bestand anmelden, sicher bezahlen und am Impftag digital einchecken – schnell, übersichtlich und zuverlässig.
      </p>

    </div>

    <section className="info-process" aria-labelledby="info-process-title">
      <div className="info-process-heading">
        <span>Ihr Weg zum Impftermin</span>
        <h2 id="info-process-title">So einfach funktioniert&apos;s</h2>
      </div>
      <div className="info-process-grid">
        {[
          [FileText, 'Anmeldung', 'Teilnehmer online registrieren'],
          [CreditCard, 'Zahlung', 'Sicher online bezahlen'],
          [Mail, 'QR-Code', 'Automatisch per E-Mail erhalten'],
          [QrCode, 'Check-in', 'QR-Code am Impftag scannen'],
          [Syringe, 'Impfung', 'Direkt teilnehmen']
        ].map(([Icon, title, description], index) => (
          <div className={`info-process-step${title === 'QR-Code' ? ' info-process-step-featured' : ''}`} key={title} style={{ '--process-index': index }}>
            {title === 'QR-Code' && <span className="info-process-badge">Digital</span>}
            <div className="info-process-icon"><Icon size={33} strokeWidth={1.8}/></div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>

    <div className="info-process-trust" aria-label="Vorteile des digitalen Ablaufs">
      {[
        'Anmeldung in wenigen Minuten',
        'Sichere Onlinezahlung',
        'QR-Code automatisch per E-Mail',
        'Kein Papier am Impftag erforderlich'
      ].map(benefit => (
        <span key={benefit}><Check size={16} strokeWidth={2.5}/>{benefit}</span>
      ))}
    </div>

      <button
        className="info-page-signup-button"
        onClick={() => (window.location.hash = "#signup")}
        style={{
          margin: "0 auto",
          background: "#f97316",
          color: "#fff",
          border: 0,
          borderRadius: "16px",
          padding: "21px 42px",
          fontSize: "20px",
          fontWeight: "700",
          cursor: "pointer"
        }}
      >
        <span>Jetzt zur Anmeldung</span>
        <span className="info-page-signup-arrow" aria-hidden="true">→</span>
      </button>

   <div
  className="info-page-card-grid"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: "22px"
  }}
>
  {[
  [
    "🛡️",
    "Schutz Ihrer Tiere",
    "Regelmäßige Newcastle-Impfungen schützen Ihren Geflügelbestand zuverlässig und reduzieren das Risiko einer Ausbreitung."
  ],
  [
    "⚖️",
    "Gesetzliche Impfpflicht",
    "Die Newcastle-Impfung ist gesetzlich vorgeschrieben. Mit der App melden Sie Ihren Bestand einfach online an."
  ],
  [
    "👥",
    "Gemeinsame Sammelimpfung",
    "Gemeinsame Termin- und Impfstoffplanung spart Zeit, reduziert den Aufwand und vereinfacht die Organisation."
  ],
  [
    "▣",
    "QR-Check-in",
    "Nach erfolgreicher Zahlung erhalten Sie Ihren persönlichen QR-Code. Am Impftag genügt ein kurzer Scan."
  ]
].map(([icon, title, text]) => (
    <div
      className="info-page-card"
      key={title}
      onClick={() => {
  if (title === "Schutz Ihrer Tiere") {
    openInfoDetail("#info-newcastle")
  } else if (title === "Gesetzliche Impfpflicht") {
    openInfoDetail("#info-pflicht")
  } else if (title === "Gemeinsame Sammelimpfung") {
    openInfoDetail("#info-sammelimpfung")
  }
        else if (title === "QR-Check-in") {
  openInfoDetail("#info-anmeldung")
}
}}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.06))",
        border: "1px solid rgba(255,255,255,.20)",
        backdropFilter: "blur(12px)",
        borderRadius: "22px",
        padding: "34px",
        boxShadow: "0 20px 44px rgba(0,0,0,.3)",
cursor: "pointer",
transition: "all .25s ease",
        overflow: "hidden",
minHeight: openCard === title ? "360px" : "230px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center"
      }}
    >
      <div className="info-page-card-icon" style={{ fontSize: "48px" }}>
        {icon}
      </div>

      <h3
        style={{
          color: "#fff",
          marginTop: "18px",
          marginBottom: 0,
          fontSize: "22px"
        }}
      >
        {title}
      </h3>
      <p
  style={{
    color: "#d1d5db",
    lineHeight: "1.7",
    marginTop: "14px",
    marginBottom: 0,
    fontSize: "15px"
  }}
>
  {text}
</p>
      {openCard === title && (
  <div
    style={{
      marginTop: "20px",
      padding: "18px",
      borderRadius: "14px",
      background: "rgba(255,255,255,.10)",
      color: "#ffffff",
      lineHeight: "1.8",
      fontSize: "15px"
    }}
  >
    {title === "Schutz Ihrer Tiere" && (
      <>
        Die regelmäßige Newcastle-Impfung schützt Ihren Geflügelbestand
        zuverlässig vor einer hochansteckenden Viruserkrankung und trägt
        gleichzeitig zum Schutz aller Geflügelhalter bei.
      </>
    )}

    {title === "Gesetzliche Impfpflicht" && (
      <>
        Die Newcastle-Impfung ist für bestimmte Geflügelarten gesetzlich
        vorgeschrieben. Mit der Teilnahme an der Sammelimpfung erfüllen Sie
        diese Verpflichtung einfach und nachvollziehbar.
      </>
    )}

    {title === "Gemeinsame Sammelimpfung" && (
      <>
        Durch die gemeinsame Bestellung und Organisation des Impfstoffes
        werden Kosten reduziert, Wartezeiten verkürzt und die Ausgabe
        effizient vorbereitet.
      </>
    )}

    {title === "QR-Check-in" && (
      <>
        Der persönliche QR-Code wird nach erfolgreicher Zahlung direkt in
        der Bestätigungs-E-Mail bereitgestellt und beschleunigt die Anmeldung
        beim Impftermin.
      </>
    )}
  </div>
)}
      <div
  style={{
    marginTop: "auto",
    paddingTop: "22px",
    color: "#fb923c",
    fontWeight: "700",
    fontSize: "15px"
  }}
>
  Mehr erfahren →
</div>
    </div>
  ))}
</div> 

  </div>

</section>

    </div>
  );
}
function InfoNewcastle() {
  const warningSigns = [
    ["Allgemeines Befinden", "Betroffene Tiere können matt wirken, weniger fressen oder einen deutlichen Leistungsabfall zeigen."],
    ["Atmung und Nervensystem", "Je nach Verlauf sind Atemprobleme, ungewöhnliche Bewegungen oder Störungen der Koordination möglich."],
    ["Bestandsverlauf", "Die Erkrankung kann sich schnell ausbreiten. Auffälligkeiten sollten deshalb niemals allein anhand einzelner Symptome bewertet werden."]
  ]

  return (
    <div className="collective-info-page info-topic-page info-newcastle-page">
      <main className="collective-info-shell">
        <section className="collective-info-hero info-topic-hero">
          <span className="collective-info-eyebrow">Schutz Ihrer Tiere</span>
          <h1 id="info-detail-start" className="info-detail-anchor">
            Warum gegen Newcastle impfen?
          </h1>
          <p>
            Die Newcastle-Krankheit kann Geflügelbestände schwer treffen. Ein
            verlässlich aufgebauter Impfschutz hilft, das Risiko zu begrenzen
            und schützt nicht nur einzelne Tiere, sondern die gesamte
            Geflügelgemeinschaft.
          </p>
        </section>

        <section className="collective-info-section info-topic-lead">
          <div>
            <span className="collective-info-kicker">Die Krankheit verstehen</span>
            <h2>Was hinter Newcastle steckt</h2>
            <p>
              Die Newcastle-Krankheit, auch als atypische Geflügelpest bekannt,
              ist eine ansteckende Viruserkrankung. Sie betrifft vor allem
              Geflügel und kann über direkten Tierkontakt, verunreinigte
              Gegenstände, Kleidung oder andere indirekte Wege weitergetragen
              werden.
            </p>
            <p>
              Wie schwer ein Bestand betroffen ist, hängt unter anderem vom
              Virusstamm, vom Immunstatus und von der Tierart ab. Gerade weil
              der Verlauf unterschiedlich aussehen kann, ist Vorbeugung
              wesentlich verlässlicher als eine Reaktion erst nach sichtbaren
              Krankheitszeichen.
            </p>
          </div>
          <aside className="info-topic-fact">
            <span aria-hidden="true">🛡️</span>
            <strong>Vorbeugen statt reagieren</strong>
            <p>
              Regelmäßige Impfungen helfen dem Immunsystem, sich auf den Erreger
              vorzubereiten und bei einem Kontakt schneller zu reagieren.
            </p>
          </aside>
        </section>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Aufmerksam bleiben</span>
            <h2>Mögliche Anzeichen im Bestand</h2>
            <p>
              Krankheitszeichen können sehr verschieden sein und erlauben keine
              sichere Eigendiagnose. Die folgenden Beobachtungen sind Beispiele,
              bei denen fachlicher Rat wichtig ist.
            </p>
          </div>
          <div className="info-topic-three-grid">
            {warningSigns.map(([title, text], index) => (
              <article className="collective-info-benefit" key={title}>
                <span aria-hidden="true">{["🐔", "🫁", "🔎"][index]}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="info-topic-alert">
            <span aria-hidden="true">!</span>
            <p>
              Bei einem konkreten Krankheitsverdacht wenden Sie sich bitte
              unverzüglich an eine Tierärztin, einen Tierarzt oder die zuständige
              Veterinärbehörde. Diese Informationsseite ersetzt keine
              tierärztliche Beurteilung.
            </p>
          </div>
        </section>

        <section className="collective-info-section collective-info-process">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Schutz aufbauen</span>
            <h2>Warum regelmäßiges Impfen zählt</h2>
            <p>
              Impfschutz ist kein einmaliger Zustand. Er wird durch einen
              passenden Impfplan aufgebaut und durch Wiederholungen erhalten.
            </p>
          </div>
          <div className="info-protection-flow">
            <article><span>1</span><h3>Immunsystem vorbereiten</h3><p>Die Impfung macht den Organismus mit dem Erreger vertraut, ohne eine natürliche Erkrankung abwarten zu müssen.</p></article>
            <article><span>2</span><h3>Schutz auffrischen</h3><p>Regelmäßige Wiederholungen unterstützen einen belastbaren Schutz über die Zeit.</p></article>
            <article><span>3</span><h3>Bestände gemeinsam schützen</h3><p>Je verlässlicher die Tiere geschützt sind, desto kleiner wird das Risiko einer unbemerkten Weiterverbreitung.</p></article>
          </div>
        </section>

        <section className="collective-info-section info-newcastle-practice">
          <article className="collective-info-card">
            <div className="collective-info-icon" aria-hidden="true">🏡</div>
            <div>
              <span className="collective-info-kicker">Im Alltag</span>
              <h2>Impfung und gute Bestandshygiene gehören zusammen</h2>
              <p>
                Eine Impfung ist ein zentraler Schutzbaustein. Saubere
                Tränke- und Futterbereiche, kontrollierte Kontakte zu fremden
                Tieren sowie gereinigte Schuhe, Geräte und Transportbehälter
                ergänzen diesen Schutz sinnvoll.
              </p>
              <p>
                Neue oder zurückkehrende Tiere sollten besonders aufmerksam
                beobachtet werden. So lassen sich Veränderungen früh erkennen
                und unnötige Einträge in den Bestand vermeiden.
              </p>
            </div>
          </article>
          <article className="collective-info-card collective-info-card-accent">
            <div className="collective-info-icon" aria-hidden="true">🤝</div>
            <div>
              <span className="collective-info-kicker">Gemeinsame Verantwortung</span>
              <h2>Der eigene Schutz wirkt über den Zaun hinaus</h2>
              <p>
                Geflügelhaltungen sind durch Tierkontakte, Veranstaltungen,
                Transporte und Personen miteinander verbunden. Vorsorge im
                eigenen Bestand hilft deshalb auch benachbarten Haltungen und
                der organisierten Geflügelzucht.
              </p>
            </div>
          </article>
        </section>

        <section className="collective-info-summary">
          <span className="collective-info-kicker">Kurz zusammengefasst</span>
          <h2>Regelmäßiger Schutz schafft Sicherheit</h2>
          <p>
            Newcastle ist ansteckend und kann schwerwiegende Folgen haben.
            Regelmäßige Impfungen, Aufmerksamkeit und gute Hygiene bilden
            gemeinsam die beste Grundlage für einen gesunden Geflügelbestand.
            Die Sammelimpfung macht diese Vorsorge einfach planbar.
          </p>
        </section>

        <button className="collective-info-back" onClick={() => (window.location.hash = "#info")}>
          ← Zurück
        </button>
      </main>
    </div>
  )
}

function InfoNewcastleLegacy() {
  return (
    <div className="min-h-screen bg-slate-100">

      <section
        style={{
          background: "linear-gradient(135deg,#0f172a,#14532d)",
          color: "#fff",
          padding: "90px 40px"
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          <h1
            id="info-detail-start"
            className="info-detail-anchor"
            style={{
              fontSize: "58px",
              margin: 0,
              fontWeight: "900"
            }}
          >
            Warum gegen Newcastle impfen?
          </h1>

          <div
  style={{
    marginTop: "40px",
    maxWidth: "950px",
    color: "#d1d5db"
  }}
>

  <h2
    style={{
      color: "#ffffff",
      fontSize: "34px",
      marginBottom: "20px"
    }}
  >
    Was ist die Newcastle-Krankheit?
  </h2>

  <p
    style={{
      fontSize: "20px",
      lineHeight: "1.9",
      marginBottom: "28px"
    }}
  >
    Die Newcastle-Krankheit – auch als Atypische Geflügelpest bekannt – ist
    eine hochansteckende Viruserkrankung des Geflügels. Sie befällt unter
    anderem Hühner, Zwerghühner, Puten, Tauben, Fasane, Perlhühner,
    Wachteln und zahlreiche weitere Vogelarten. Die Erkrankung gehört zu
    den anzeigepflichtigen Tierseuchen und wird deshalb von den
    Veterinärbehörden besonders überwacht.
  </p>

  <p
    style={{
      fontSize: "20px",
      lineHeight: "1.9",
      marginBottom: "28px"
    }}
  >
    Das Virus verbreitet sich äußerst schnell. Bereits einzelne infizierte
    Tiere können innerhalb kurzer Zeit einen gesamten Bestand anstecken.
    Die Übertragung erfolgt nicht nur von Tier zu Tier, sondern auch über
    Schuhe, Kleidung, Transportkisten, Fahrzeuge, Futter, Einstreu,
    Gerätschaften oder Wildvögel. Dadurch kann sich die Krankheit auch dann
    verbreiten, wenn keine direkten Kontakte zwischen zwei Geflügelhaltern
    bestehen.
  </p>

  <div
    style={{
      background: "rgba(255,255,255,.08)",
      border: "1px solid rgba(255,255,255,.15)",
      borderRadius: "18px",
      padding: "28px",
      margin: "40px 0"
    }}
  >

    <h3
      style={{
        color: "#ffffff",
        marginTop: 0,
        fontSize: "28px"
      }}
    >
      Typische Krankheitsanzeichen
    </h3>

    <ul
      style={{
        lineHeight: "2",
        fontSize: "19px",
        paddingLeft: "24px"
      }}
    >
      <li>Atemwegsprobleme und erschwerte Atmung</li>
      <li>Teilnahmslosigkeit und Fressunlust</li>
      <li>Durchfall und starker Leistungsabfall</li>
      <li>Rückgang der Legeleistung</li>
      <li>Lähmungen und neurologische Störungen</li>
      <li>Hohe Verluste innerhalb kurzer Zeit</li>
    </ul>

  </div>

  <h2
    style={{
      color: "#ffffff",
      fontSize: "34px",
      marginBottom: "20px"
    }}
  >
    Warum ist die Impfung so wichtig?
  </h2>

  <p
    style={{
      fontSize: "20px",
      lineHeight: "1.9"
    }}
  >
    Die regelmäßige Newcastle-Impfung schützt nicht nur Ihren eigenen
    Bestand, sondern trägt wesentlich dazu bei, die Ausbreitung dieser
    gefährlichen Tierseuche zu verhindern. Jeder geimpfte Bestand hilft,
    das Risiko eines Seuchenausbruchs zu reduzieren und die Gesundheit des
    gesamten Geflügelbestandes in der Region langfristig zu sichern.
  </p>

</div>
<div
  style={{
    marginTop: "50px",
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: "20px"
  }}
>

  <div
    style={{
      background: "#ffffff",
      color: "#0f172a",
      borderRadius: "18px",
      padding: "24px"
    }}
  >
    <div style={{ fontSize: "42px" }}>🛡️</div>
    <h3>Schutz</h3>
    <p>
      Die regelmäßige Impfung schützt Ihren Bestand und reduziert das Risiko
      einer Virusverbreitung erheblich.
    </p>
  </div>

  <div
    style={{
      background: "#ffffff",
      color: "#0f172a",
      borderRadius: "18px",
      padding: "24px"
    }}
  >
    <div style={{ fontSize: "42px" }}>⚠️</div>
    <h3>Tierseuche</h3>
    <p>
      Newcastle gehört zu den anzeigepflichtigen Tierseuchen und wird von den
      Veterinärbehörden streng überwacht.
    </p>
  </div>

  <div
    style={{
      background: "#ffffff",
      color: "#0f172a",
      borderRadius: "18px",
      padding: "24px"
    }}
  >
    <div style={{ fontSize: "42px" }}>💉</div>
    <h3>Vorbeugen</h3>
    <p>
      Die Impfung ist die wirksamste Maßnahme, um Ihren Bestand langfristig
      gesund zu erhalten.
    </p>
  </div>

</div>
          <button
            onClick={() => (window.location.hash = "#info")}
            style={{
              marginTop: "50px",
              padding: "16px 30px",
              border: 0,
              borderRadius: "14px",
              background: "#f97316",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ← Zurück
          </button>

        </div>
      </section>

    </div>
  )
}
function InfoPflicht() {
  const responsibilities = [
    ["Bestand kennen", "Behalten Sie Tierzahl, Impfungen und Veränderungen im Bestand im Blick."],
    ["Termine einplanen", "Melden Sie sich rechtzeitig an, damit Wiederholungsimpfungen nicht aus dem Blick geraten."],
    ["Nachweise aufbewahren", "Halten Sie die für Ihren Bestand vorgesehenen Unterlagen nachvollziehbar und griffbereit."],
    ["Auffälligkeiten melden", "Bei einem Krankheitsverdacht ist schnelles, fachlich abgestimmtes Handeln entscheidend."]
  ]

  return (
    <div className="collective-info-page info-topic-page info-duty-page">
      <main className="collective-info-shell">
        <section className="collective-info-hero info-duty-hero">
          <span className="collective-info-eyebrow">Verantwortung mit gutem Grund</span>
          <h1 id="info-detail-start" className="info-detail-anchor">
            Gesetzliche Impfpflicht
          </h1>
          <p>
            Die Impfpflicht gegen die Newcastle-Krankheit dient einem
            gemeinsamen Ziel: Geflügelbestände schützen und eine schnelle
            Ausbreitung der Tierseuche möglichst verhindern. Sie betrifft nicht
            nur große Betriebe, sondern grundsätzlich auch private Haltungen.
          </p>
        </section>

        <section className="collective-info-section info-duty-explainer">
          <article>
            <span className="collective-info-kicker">Der Hintergrund</span>
            <h2>Warum eine gesetzliche Regelung notwendig ist</h2>
            <p>
              Ansteckende Tierkrankheiten machen an Grundstücks- oder
              Vereinsgrenzen nicht halt. Ein einzelner ungeschützter Bestand
              kann im ungünstigen Fall Auswirkungen auf viele weitere Haltungen
              haben. Deshalb wird der Schutz nicht allein der persönlichen
              Entscheidung überlassen.
            </p>
            <p>
              Die Vorgaben schaffen einen gemeinsamen Mindeststandard. Sie
              verbinden den Schutz der eigenen Tiere mit der Verantwortung
              gegenüber anderen Geflügelhalterinnen und Geflügelhaltern.
            </p>
          </article>
          <aside className="info-duty-quote">
            <span aria-hidden="true">⚖️</span>
            <p>
              Impfpflicht bedeutet nicht Bürokratie um ihrer selbst willen,
              sondern verlässliche Vorsorge in vielen kleinen und großen
              Beständen.
            </p>
          </aside>
        </section>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Für wen gilt sie?</span>
            <h2>Auch kleine Hobbyhaltungen gehören dazu</h2>
            <p>
              Die Verantwortung hängt nicht davon ab, ob Tiere gewerblich, im
              Verein oder als Hobby gehalten werden. Entscheidend ist die
              Geflügelhaltung selbst. Die konkret erforderlichen Intervalle und
              Nachweise richten sich nach den geltenden Vorgaben und dem
              verwendeten Impfkonzept.
            </p>
          </div>
          <div className="info-duty-responsibilities">
            {responsibilities.map(([title, text], index) => (
              <article key={title}>
                <span aria-hidden="true">{["📋", "📅", "🗂️", "☎️"][index]}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="collective-info-section collective-info-process">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Praktisch umgesetzt</span>
            <h2>So unterstützt die Sammelimpfung</h2>
            <p>
              Die gesetzlichen Anforderungen wirken zunächst komplex. Ein
              organisierter Termin macht die praktische Umsetzung deutlich
              übersichtlicher.
            </p>
          </div>
          <div className="info-duty-path">
            <article><span>01</span><div><h3>Termin finden</h3><p>Der Verein veröffentlicht einen vorbereiteten Sammeltermin mit den relevanten Informationen.</p></div></article>
            <article><span>02</span><div><h3>Bestand anmelden</h3><p>Sie erfassen Ihre Tiere digital und schaffen damit eine verlässliche Planungsgrundlage.</p></div></article>
            <article><span>03</span><div><h3>Teilnahme dokumentieren</h3><p>Bestätigung, Zahlung und Check-in werden geordnet dem Termin und Ihrer Anmeldung zugeordnet.</p></div></article>
          </div>
        </section>

        <aside className="collective-info-notice info-duty-notice">
          <span className="collective-info-notice-icon" aria-hidden="true">ℹ️</span>
          <div>
            <h2>Was diese Seite leisten kann</h2>
            <p>
              Sie vermittelt einen verständlichen Überblick, ersetzt jedoch
              keine individuelle Rechts- oder tierärztliche Beratung. Für
              verbindliche Anforderungen an Ihren konkreten Bestand sind die
              aktuell geltenden Vorschriften sowie Auskünfte der zuständigen
              Veterinärbehörde maßgeblich.
            </p>
          </div>
        </aside>

        <section className="collective-info-section info-duty-faq">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Häufige Fragen</span>
            <h2>Impfpflicht verständlich beantwortet</h2>
          </div>
          <div className="collective-info-faq">
            <details><summary>Gilt die Pflicht auch für wenige Tiere?<span aria-hidden="true">+</span></summary><p>Eine kleine Bestandsgröße hebt die grundsätzliche Verantwortung nicht automatisch auf. Klären Sie die konkreten Anforderungen für Ihre gehaltenen Geflügelarten im Zweifel mit der zuständigen Stelle.</p></details>
            <details><summary>Reicht eine einmalige Impfung aus?<span aria-hidden="true">+</span></summary><p>Ein belastbarer Schutz muss nach dem vorgesehenen Impfplan aufgebaut und regelmäßig aufgefrischt werden. Das konkrete Vorgehen hängt vom Impfstoff und der fachlichen Vorgabe ab.</p></details>
            <details><summary>Warum werden meine Daten bei der Anmeldung benötigt?<span aria-hidden="true">+</span></summary><p>Die Angaben dienen der Zuordnung zum Termin, der Bedarfsplanung, der Kommunikation und der nachvollziehbaren Organisation des Impftags.</p></details>
            <details><summary>Wo erhalte ich verbindliche Auskünfte?<span aria-hidden="true">+</span></summary><p>Ihre Tierärztin oder Ihr Tierarzt sowie die zuständige Veterinärbehörde können die aktuell geltenden Anforderungen für Ihren konkreten Bestand einordnen.</p></details>
          </div>
        </section>

        <section className="collective-info-summary info-duty-summary">
          <span className="collective-info-kicker">Zusammenfassung</span>
          <h2>Gemeinsamer Schutz braucht Verlässlichkeit</h2>
          <p>
            Die Impfpflicht sorgt dafür, dass Vorsorge nicht dem Zufall
            überlassen bleibt. Mit einer rechtzeitigen Anmeldung und der
            Teilnahme an der organisierten Sammelimpfung lässt sich diese
            Verantwortung einfach, nachvollziehbar und gemeinschaftlich erfüllen.
          </p>
        </section>

        <button className="collective-info-back" onClick={() => (window.location.hash = "#info")}>
          ← Zurück
        </button>
      </main>
    </div>
  )
}

function InfoPflichtLegacy() {
  return (
    <div className="min-h-screen bg-slate-100">

      <section
        style={{
          background: "linear-gradient(135deg,#1e3a8a,#1e40af)",
          color: "#fff",
          padding: "90px 40px"
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto"
          }}
        >

          <h1
            id="info-detail-start"
            className="info-detail-anchor"
            style={{
              fontSize: "58px",
              fontWeight: "900",
              margin: 0
            }}
          >
            Gesetzliche Impfpflicht
          </h1>

          <div
            style={{
              marginTop: "40px",
              maxWidth: "950px",
              color: "#dbeafe"
            }}
          >

            <h2
  style={{
    color: "#fff",
    fontSize: "34px",
    marginBottom: "20px"
  }}
>
  Warum gibt es überhaupt eine Impfpflicht?
</h2>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Die Newcastle-Krankheit gehört zu den gefährlichsten Viruserkrankungen des
  Hausgeflügels. Aufgrund ihrer hohen Ansteckungsfähigkeit kann sich das Virus
  innerhalb kürzester Zeit von einem Bestand auf viele weitere Haltungen
  ausbreiten. Bereits ein einzelner Ausbruch kann erhebliche wirtschaftliche
  Schäden verursachen und umfangreiche Maßnahmen der Veterinärbehörden
  erforderlich machen.
</p>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Aus diesem Grund schreibt der Gesetzgeber regelmäßige Schutzimpfungen für
  bestimmte Geflügelarten vor. Ziel ist es nicht nur, einzelne Tiere zu
  schützen, sondern die Ausbreitung der Krankheit insgesamt zu verhindern und
  die Geflügelhaltung dauerhaft sicherer zu machen.
</p>

<h2
  style={{
    color: "#fff",
    fontSize: "34px",
    marginTop: "50px",
    marginBottom: "20px"
  }}
>
  Für wen gilt die Impfpflicht?
</h2>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Die Impfpflicht richtet sich nicht ausschließlich an große
  Geflügelbetriebe. Auch private Hobbyhalter, Züchter und Vereinsmitglieder
  tragen Verantwortung für ihre Tiere. Die Größe des Bestandes spielt dabei
  keine entscheidende Rolle. Bereits wenige Tiere können sich infizieren und
  das Virus weiterverbreiten.
</p>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Deshalb sollte jede Geflügelhaltung regelmäßig überprüfen, ob die
  vorgeschriebenen Impfungen ordnungsgemäß durchgeführt wurden und die
  erforderlichen Nachweise vorhanden sind.
</p>

<div
  style={{
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "28px",
    margin: "45px 0"
  }}
>

  <h3
    style={{
      color: "#fff",
      marginTop: 0,
      fontSize: "28px"
    }}
  >
    Warum regelmäßige Impfungen?
  </h3>

  <ul
    style={{
      lineHeight: "2",
      fontSize: "19px",
      paddingLeft: "24px"
    }}
  >
    <li>Schutz des eigenen Geflügelbestandes.</li>
    <li>Verringerung des Ansteckungsrisikos für andere Halter.</li>
    <li>Vorbeugung größerer Seuchenausbrüche.</li>
    <li>Erfüllung gesetzlicher Vorgaben.</li>
    <li>Nachweis einer verantwortungsvollen Tierhaltung.</li>
  </ul>

</div>

<h2
  style={{
    color: "#fff",
    fontSize: "34px",
    marginBottom: "20px"
  }}
>
  Häufige Fragen
</h2>

<h3 style={{ color: "#fff" }}>
Muss ich auch nur wenige Hühner impfen?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Ja. Auch kleine Hobbyhaltungen können von der Impfpflicht betroffen sein. Das
Virus unterscheidet nicht zwischen großen und kleinen Beständen.
</p>

<h3 style={{ color: "#fff" }}>
Reicht eine einmalige Impfung?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Nein. Der Impfschutz muss regelmäßig aufgefrischt werden. Nur dadurch bleibt
ein wirksamer Schutz des Bestandes dauerhaft erhalten.
</p>

<h3 style={{ color: "#fff" }}>
Warum organisiert der Verein Sammelimpfungen?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Gemeinsame Impfaktionen erleichtern die Organisation, reduzieren Kosten und
stellen sicher, dass möglichst viele Geflügelhalter ihre Tiere fristgerecht
impfen lassen können.
</p>
<h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "20px"
  }}
>
  Gesetzliche Grundlagen
</h2>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Die Bekämpfung der Newcastle-Krankheit erfolgt in Deutschland auf Grundlage
  tierseuchenrechtlicher Vorschriften. Ziel dieser Regelungen ist es,
  Tierbestände dauerhaft zu schützen und die Ausbreitung gefährlicher
  Tierseuchen frühzeitig zu verhindern. Die regelmäßige Schutzimpfung ist
  deshalb keine Empfehlung, sondern ein wesentlicher Bestandteil der
  Seuchenprävention.
</p>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Jeder Geflügelhalter trägt Verantwortung – nicht nur für die eigenen Tiere,
  sondern auch für benachbarte Bestände. Bereits ein einzelner ungeimpfter
  Bestand kann dazu beitragen, dass sich ein Virus unkontrolliert verbreitet.
  Die gesetzlichen Vorgaben dienen deshalb dem Schutz aller Geflügelhalter und
  der gesamten Geflügelwirtschaft.
</p>

<h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "20px"
  }}
>
  Praktische Hinweise für Geflügelhalter
</h2>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Planen Sie die Impfungen frühzeitig und halten Sie die vorgeschriebenen
  Impfintervalle konsequent ein. Bewahren Sie Impfbescheinigungen und
  Nachweise sorgfältig auf, damit diese bei Bedarf jederzeit vorgelegt werden
  können.
</p>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
  Die Teilnahme an einer Sammelimpfung bietet viele Vorteile. Der Impfstoff
  wird fachgerecht vorbereitet, alle Teilnehmer erhalten einen einheitlichen
  Nachweis und die Organisation wird erheblich vereinfacht. Gleichzeitig
  profitieren Vereine von einer besseren Planung und einem reibungslosen
  Ablauf der Impftermine.
</p>

<div
  style={{
    marginTop: "40px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "28px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "28px"
    }}
  >
    Wichtig zu beachten
  </h3>

  <ul
    style={{
      fontSize: "19px",
      lineHeight: "2",
      paddingLeft: "24px",
      marginBottom: 0
    }}
  >
    <li>Impftermine rechtzeitig planen.</li>
    <li>Impfnachweise sicher aufbewahren.</li>
    <li>Neue Tiere möglichst in den Impfplan aufnehmen.</li>
    <li>Bei Fragen den Tierarzt oder den Verein kontaktieren.</li>
    <li>Die Gesundheit des gesamten Bestandes regelmäßig beobachten.</li>
  </ul>
</div>
          <button
            onClick={() => (window.location.hash = "#info")}
            style={{
              marginTop: "60px",
              padding: "16px 30px",
              border: 0,
              borderRadius: "14px",
              background: "#f97316",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ← Zurück
          </button>
</div>
        </div>
      </section>

    </div>
  )
}
function InfoSammelimpfung() {
  const benefits = [
    ["🗓️", "Gemeinsam geplant", "Ein zentral organisierter Termin bündelt Anmeldung, Impfstoffbedarf und Ausgabe. Das spart allen Beteiligten viele einzelne Abstimmungen."],
    ["🤝", "Einfach teilnehmen", "Halterinnen und Halter können ihren Bestand bequem anmelden und erhalten alle wichtigen Informationen gebündelt für ihren Termin."],
    ["📦", "Bedarfsgerecht vorbereitet", "Die Anzahl der angemeldeten Tiere bildet die Grundlage für Planung und Bereitstellung des Impfstoffs. So kann zuverlässig organisiert werden."],
    ["⏱️", "Weniger Aufwand", "Klare Abläufe, digitale Teilnehmerdaten und ein schneller Check-in verkürzen Wartezeiten und entlasten die ehrenamtliche Organisation."]
  ]

  const processSteps = [
    ["1", "Online anmelden", "Sie wählen den passenden Termin und erfassen Ihren Geflügelbestand mit den benötigten Kontaktdaten."],
    ["2", "Teilnahme bestätigen", "Nach Abschluss der Anmeldung erhalten Sie eine Bestätigung. Bei erfolgreicher Zahlung kommt Ihr persönlicher QR-Code per E-Mail."],
    ["3", "Termin vorbereiten", "Der Verein fasst die Meldungen zusammen und organisiert den Ablauf sowie den benötigten Impfstoff auf Basis aller Anmeldungen."],
    ["4", "Vor Ort einchecken", "Am Impftag zeigen Sie Ihren QR-Code vor. Der Impfwart scannt ihn und kann Ihre Anmeldung sofort eindeutig zuordnen."],
    ["5", "Impfung durchführen", "Die Ausgabe und Anwendung erfolgen nach den für den Termin mitgeteilten organisatorischen und fachlichen Vorgaben."]
  ]

  const faqs = [
    ["Muss ich Vereinsmitglied sein?", "Nein. Sofern beim jeweiligen Termin nichts anderes angegeben ist, können auch Geflügelhalterinnen und Geflügelhalter teilnehmen, die nicht Mitglied im Verein sind."],
    ["Warum muss ich die Tierzahl frühzeitig angeben?", "Die gemeldete Tierzahl ist für die Planung entscheidend. Sie hilft dabei, den Bedarf realistisch zu bestimmen und den Termin verlässlich vorzubereiten."],
    ["Wann erhalte ich meinen QR-Code?", "Ihr persönlicher QR-Code wird nach erfolgreicher Zahlung automatisch mit der Zahlungsbestätigung per E-Mail versendet."],
    ["Was mache ich, wenn ich die E-Mail nicht finde?", "Prüfen Sie bitte zunächst Ihren Spam-Ordner. Ist die Nachricht dort ebenfalls nicht vorhanden, wenden Sie sich rechtzeitig vor dem Termin an den Veranstalter."],
    ["Kann eine andere Person die Impfung für mich abholen?", "Ja. Eine andere Person kann den Impfstoff für Sie abholen. Voraussetzung ist, dass die Anmeldung eindeutig zugeordnet werden kann und der QR-Code bzw. die Anmeldebestätigung vorliegt. Bei Unsicherheiten oder besonderen Fällen empfehlen wir, den Veranstalter vorab zu informieren."],
    ["Was passiert, wenn sich meine Tierzahl ändert?", "Teilen Sie größere Änderungen möglichst frühzeitig mit. Kurzfristige Abweichungen können die bereits abgeschlossene Impfstoff- und Ablaufplanung beeinflussen."]
  ]

  return (
    <div className="collective-info-page">
      <main className="collective-info-shell">
        <section className="collective-info-hero">
          <span className="collective-info-eyebrow">Gemeinsam vorsorgen</span>
          <h1 id="info-detail-start" className="info-detail-anchor">
            Gemeinsame Sammelimpfung
          </h1>
          <p>
            Eine Sammelimpfung verbindet verantwortungsvolle Tierhaltung mit
            einer gut organisierten, einfachen Teilnahme. Der Verein koordiniert
            den Termin, bündelt die Anmeldungen und begleitet Sie digital vom
            ersten Schritt bis zum Check-in am Impftag.
          </p>
        </section>

        <section className="collective-info-section collective-info-intro-grid">
          <article className="collective-info-card">
            <div className="collective-info-icon" aria-hidden="true">🐔</div>
            <div>
              <span className="collective-info-kicker">Hintergrund</span>
              <h2>Warum gibt es Sammelimpfungen?</h2>
              <p>
                Viele private Geflügelbestände benötigen regelmäßig Schutz gegen
                die Newcastle-Krankheit. Für einzelne kleine Bestände wäre die
                Organisation oft aufwendig. Bei einer Sammelimpfung werden viele
                Halterinnen und Halter in einem gemeinsamen Ablauf
                zusammengeführt.
              </p>
              <p>
                Der Verein übernimmt die zentrale Terminplanung, erfasst den
                Bedarf und sorgt dafür, dass alle Teilnehmenden rechtzeitig
                wissen, wann und wie die Impfung stattfindet. So entsteht aus
                vielen einzelnen Meldungen ein verlässlicher gemeinsamer Termin.
              </p>
            </div>
          </article>

          <article className="collective-info-card collective-info-card-accent">
            <div className="collective-info-icon" aria-hidden="true">🛡️</div>
            <div>
              <span className="collective-info-kicker">Tiergesundheit</span>
              <h2>Was ist die Newcastle-Krankheit?</h2>
              <p>
                Die Newcastle-Krankheit ist eine ansteckende Viruserkrankung des
                Geflügels. Sie kann sich rasch zwischen Tieren und Beständen
                verbreiten und je nach Verlauf schwere Erkrankungen sowie hohe
                Tierverluste verursachen.
              </p>
              <p>
                Weil eine Einschleppung nicht immer sofort erkennbar ist, spielt
                die vorbeugende Impfung eine zentrale Rolle. Sie stärkt den
                Schutz des eigenen Bestands und trägt zugleich dazu bei, das
                Risiko einer weiteren Ausbreitung zu verringern.
              </p>
            </div>
          </article>
        </section>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Gute Gründe</span>
            <h2>Warum die Impfung wichtig ist</h2>
            <p>
              Regelmäßiger Impfschutz ist ein wichtiger Teil verantwortungsvoller
              Geflügelhaltung. Er hilft, die Tiere vorsorglich zu schützen und
              schafft Sicherheit für alle Bestände, die über Ausstellungen,
              Zukäufe oder alltägliche Kontakte miteinander verbunden sein können.
            </p>
          </div>
          <div className="collective-info-benefits">
            {benefits.map(([icon, title, text]) => (
              <article className="collective-info-benefit" key={title}>
                <span aria-hidden="true">{icon}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="collective-info-section collective-info-process">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Schritt für Schritt</span>
            <h2>So läuft die Sammelimpfung ab</h2>
            <p>
              Vom Ausfüllen des Formulars bis zum Termin führt Sie die Anwendung
              durch einen klaren Ablauf. Sie wissen jederzeit, was als Nächstes
              passiert.
            </p>
          </div>
          <div className="collective-info-timeline">
            {processSteps.map(([number, title, text]) => (
              <article className="collective-info-step" key={number}>
                <span className="collective-info-step-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="collective-info-section collective-info-after-grid">
          <article className="collective-info-card">
            <div className="collective-info-icon" aria-hidden="true">📧</div>
            <div>
              <span className="collective-info-kicker">Nach der Anmeldung</span>
              <h2>Gut informiert bis zum Termin</h2>
              <p>
                Ihre Angaben werden dem gewählten Impftermin zugeordnet. Sie
                erhalten die vorgesehenen Bestätigungen per E-Mail und nach
                erfolgreicher Zahlung zusätzlich Ihren persönlichen QR-Code für
                den Check-in.
              </p>
              <p>
                Bewahren Sie diese Nachricht am besten auf Ihrem Smartphone auf.
                So haben Sie die wichtigsten Angaben und den QR-Code am Impftag
                direkt griffbereit.
              </p>
            </div>
          </article>

          <article className="collective-info-card">
            <div className="collective-info-icon" aria-hidden="true">📱</div>
            <div>
              <span className="collective-info-kicker">Digitale Unterstützung</span>
              <h2>Wie die App den Ablauf erleichtert</h2>
              <p>
                Die Anwendung verbindet Anmeldung, Terminzuordnung, Bezahlung,
                E-Mail-Bestätigung und Check-in in einem durchgängigen Prozess.
                Angaben müssen nicht mehrfach auf Papier übertragen werden.
              </p>
              <p>
                Für Teilnehmende bleibt der Ablauf übersichtlich. Gleichzeitig
                kann das Organisationsteam Anmeldungen schneller zuordnen,
                Zahlungen nachvollziehen und den Impftag strukturiert vorbereiten.
              </p>
            </div>
          </article>
        </section>

        <section className="collective-info-section collective-info-checklist">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Für den Impftag</span>
            <h2>Das sollten Sie mitbringen</h2>
            <p>
              Mit wenigen Vorbereitungen helfen Sie dabei, dass der Termin für
              alle Beteiligten zügig und geordnet abläuft.
            </p>
          </div>
          <ul>
            <li><span>✓</span><div><strong>Persönlichen QR-Code</strong><p>Digital auf dem Smartphone oder gut lesbar ausgedruckt.</p></div></li>
            <li><span>✓</span><div><strong>Benötigte Behältnisse und Materialien</strong><p>Bitte beachten Sie dazu die konkreten Hinweise des Veranstalters für den gebuchten Termin.</p></div></li>
            <li><span>✓</span><div><strong>Aktuelle Bestandsangaben</strong><p>Informieren Sie das Organisationsteam, falls es relevante Abweichungen zu Ihrer Anmeldung gibt.</p></div></li>
            <li><span>✓</span><div><strong>Etwas Zeit für den geordneten Ablauf</strong><p>Folgen Sie vor Ort den Hinweisen des Impfwarts und halten Sie Zufahrten sowie Ausgabebereiche frei.</p></div></li>
          </ul>
        </section>

        <aside className="collective-info-notice">
          <span className="collective-info-notice-icon" aria-hidden="true">⏰</span>
          <div>
            <h2>Warum eine rechtzeitige Anmeldung wichtig ist</h2>
            <p>
              Die Sammelimpfung wird auf Grundlage der eingegangenen Anmeldungen
              vorbereitet. Tierzahlen, Teilnehmeraufkommen und organisatorischer
              Bedarf müssen vor dem Termin verlässlich feststehen. Eine frühe
              Anmeldung hilft, ausreichend zu planen, Rückfragen rechtzeitig zu
              klären und einen reibungslosen Ablauf für alle zu ermöglichen.
            </p>
          </div>
        </aside>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Kurz erklärt</span>
            <h2>Häufig gestellte Fragen</h2>
            <p>
              Hier finden Sie Antworten auf typische Fragen rund um Anmeldung,
              Vorbereitung und Teilnahme.
            </p>
          </div>
          <div className="collective-info-faq">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="collective-info-summary">
          <span className="collective-info-kicker">Zusammenfassung</span>
          <h2>Gemeinsam gut vorbereitet</h2>
          <p>
            Die Sammelimpfung macht notwendigen Impfschutz für viele
            Geflügelhalterinnen und Geflügelhalter planbar und zugänglich. Eine
            rechtzeitige Online-Anmeldung, klare Informationen und der digitale
            QR-Check-in sorgen dafür, dass vom ersten Klick bis zum Impftag alles
            übersichtlich bleibt. So profitieren Tiere, Teilnehmende und das
            ehrenamtliche Organisationsteam gleichermaßen.
          </p>
        </section>

        <button
          className="collective-info-back"
          onClick={() => (window.location.hash = "#info")}
        >
          ← Zurück
        </button>
      </main>
    </div>
  )
}

function InfoSammelimpfungLegacy() {
  return (
    <div className="min-h-screen bg-slate-100">
      <section
        style={{
          background: "linear-gradient(135deg,#14532d,#166534)",
          color: "#fff",
          padding: "90px 40px"
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto"
          }}
        >
          <h1
            id="info-detail-start"
            className="info-detail-anchor"
            style={{
              fontSize: "58px",
              fontWeight: "900",
              margin: 0
            }}
          >
            Gemeinsame Sammelimpfung
          </h1>

          <div
            style={{
              marginTop: "40px",
              maxWidth: "950px",
              color: "#dcfce7"
            }}
          >
            <h2 style={{ color: "#fff", fontSize: "34px" }}>
              Wissenswertes zur gemeinsamen Sammelimpfung
            </h2>

            <h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginBottom: "24px"
  }}
>
  Warum organisieren Vereine überhaupt Sammelimpfungen?
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Die regelmäßige Impfung gegen die Newcastle-Krankheit gehört für viele
  Geflügelhalter zum festen Bestandteil der Bestandsführung. Da zahlreiche
  Hobbyhalter, Züchter und Vereinsmitglieder ihre Tiere im gleichen Zeitraum
  impfen müssen, haben sich Sammelimpfungen über viele Jahrzehnte als
  bewährte und wirtschaftliche Lösung etabliert. Anstatt dass jeder Halter
  den Impfstoff einzeln beschafft und den gesamten Ablauf selbst organisiert,
  übernimmt der Verein einen großen Teil der Planung und Koordination.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Eine Sammelimpfung bedeutet dabei weit mehr als die gemeinsame Ausgabe von
  Impfstoff. Bereits Wochen vor dem eigentlichen Impftermin beginnt die
  Vorbereitung. Teilnehmer werden informiert, Anmeldungen entgegengenommen,
  Tierzahlen erfasst und der benötigte Impfstoff in der passenden Menge
  bestellt. Dadurch wird verhindert, dass zu wenig oder unnötig viel
  Impfstoff vorhanden ist und alle Teilnehmer zuverlässig versorgt werden
  können.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Gleichzeitig profitieren die Mitglieder von einer deutlich einfacheren
  Organisation. Jeder kennt den Impftermin frühzeitig, erhält alle wichtigen
  Informationen aus einer Hand und muss sich nicht selbst um die aufwendige
  Beschaffung des Impfstoffs kümmern. Für den Verein entsteht eine bessere
  Übersicht über die teilnehmenden Bestände und der gesamte Ablauf kann
  wesentlich strukturierter geplant werden.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Auch aus Sicht des Tier- und Seuchenschutzes bieten Sammelimpfungen große
  Vorteile. Wenn möglichst viele Geflügelhalter ihre Tiere innerhalb eines
  vergleichbaren Zeitraums impfen, wird ein hoher Immunitätsgrad innerhalb
  der Region erreicht. Dadurch sinkt das Risiko einer Ausbreitung der
  Newcastle-Krankheit erheblich und sowohl private Hobbyhaltungen als auch
  größere Bestände profitieren von einem besseren Schutz.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Mit dieser Online-Anmeldung möchte der Verein die gesamte Organisation
  zusätzlich vereinfachen. Teilnehmer können ihre Daten bequem von zu Hause
  aus eingeben, Tierzahlen rechtzeitig melden und sich ihren Platz für den
  nächsten Impftermin sichern. Gleichzeitig erhält der Verein bereits vor
  dem Impftag einen vollständigen Überblick über alle Anmeldungen und kann
  die Impfaktion optimal vorbereiten.
</p>
<h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  So läuft eine Sammelimpfung Schritt für Schritt ab
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Damit eine Sammelimpfung reibungslos funktioniert, sind zahlreiche
  organisatorische Schritte notwendig. Viele dieser Arbeiten bleiben für die
  Teilnehmer unsichtbar, sorgen jedoch dafür, dass am Impftag alles
  vorbereitet ist und der Impfstoff in ausreichender Menge zur Verfügung
  steht.
</p>

<h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  1. Anmeldung der Teilnehmer
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Zunächst melden die Geflügelhalter ihre Teilnahme an. Dabei werden nicht
  nur die persönlichen Daten erfasst, sondern auch die Anzahl der Tiere und
  die jeweiligen Tierarten. Diese Angaben sind wichtig, damit der Verein den
  tatsächlichen Bedarf an Impfstoff berechnen kann.
</p>

<h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  2. Planung durch den Verein
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Nach Ablauf der Anmeldefrist wertet der Verein sämtliche Anmeldungen aus.
  Auf dieser Grundlage werden die benötigten Impfstoffmengen bestellt,
  Termine bestätigt und die Ausgabe vorbereitet. Gleichzeitig können
  Teilnehmerlisten, Impfbescheinigungen und organisatorische Unterlagen
  bereits im Voraus erstellt werden.
</p>

<h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  3. Bestellung des Impfstoffes
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Der Impfstoff wird entsprechend der gemeldeten Tierzahlen bestellt. Durch
  die gemeinsame Bestellung können Überbestellungen vermieden und die
  vorhandenen Mengen optimal genutzt werden. Gleichzeitig ist sichergestellt,
  dass alle Teilnehmer den gleichen zugelassenen Impfstoff erhalten.
</p>
            <h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  4. Vorbereitung des Impftages
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Vor dem eigentlichen Impftermin werden alle organisatorischen Maßnahmen
  abgeschlossen. Teilnehmerlisten werden überprüft, Impfbescheinigungen
  vorbereitet und der Ablauf für die Ausgabe des Impfstoffes festgelegt.
  Dadurch können Wartezeiten reduziert und ein reibungsloser Ablauf
  gewährleistet werden.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Gleichzeitig wird kontrolliert, ob alle notwendigen Unterlagen vorliegen
  und ob die bestellte Impfstoffmenge den gemeldeten Tierzahlen entspricht.
  Ziel ist es, jedem Teilnehmer ausreichend Impfstoff zur Verfügung zu
  stellen und gleichzeitig unnötige Überschüsse zu vermeiden.
</p>

<h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  5. Ausgabe des Impfstoffes
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Am vereinbarten Termin erhalten die Teilnehmer den Impfstoff entsprechend
  ihrer Anmeldung. Dabei werden die benötigten Mengen ausgegeben und – je
  nach Organisation des Vereins – wichtige Hinweise zur Anwendung,
  Lagerung und zum Impfzeitpunkt erläutert. Eventuelle Rückfragen können
  direkt vor Ort geklärt werden.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Durch die vorherige Online-Anmeldung liegen alle Daten bereits vor.
  Dadurch verkürzen sich Wartezeiten erheblich, Fehler bei der Erfassung
  werden vermieden und die Ausgabe kann deutlich strukturierter erfolgen.
</p>

<h3
  style={{
    color: "#ffffff",
    fontSize: "28px",
    marginTop: "35px"
  }}
>
  6. Dokumentation und Nachweis
</h3>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Nach Abschluss der Sammelimpfung werden die erforderlichen Unterlagen
  dokumentiert und die Impfbescheinigungen erstellt beziehungsweise
  vervollständigt. Eine vollständige Dokumentation erleichtert spätere
  Nachweise gegenüber Behörden und hilft dem Verein, zukünftige
  Sammelimpfungen noch besser zu planen.
</p>
            <h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  Welche Aufgaben übernimmt der Verein?
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Eine Sammelimpfung funktioniert nur, wenn viele organisatorische Aufgaben
  zuverlässig erledigt werden. Der Verein übernimmt dabei einen Großteil der
  Planung und sorgt dafür, dass alle Teilnehmer rechtzeitig informiert werden
  und der Impftag ohne unnötige Wartezeiten durchgeführt werden kann.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Bereits Wochen vor dem Impftermin werden Anmeldungen entgegengenommen,
  Teilnehmerlisten erstellt und die gemeldeten Tierzahlen ausgewertet. Auf
  dieser Grundlage kann die benötigte Impfstoffmenge bestellt und die gesamte
  Ausgabe vorbereitet werden.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Während der Impfaktion koordiniert der Verein den Ablauf, beantwortet Fragen
  der Teilnehmer und sorgt dafür, dass alle notwendigen Unterlagen vollständig
  vorhanden sind. Nach Abschluss der Sammelimpfung werden die Daten
  dokumentiert und die erforderlichen Impfbescheinigungen vorbereitet oder
  vervollständigt.
</p>

<div
  style={{
    marginTop: "35px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "28px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "28px"
    }}
  >
    Aufgaben des Vereins auf einen Blick
  </h3>

  <ul
    style={{
      fontSize: "19px",
      lineHeight: "2",
      paddingLeft: "24px",
      marginBottom: 0
    }}
  >
    <li>Information der Mitglieder über Impftermine.</li>
    <li>Entgegennahme und Verwaltung aller Anmeldungen.</li>
    <li>Ermittlung der benötigten Impfstoffmenge.</li>
    <li>Organisation der Ausgabe des Impfstoffes.</li>
    <li>Koordination mit Tierarzt und Verantwortlichen.</li>
    <li>Erstellung und Verwaltung der Impfunterlagen.</li>
    <li>Dokumentation der gesamten Impfaktion.</li>
  </ul>
</div>
            <h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  Vorteile für die Teilnehmer
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Die Teilnahme an einer vom Verein organisierten Sammelimpfung bietet
  zahlreiche Vorteile. Neben der gesetzeskonformen Durchführung profitieren
  die Teilnehmer von einer zentralen Organisation, einem einheitlichen Ablauf
  und einer deutlich einfacheren Planung.
</p>

<div
  style={{
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "30px",
    marginTop: "30px"
  }}
>
  <ul
    style={{
      fontSize: "20px",
      lineHeight: "2",
      paddingLeft: "26px",
      marginBottom: 0
    }}
  >
    <li>✔ einfache Online-Anmeldung rund um die Uhr</li>
    <li>✔ keine aufwendige Einzelorganisation</li>
    <li>✔ optimale Planung des Impfstoffbedarfs</li>
    <li>✔ kurze Wartezeiten am Ausgabetag</li>
    <li>✔ einheitlicher, zugelassener Impfstoff für alle Teilnehmer</li>
    <li>✔ Unterstützung durch den Verein bei Fragen</li>
    <li>✔ vollständige Dokumentation der Impfaktion</li>
    <li>✔ Nachweise und Impfbescheinigungen können vorbereitet werden</li>
    <li>✔ Zeit- und Kostenersparnis gegenüber Einzelterminen</li>
    <li>✔ Beitrag zum Schutz aller Geflügelbestände der Region</li>
  </ul>
</div>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9",
    marginTop: "35px"
  }}
>
  Durch die Kombination aus digitaler Anmeldung und zentral organisierter
  Sammelimpfung profitieren sowohl die Teilnehmer als auch der Verein von
  einem deutlich effizienteren Ablauf. Fehler werden reduziert, Wartezeiten
  verkürzt und alle notwendigen Informationen stehen rechtzeitig zur
  Verfügung.
</p>
          </div>
          <h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  Häufig gestellte Fragen (FAQ)
</h2>

<h3 style={{ color: "#ffffff", fontSize: "28px" }}>
Muss ich Mitglied im Verein sein?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Nein. Auch Nichtmitglieder können – sofern der Verein dies anbietet – an der
Sammelimpfung teilnehmen. Die jeweiligen Teilnahmebedingungen und Gebühren
legt der veranstaltende Verein fest.
</p>

<h3 style={{ color: "#ffffff", fontSize: "28px", marginTop: "35px" }}>
Wann sollte ich mich anmelden?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Melden Sie sich möglichst frühzeitig an. Nur so kann der Verein die benötigte
Impfstoffmenge zuverlässig planen und ausreichend Impfstoff bestellen.
Spätere Anmeldungen können unter Umständen nicht mehr berücksichtigt werden.
</p>

<h3 style={{ color: "#ffffff", fontSize: "28px", marginTop: "35px" }}>
Kann ich nach meiner Anmeldung noch Änderungen vornehmen?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Sollte sich die Anzahl Ihrer Tiere ändern oder Sie verhindert sein, setzen Sie
sich bitte möglichst früh mit dem Verein in Verbindung. Dadurch kann die
Planung angepasst und unnötig bestellter Impfstoff vermieden werden.
</p>

<h3 style={{ color: "#ffffff", fontSize: "28px", marginTop: "35px" }}>
Warum erfolgt die Anmeldung online?
</h3>

<p style={{ fontSize: "20px", lineHeight: "1.9" }}>
Die Online-Anmeldung erleichtert sowohl den Teilnehmern als auch dem Verein
die gesamte Organisation. Daten müssen nicht mehrfach erfasst werden,
Teilnehmerlisten können automatisch erstellt werden und die Planung des
Impfstoffes wird erheblich vereinfacht. Gleichzeitig werden Wartezeiten am
Impftag deutlich reduziert.
</p>

<div
  style={{
    marginTop: "50px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "20px",
    padding: "32px",
    textAlign: "center"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "30px"
    }}
  >
    Gemeinsam für gesunde Geflügelbestände
  </h3>

  <p
    style={{
      fontSize: "20px",
      lineHeight: "1.9",
      marginBottom: 0
    }}
  >
    Jede rechtzeitig durchgeführte Impfung trägt dazu bei, die Ausbreitung der
    Newcastle-Krankheit zu verhindern und den Geflügelbestand in unserer
    Region nachhaltig zu schützen. Vielen Dank für Ihre Unterstützung und Ihre
    verantwortungsvolle Teilnahme an der Sammelimpfung.
  </p>
</div>
          <button
            onClick={() => (window.location.hash = "#info")}
            style={{
              display: "block",
              marginTop: "50px",
              padding: "16px 30px",
              border: 0,
              borderRadius: "14px",
              background: "#f97316",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ← Zurück
          </button>
        </div>
      </section>
    </div>
  )
}
function InfoAnmeldung() {
  const qrSteps = [
    ["📝", "Anmeldung abschließen", "Sie erfassen Ihren Bestand und wählen den vorgesehenen Impftermin."],
    ["💳", "Zahlung bestätigen", "Nach erfolgreicher Zahlung wird die Anmeldung für den digitalen Check-in vorbereitet."],
    ["📧", "QR-Code erhalten", "Der persönliche QR-Code kommt automatisch eingebettet in Ihrer Zahlungsbestätigungs-E-Mail."],
    ["📱", "Am Impftag vorzeigen", "Öffnen Sie die E-Mail auf dem Smartphone oder bringen Sie einen gut lesbaren Ausdruck mit."],
    ["✅", "Schnell einchecken", "Der Impfwart scannt den Code und ordnet Ihre Anmeldung direkt dem richtigen Termin zu."]
  ]

  return (
    <div className="collective-info-page info-topic-page info-qr-page">
      <main className="collective-info-shell">
        <section className="collective-info-hero info-qr-hero">
          <span className="collective-info-eyebrow">Digital und unkompliziert</span>
          <h1 id="info-detail-start" className="info-detail-anchor">
            QR-Check-in am Impftag
          </h1>
          <p>
            Nach Anmeldung und erfolgreicher Zahlung erhalten Sie Ihren
            persönlichen QR-Code automatisch per E-Mail. Ein kurzer Scan genügt,
            damit der Impfwart Ihre Anmeldung findet und den Check-in sicher
            dokumentiert.
          </p>
        </section>

        <section className="collective-info-section info-qr-intro">
          <article>
            <span className="collective-info-kicker">Einfach erklärt</span>
            <h2>Was ist ein QR-Check-in?</h2>
            <p>
              Der QR-Code ist Ihr digitaler Schlüssel zur bereits vorhandenen
              Anmeldung. Statt Namen in langen Listen zu suchen oder Angaben
              erneut aufzuschreiben, scannt der Impfwart den Code und erhält
              sofort die passende Teilnehmerzuordnung.
            </p>
            <p>
              Der Vorgang dauert nur wenige Sekunden. Dadurch bleibt mehr Zeit
              für den eigentlichen Termin, Warteschlangen werden kürzer und
              Verwechslungen lassen sich vermeiden.
            </p>
          </article>
          <div className="info-qr-visual" aria-hidden="true">
            <div className="info-qr-symbol">▦</div>
            <span>Persönlich zugeordnet</span>
            <small>Ein Code · eine Anmeldung</small>
          </div>
        </section>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Der komplette Ablauf</span>
            <h2>Vom Formular bis zum Check-in</h2>
            <p>
              Alle Schritte greifen ineinander. Sie müssen keine zusätzliche App
              installieren und am Impftag keine Daten erneut eingeben.
            </p>
          </div>
          <div className="info-qr-journey">
            {qrSteps.map(([icon, title, text], index) => (
              <article key={title}>
                <span className="info-qr-journey-index">{index + 1}</span>
                <div className="info-qr-journey-icon" aria-hidden="true">{icon}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="collective-info-section info-qr-security">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Datensparsam aufgebaut</span>
            <h2>Was im QR-Code enthalten ist</h2>
            <p>
              Der Code enthält ausschließlich den technisch benötigten
              Check-in-Token. Namen, E-Mail-Adressen, Zahlungsdaten und andere
              personenbezogene Angaben werden nicht direkt in den QR-Code
              geschrieben.
            </p>
          </div>
          <div className="info-qr-security-grid">
            <article><span aria-hidden="true">✓</span><div><h3>Enthalten</h3><p>Nur der persönliche Check-in-Token zur sicheren Zuordnung durch das System.</p></div></article>
            <article><span aria-hidden="true">–</span><div><h3>Nicht enthalten</h3><p>Keine Namen, Kontaktdaten, Tierangaben, Zahlungsinformationen oder Termindetails.</p></div></article>
          </div>
        </section>

        <section className="collective-info-section collective-info-checklist info-qr-checklist">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Gut vorbereitet</span>
            <h2>So klappt der Scan zuverlässig</h2>
            <p>
              Ein paar einfache Vorbereitungen sorgen dafür, dass der Code vor
              Ort sofort lesbar ist.
            </p>
          </div>
          <ul>
            <li><span>✓</span><div><strong>E-Mail vorher öffnen</strong><p>Laden Sie die Nachricht nach Möglichkeit bereits zu Hause auf Ihr Smartphone.</p></div></li>
            <li><span>✓</span><div><strong>Display gut lesbar halten</strong><p>Erhöhen Sie bei Bedarf die Bildschirmhelligkeit und vermeiden Sie starke Spiegelungen.</p></div></li>
            <li><span>✓</span><div><strong>Alternativ ausdrucken</strong><p>Ein sauberer, unverknickter Ausdruck funktioniert ebenfalls.</p></div></li>
            <li><span>✓</span><div><strong>Code nicht bearbeiten</strong><p>Schneiden Sie den QR-Code nicht ab und überdecken Sie keine Bereiche.</p></div></li>
          </ul>
        </section>

        <section className="collective-info-section info-qr-fallback">
          <div className="collective-info-icon" aria-hidden="true">🧭</div>
          <div>
            <span className="collective-info-kicker">Wenn etwas nicht klappt</span>
            <h2>Auch ohne erfolgreichen Scan bleibt Hilfe möglich</h2>
            <p>
              Ist das Smartphone leer, die E-Mail nicht auffindbar oder der
              Ausdruck beschädigt, wenden Sie sich an den Impfwart. Die
              Anmeldung kann über die vorhandene Teilnehmersuche geprüft werden.
              Planen Sie dafür etwas zusätzliche Zeit ein.
            </p>
          </div>
        </section>

        <section className="collective-info-section">
          <div className="collective-info-heading">
            <span className="collective-info-kicker">Häufige Fragen</span>
            <h2>Alles Wichtige zum QR-Code</h2>
          </div>
          <div className="collective-info-faq">
            <details><summary>Brauche ich eine besondere App?<span aria-hidden="true">+</span></summary><p>Nein. Sie müssen den Code lediglich in der E-Mail anzeigen oder ausdrucken. Gescannt wird er vom berechtigten Impfwart.</p></details>
            <details><summary>Kann ich einen Screenshot verwenden?<span aria-hidden="true">+</span></summary><p>Ein vollständiger und scharfer Screenshot ist grundsätzlich lesbar. Die Original-E-Mail ist dennoch die beste Sicherung, falls der Screenshot versehentlich zugeschnitten wurde.</p></details>
            <details><summary>Kann derselbe Code mehrfach verwendet werden?<span aria-hidden="true">+</span></summary><p>Der Check-in-Status wird gespeichert. Ein erneuter Scan wird deshalb erkannt und führt nicht unbemerkt zu einem zweiten Check-in.</p></details>
            <details><summary>Darf ich meinen QR-Code weitergeben?<span aria-hidden="true">+</span></summary><p>Der Code gehört zu Ihrer persönlichen Anmeldung und sollte nicht öffentlich geteilt werden. Zeigen Sie ihn nur dem berechtigten Personal am Impftag.</p></details>
            <details><summary>Was passiert bei einem falschen Termin?<span aria-hidden="true">+</span></summary><p>Der Check-in prüft die Zuordnung zum ausgewählten Impftermin. Ein Code für einen anderen Termin kann nicht einfach als passender Check-in übernommen werden.</p></details>
          </div>
        </section>

        <section className="collective-info-summary info-qr-summary">
          <span className="collective-info-kicker">Zusammenfassung</span>
          <h2>Weniger Papier, schneller am Ziel</h2>
          <p>
            Der persönliche QR-Code verbindet Ihre bestätigte Anmeldung mit
            einem schnellen und nachvollziehbaren Check-in. Sie bringen nur die
            E-Mail oder einen Ausdruck mit – den Rest übernimmt das System.
          </p>
        </section>

        <button className="collective-info-back" onClick={() => (window.location.hash = "#info")}>
          ← Zurück
        </button>
      </main>
    </div>
  )
}

function InfoAnmeldungLegacy() {
  return (
    <div className="min-h-screen bg-slate-100">
      <section
        style={{
          background: "linear-gradient(135deg,#0f172a,#14532d)",
          color: "#fff",
          padding: "90px 40px"
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

          <h1
            id="info-detail-start"
            className="info-detail-anchor"
            style={{
              fontSize: "58px",
              fontWeight: "900",
              margin: 0
            }}
          >
            Online-Anmeldung
          </h1>

          <p
            style={{
              fontSize: "20px",
              lineHeight: "1.9",
              color: "#dbeafe",
              maxWidth: "950px",
              marginTop: "40px"
            }}
          >
            Die Online-Anmeldung ermöglicht eine schnelle, einfache und sichere
Registrierung zur Sammelimpfung. Anstatt Papierformulare auszufüllen oder
telefonisch Termine abzustimmen, können alle erforderlichen Angaben bequem
von Zuhause aus über Smartphone, Tablet oder Computer übermittelt werden.

Durch die digitale Erfassung stehen sämtliche Daten dem Verein sofort zur
Verfügung. Dadurch können Teilnehmerlisten automatisch erstellt, der
Impfstoffbedarf exakt berechnet und die gesamte Impfaktion deutlich besser
organisiert werden. Gleichzeitig werden Übertragungsfehler vermieden und der
Verwaltungsaufwand für den Verein erheblich reduziert.

Auch für die Teilnehmer bietet die Online-Anmeldung viele Vorteile. Die
Anmeldung ist jederzeit möglich, alle Angaben werden übersichtlich erfasst
und am Impftag müssen die Daten nicht erneut aufgenommen werden. Das spart
Zeit, verkürzt Wartezeiten und sorgt für einen reibungslosen Ablauf der
gesamten Sammelimpfung.
          </p>
<h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  Welche Angaben werden benötigt?
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Damit die Sammelimpfung ordnungsgemäß vorbereitet werden kann, benötigt der
  Verein verschiedene Angaben der Teilnehmer. Diese Informationen dienen
  ausschließlich der Organisation der Impfaktion, der Planung des
  Impfstoffbedarfes sowie der späteren Dokumentation. Je vollständiger die
  Angaben sind, desto einfacher und schneller kann die Anmeldung bearbeitet
  werden.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Neben Ihrem Namen und Ihren Kontaktdaten werden unter anderem Ihre Anschrift,
  die Tierart, die Anzahl der zu impfenden Tiere sowie – sofern vorhanden –
  Ihre TSK-Betriebsnummer abgefragt. Zusätzlich wählen Sie den gewünschten
  Impftermin aus und entscheiden sich für die angebotene Zahlungsart.
</p>

<div
  style={{
    marginTop: "35px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "30px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "28px"
    }}
  >
    Erforderliche Angaben
  </h3>

  <ul
    style={{
      fontSize: "20px",
      lineHeight: "2",
      paddingLeft: "26px",
      marginBottom: 0
    }}
  >
    <li>Vor- und Nachname</li>
    <li>Anschrift</li>
    <li>E-Mail-Adresse</li>
    <li>Telefonnummer</li>
    <li>Tierart</li>
    <li>Anzahl der Tiere</li>
    <li>TSK-Betriebsnummer (falls vorhanden)</li>
    <li>Auswahl des Impftermins</li>
    <li>Zahlungsart</li>
  </ul>
</div>
<h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  <h2
  style={{
    color: "#ffffff",
    fontSize: "34px",
    marginTop: "60px",
    marginBottom: "24px"
  }}
>
  Was passiert nach der Anmeldung?
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Nach dem Absenden Ihrer Online-Anmeldung werden die übermittelten Daten
  unmittelbar in der Teilnehmerverwaltung des Vereins gespeichert. Dadurch
  stehen alle Informationen sofort für die weitere Planung der Sammelimpfung
  zur Verfügung. Eine zusätzliche schriftliche Anmeldung ist nicht erforderlich.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Die gemeldete Tierzahl fließt direkt in die Berechnung des benötigten
  Impfstoffes ein. Gleichzeitig erscheinen Sie automatisch auf der
  Teilnehmerliste für den ausgewählten Impftermin. Am Tag der Impfung können
  Ihre Daten schnell aufgerufen und die notwendigen Unterlagen ohne erneute
  Datenerfassung erstellt werden.
</p>

<div
  style={{
    marginTop: "35px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "30px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "28px"
    }}
  >
    Nach Ihrer Anmeldung
  </h3>

  <ul
    style={{
      fontSize: "20px",
      lineHeight: "2",
      paddingLeft: "26px",
      marginBottom: 0
    }}
  >
    <li>Speicherung Ihrer Anmeldung</li>
    <li>Automatische Aufnahme in die Teilnehmerliste</li>
    <li>Berechnung des Impfstoffbedarfes</li>
    <li>Vorbereitung der Impfunterlagen</li>
    <li>Schnellere Abwicklung am Impftag</li>
    <li>Erstellung der Impfbescheinigungen</li>
  </ul>
</div>
  <div
  style={{
    marginTop: "50px",
    background: "rgba(249,115,22,.15)",
    border: "1px solid rgba(249,115,22,.45)",
    borderRadius: "18px",
    padding: "30px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "30px"
    }}
  >
    Ihr Vorteil
  </h3>

  <p
    style={{
      fontSize: "20px",
      lineHeight: "1.9",
      marginBottom: 0
    }}
  >
    Mit der Online-Anmeldung sparen sowohl die Teilnehmer als auch der
    veranstaltende Verein wertvolle Zeit. Die Daten stehen sofort digital zur
    Verfügung, der Impfstoff kann exakt geplant werden und die gesamte
    Sammelimpfung lässt sich deutlich effizienter organisieren. Dadurch
    profitieren alle Beteiligten von einem schnellen, sicheren und
    unkomplizierten Ablauf.
  </p>
</div>
  Datenschutz und Sicherheit Ihrer Daten
</h2>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Der Schutz Ihrer personenbezogenen Daten hat für den veranstaltenden Verein
  höchste Priorität. Sämtliche Angaben werden ausschließlich zur Organisation
  der Sammelimpfung, zur Durchführung der Anmeldung sowie zur gesetzlich
  erforderlichen Dokumentation verarbeitet. Eine Nutzung für Werbezwecke oder
  eine Weitergabe an unbeteiligte Dritte erfolgt nicht.
</p>

<p
  style={{
    fontSize: "20px",
    lineHeight: "1.9"
  }}
>
  Die Daten werden ausschließlich von den verantwortlichen Vereinsmitgliedern
  und – soweit erforderlich – vom betreuenden Tierarzt eingesehen. Alle
  Verarbeitungsvorgänge erfolgen entsprechend der geltenden
  Datenschutzbestimmungen. Nur die Informationen, die für die Durchführung
  der Sammelimpfung notwendig sind, werden gespeichert.
</p>

<div
  style={{
    marginTop: "35px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: "18px",
    padding: "30px"
  }}
>
  <h3
    style={{
      marginTop: 0,
      color: "#ffffff",
      fontSize: "28px"
    }}
  >
    Ihre Daten werden verwendet für:
  </h3>

  <ul
    style={{
      fontSize: "20px",
      lineHeight: "2",
      paddingLeft: "26px",
      marginBottom: 0
    }}
  >
    <li>Organisation der Sammelimpfung</li>
    <li>Planung des Impfstoffbedarfes</li>
    <li>Erstellung der Teilnehmerlisten</li>
    <li>Dokumentation der Impfaktion</li>
    <li>Erstellung von Impfbescheinigungen</li>
    <li>Kontaktaufnahme bei wichtigen Änderungen</li>
  </ul>
</div>
          <button
            onClick={() => (window.location.hash = "#info")}
            style={{
              display: "block",
              marginTop: "50px",
              padding: "16px 30px",
              border: 0,
              borderRadius: "14px",
              background: "#f97316",
              color: "#fff",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ← Zurück
          </button>
        </div>
      </section>
    </div>
  )
}
function RegisterInfo() {
  return (
    <div
  style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0f172a,#14532d)'
  }}
>
  <Header />

  <section
    style={{
      background: "linear-gradient(135deg,#0f172a,#14532d)",
      color: "#fff",
      padding: "90px 40px"
    }}
  >
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1>Vereinsregistrierung</h1>

        <p>
  Diese Funktion befindet sich derzeit noch in der Entwicklung.
</p>

<p>
  Der Impfgruppenmanager wird aktuell im Rahmen eines gemeinsamen Probelaufs mit dem <strong>RGZV Hagen und Umgebung seit 1903 e.V.</strong> entwickelt und unter realen Bedingungen getestet.
</p>

<p>
  Ziel der aktuellen Testphase ist ausschließlich die digitale Organisation und Durchführung der Newcastle-Sammelimpfung für die Mitglieder und Teilnehmer der Impfgruppe des RGZV Hagen.
</p>

<p>
  Aus diesem Grund ist die Registrierung weiterer Vereine derzeit bewusst noch nicht freigeschaltet. Der Schwerpunkt liegt zunächst auf einem erfolgreichen Praxistest innerhalb unseres Vereins.
</p>

<p>
  Nach Abschluss der Testphase werden die weiteren Ausbaustufen der Anwendung gemeinsam mit dem Vorstand des RGZV Hagen bewertet und abgestimmt.
</p>

        <div style={{ marginTop: '30px' }}>
          <button
            className="primary"
            onClick={() => (window.location.hash = '#')}
          >
            Zur Startseite
          </button>
        </div>
      </div>
</section>

<Footer />

</div>
  )
}
function ClubLoginInfo() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#0f172a,#14532d)'
      }}
    >
      <Header />

      <section
        style={{
          background: 'linear-gradient(135deg,#0f172a,#14532d)',
          color: '#fff',
          padding: '90px 40px'
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h1>Vereinslogin</h1>

          <p>
            Diese Funktion befindet sich derzeit noch in der Entwicklung.
          </p>

          <p>
            Der Vereinslogin wird nach erfolgreichem Abschluss der aktuellen
            Testphase schrittweise ausgebaut.
          </p>

          <p>
            Ziel ist es, den teilnehmenden Vereinen künftig einen geschützten
            Verwaltungsbereich für Impftermine, Teilnehmer, Zahlungen,
            Bescheinigungen und Vereinseinstellungen bereitzustellen.
          </p>

          <p>
            Während der laufenden Testphase steht diese Funktion noch nicht zur
            Verfügung.
          </p>

          <div style={{ marginTop: '30px' }}>
            <button
              className="primary"
              onClick={() => (window.location.hash = '#')}
            >
              Zur Startseite
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
function ClubRegistration() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contact, setContact] = useState('')

  async function registerClub() {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const memberCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { error } = await supabase
      .from('clubs')
      .insert([
        {
  name,
  slug,
  email,
  phone,
  member_code: memberCode
}
      ])

    if (error) {
      alert(error.message)
      return
    }

    alert(`Verein erfolgreich registriert!\n\nMitgliedscode: ${memberCode}`)

window.location.href = `/${slug}`
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 20 }}>
      <h1>Verein registrieren</h1>

      <input
        placeholder="Vereinsname"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Ansprechpartner"
        value={contact}
        onChange={e => setContact(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="E-Mail"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Telefon"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />

      <br /><br />

      
      <button onClick={registerClub}>
        Verein registrieren
      </button>
      <br /><br />

<button onClick={() => window.location.hash = '#club-login'}>
  Bereits registriert? Zum Vereins-Login
</button>
    </div>
  )
}
function PublicSignup() {
  const [form, setForm] = useState(emptyForm())
  const [vaccinationDates, setVaccinationDates] = useState([])
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('bar')
  const [showForm, setShowForm] = useState(true)
  const [countdown, setCountdown] = useState('')
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false)
  const [showMembershipInvitation, setShowMembershipInvitation] = useState(false)
  const [reuseLookup, setReuseLookup] = useState({ status: 'idle', email: '', token: '' })
  const [reuseConfirmation, setReuseConfirmation] = useState('')
  const checkedReuseEmailsRef = useRef(new Set())
  const reuseRequestRef = useRef(0)
  const reuseConfirmationTimerRef = useRef(null)
  const formEmailRef = useRef(form.email)
  formEmailRef.current = form.email
  const animalTotal = participantAnimalCountFields.reduce(
    (sum, { field }) => sum + (Number.isSafeInteger(Number(form[field])) && Number(form[field]) >= 0 ? Number(form[field]) : 0),
    0
  )
  
  const normalizeReuseEmail = value => String(value || '').trim().toLowerCase()
  const isValidReuseEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  const membershipInvitationStorageKey = 'rgzv-membership-invitation'

  const isMarkedTestRegistration = registration => {
    const name = `${registration?.firstname || ''} ${registration?.lastname || ''}`.trim().toLowerCase()
    return /(^|\s)(test|testdatensatz)(\s|$)/.test(name)
  }

  const rememberMembershipInvitation = ({ participantId, paymentAmount, registration, method }) => {
    const amountInCents = Math.round(Number(paymentAmount) * 100)
    const eligible = (
      amountInCents === 1000 &&
      (method === 'paypal' || method === 'stripe') &&
      !isMarkedTestRegistration(registration)
    )
    sessionStorage.setItem(
      membershipInvitationStorageKey,
      JSON.stringify({ participantId: String(participantId), eligible })
    )
  }

  const consumeMembershipInvitation = (participantId, emailSent) => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(membershipInvitationStorageKey) || '{}')
      sessionStorage.removeItem(membershipInvitationStorageKey)
      return Boolean(
        emailSent &&
        stored.eligible === true &&
        stored.participantId === String(participantId)
      )
    } catch {
      sessionStorage.removeItem(membershipInvitationStorageKey)
      return false
    }
  }

  const update = e => {
    const { name, value } = e.target
    if (participantAnimalCountFields.some(item => item.field === name) && value !== '' && !/^\d+$/.test(value)) return
    setForm(current => ({ ...current, [name]: value }))

    if (name === 'email' && normalizeReuseEmail(value) !== reuseLookup.email) {
      reuseRequestRef.current += 1
      setReuseLookup({ status: 'idle', email: '', token: '' })
      setReuseConfirmation('')
    }
  }

  async function checkPreviousRegistration(event) {
    const email = normalizeReuseEmail(event.target.value)
    if (!isValidReuseEmail(email)) return
    if (reuseLookup.status === 'found' && reuseLookup.email === email) return
    if (checkedReuseEmailsRef.current.has(email)) return

    const requestId = reuseRequestRef.current + 1
    reuseRequestRef.current = requestId
    setReuseLookup({ status: 'checking', email, token: '' })
    setReuseConfirmation('')

    try {
      const response = await fetch('/api/create-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup-participant',
          lookupAction: 'check',
          email,
          slug: getCurrentSlug()
        })
      })
      const result = await response.json().catch(() => ({}))
      if (requestId !== reuseRequestRef.current) return
      if (!response.ok) throw new Error('lookup unavailable')

      checkedReuseEmailsRef.current.add(email)
      setReuseLookup(result.found && result.lookupToken
        ? { status: 'found', email, token: result.lookupToken }
        : { status: 'idle', email, token: '' })
    } catch {
      if (requestId !== reuseRequestRef.current) return
      setReuseLookup({ status: 'error', email, token: '' })
    }
  }

  async function applyPreviousRegistration() {
    if (reuseLookup.status !== 'found' || !reuseLookup.token) return

    const lookupEmail = reuseLookup.email
    setReuseLookup(current => ({ ...current, status: 'retrieving' }))
    try {
      const response = await fetch('/api/create-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup-participant',
          lookupAction: 'retrieve',
          email: lookupEmail,
          slug: getCurrentSlug(),
          lookupToken: reuseLookup.token
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.profile) throw new Error('profile unavailable')
      if (normalizeReuseEmail(formEmailRef.current) !== lookupEmail) return

      const profile = result.profile
      setForm(current => ({
        ...current,
        firstname: profile.firstname || '',
        lastname: profile.lastname || '',
        street: profile.street || '',
        housenumber: profile.housenumber || '',
        zipcode: profile.zipcode || '',
        city: profile.city || '',
        phone: profile.phone || '',
        tsk_number: profile.tsk_number || ''
      }))
      setReuseLookup({ status: 'applied', email: lookupEmail, token: '' })
      setReuseConfirmation('Ihre Stammdaten wurden übernommen. Bitte prüfen Sie die Angaben und ergänzen Sie Tierzahl, Impfstoff und Impftermin.')
      window.clearTimeout(reuseConfirmationTimerRef.current)
      reuseConfirmationTimerRef.current = window.setTimeout(() => setReuseConfirmation(''), 6500)
    } catch {
      setReuseLookup({ status: 'error', email: lookupEmail, token: '' })
    }
  }

  function dismissPreviousRegistration() {
    setReuseLookup(current => ({ status: 'dismissed', email: current.email, token: '' }))
  }

  useEffect(() => () => window.clearTimeout(reuseConfirmationTimerRef.current), [])
 
  async function loadDates() {
  const clubId = await getDefaultClubId()
    const { data: clubData } = await supabase
  .from('clubs')
  .select('id,name,slug,guest_price,member_price')
  .eq('id', clubId)
  .single()

setClub(clubData)
  console.log("clubId =", clubId)

  const { data, error } = await supabase
    .from('vaccination_dates')
    .select('*')
    .eq('club_id', clubId)
    .order('date', { ascending: true })

  console.log("error =", error)
  console.log("data =", data)

  setVaccinationDates(data || [])
}
useEffect(() => {
  loadDates()
}, [])

useEffect(() => {
  if (!vaccinationDates?.[0]) return

  const timer = setInterval(() => {
    const target = new Date(vaccinationDates[0].date).getTime()
    const now = Date.now()

    const diff = target - now

    if (diff <= 0) {
      setCountdown('Impftermin läuft heute')
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    const seconds = Math.floor((diff / 1000) % 60)

    setCountdown(
      `${days}T ${hours}Std ${minutes}Min ${seconds}Sek`
    )
  }, 1000)

  return () => clearInterval(timer)
}, [vaccinationDates])
  async function finishPaypalPayment() {
    
    const params = new URLSearchParams(window.location.search)
    const paypal = params.get('paypal')
    const token = params.get('token')
    const participantId = params.get('participant')
const stripe = params.get('stripe')

    const cancelledProvider = paypal === 'cancel' ? 'paypal' : stripe === 'cancel' ? 'stripe' : null
    if (cancelledProvider) {
      const cancelToken = params.get('cancel_token')
      if (cancelToken) {
        try {
          await fetch('/api/create-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel-payment', provider: cancelledProvider, cancelToken })
          })
        } catch {
          // Der Datensatz bleibt bei einem Übertragungsfehler sicher als pending_payment erhalten.
        }
      }
      sessionStorage.removeItem(membershipInvitationStorageKey)
      setMessage('Die Onlinezahlung wurde abgebrochen. Es wurde keine Zahlung verbucht.')
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }
    
    if (paypal !== 'success' && stripe !== 'success') return
if (!participantId) return

    setMessage('PayPal-Zahlung wird bestätigt...')
setLoading(true)

if (stripe === 'success') {
  const response = await fetch('/api/stripe-confirm-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, sessionId: params.get('session_id') })
  })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'Stripe-Zahlung konnte nicht bestätigt werden.')
setMessage('Stripe-Zahlung erfolgreich bestätigt.')
  if (hasSupabase) {
    const emailWasSent = Boolean(result.emailSent)
    setConfirmationEmailSent(emailWasSent)
    setShowMembershipInvitation(consumeMembershipInvitation(participantId, emailWasSent))
    setShowPaymentSuccess(true)
  }
  setLoading(false)
  return
}
    try {
      const response = await fetch('/api/paypal-create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'capture', token, participantId })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'PayPal-Zahlung konnte nicht bestätigt werden')
      }

      const emailWasSent = Boolean(result.emailSent)
 
      setMessage('Zahlung erfolgreich bestätigt. Vielen Dank!')
      if (hasSupabase) {
        setConfirmationEmailSent(emailWasSent)
        setShowMembershipInvitation(consumeMembershipInvitation(participantId, emailWasSent))
        setShowPaymentSuccess(true)
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch (error) {
      setMessage('Fehler bei Zahlungsbestätigung: ' + error.message)
    } finally {
      setLoading(false)
    }
  }
useEffect(() => {
  finishPaypalPayment()
}, [])
  async function submit(e) {
    e.preventDefault(); setMessage(''); setLoading(true)
    if (!hasSupabase) {
      setMessage(supabaseConfigMessage)
      setLoading(false)
      return
    }
    if (!privacyAccepted) {
  setMessage('Bitte der Datenschutzerklärung zustimmen.')
  setLoading(false)
  return
}
    if (!PAYPAL_ENABLED && paymentMethod === 'paypal') {
      setMessage('PayPal steht derzeit nicht zur Verfügung.')
      setLoading(false)
      return
    }
    if (!STRIPE_ENABLED && paymentMethod === 'stripe') {
      setMessage('Online-Zahlung über Stripe steht derzeit nicht zur Verfügung.')
      setLoading(false)
      return
    }
    if (animalTotal < 1) {
      setMessage('Bitte geben Sie für mindestens eine Tierart eine Anzahl ein.')
      setLoading(false)
      return
    }
    const { member_code, ...formData } = form
    try {
      let participantId = null
      let paymentAmount = 10
      let registrationEmailSent = false
      if (hasSupabase) {
        const response = await fetch('/api/create-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            member_code,
            vaccination_date_id: form.vaccination_date_id,
            payment_method: paymentMethod
          })
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Anmeldung konnte nicht gespeichert werden.')
        participantId = result.participantId
        paymentAmount = Number(result.paymentAmount || 10)
        registrationEmailSent = Boolean(result.emailSent)
      } else {
        paymentAmount = 10
        const animalType = participantAnimalCountFields
          .filter(({ field }) => Number(form[field] || 0) > 0)
          .map(({ label }) => label)
          .join(', ')
        const payload = { ...formData, animal_type: animalType, animal_count: animalTotal, club_id: await getDefaultClubId(), vaccination_date_id: form.vaccination_date_id, payment_status: 'offen', payment_amount: paymentAmount, payment_method: paymentMethod === 'bar' ? 'bar' : null, is_member: false }
        const list = JSON.parse(localStorage.getItem('participants') || '[]')
        list.push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
        localStorage.setItem('participants', JSON.stringify(list))
      }
      if (paymentMethod === 'bar') {
        setMessage(
          registrationEmailSent
            ? 'Anmeldung erfolgreich gespeichert. Die Bestätigungs-E-Mail wurde versendet. Die Teilnahmegebühr wird am Impftag vor Ort in bar bezahlt.'
            : 'Anmeldung erfolgreich gespeichert. Die Bestätigungs-E-Mail konnte möglicherweise nicht versendet werden. Die Teilnahmegebühr wird am Impftag vor Ort in bar bezahlt.'
        )
        setConfirmationEmailSent(registrationEmailSent)
        setShowMembershipInvitation(false)
        setShowPaymentSuccess(true)
        setForm(emptyForm())
        return
      }
      setMessage('Anmeldung gespeichert. Du wirst jetzt zur Bezahlung weitergeleitet.')
      setForm(emptyForm())
      const endpoint =
  paymentMethod === 'stripe'
    ? '/api/stripe-create-checkout'
    : '/api/paypal-create-order'

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(
    paymentMethod === 'stripe'
      ? { participantId }
      : { participantId }
  )
})

const result = await response.json()

if (result.url) {
  rememberMembershipInvitation({
    participantId,
    paymentAmount,
    registration: formData,
    method: paymentMethod
  })
  window.location.href = result.url
} else {
  setMessage(
    'Fehler bei der Zahlung: ' +
    (result.error || JSON.stringify(result))
  )
}
    } catch (err) { setMessage('Fehler: ' + err.message) }
    finally { setLoading(false) }
  }

if (!showForm) {
  return (
    <div className="page">
      <Header />
      <main
  className="card"
  style={{
    maxWidth: '900px',
    margin: '40px auto'
  }}
>
  <div
    style={{
      background:'#1f2937',
      color:'white',
      padding:'40px',
      borderRadius:'20px',
      marginBottom:'30px'
    }}
  >
    <div
  style={{
    color:'#ff7a00',
    fontWeight:'700',
    marginBottom:'10px'
  }}
>
  {club?.name || 'RGZV Hagen und Umgebung seit 1903 e.V.'}
</div>

    <h1
      style={{
        color:'white',
        margin:'0 0 20px 0'
      }}
    >
      Sammelimpfung {club ? `- ${club.name}` : 'gegen die Newcastle-Krankheit'}
    </h1>

    <p
      style={{
        color:'#d1d5db',
        fontSize:'18px'
      }}
    >
      {club
  ? `Einfache Online-Anmeldung zur gesetzlichen Newcastle-Impfung des ${club.name}.`
  : 'Einfache Online-Anmeldung zur gesetzlichen Newcastle-Impfung für Geflügelhalter.'}
    </p>
  </div>

  <div
    style={{
      display:'flex',
      gap:'20px',
      flexWrap:'wrap',
      marginBottom:'30px'
    }}
  >
    <div
      style={{
        background:'#f3f4f6',
        padding:'20px',
        borderRadius:'12px'
      }}
    >
      <div>Nächster Impftermin</div>
      <strong>
        {vaccinationDates?.[0]
          ? new Date(vaccinationDates[0].date).toLocaleDateString('de-DE')
          : 'Noch nicht festgelegt'}
      </strong>
      <div
  style={{
    marginTop: '8px',
    color: '#16a34a',
    fontWeight: '700',
    fontSize: '14px'
  }}
>
  <div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginTop: '20px'
  }}
>
  {countdown.split(' ').map((item, i) => (
    <div
      key={i}
      style={{
        background: '#fff',
        borderRadius: '10px',
        padding: '10px',
        textAlign: 'center'
      }}
    >
      <strong style={{ display: 'block', fontSize: '18px' }}>
        {item.replace(/[A-Za-z]+/g, '')}
      </strong>
      <small>
        {item.includes('T')
          ? 'Tage'
          : item.includes('Std')
          ? 'Stunden'
          : item.includes('Min')
          ? 'Minuten'
          : 'Sekunden'}
      </small>
    </div>
  ))}
</div>
</div>
    </div>

    <div
      style={{
        background:'#f3f4f6',
        padding:'20px',
        borderRadius:'12px'
      }}
    >
      <div>Teilnahmegebühr</div>
      <strong>{club?.guest_price ?? 10} € / {club?.member_price ?? 5} €</strong>
      <p
  style={{
    marginTop:'10px',
    fontSize:'14px',
    color:'#6b7280'
  }}
>
  10 € für Gäste<br />
  5 € für Mitglieder des {club?.name || 'Vereins'} mit gültigem Mitgliedscode
</p>
      <aside className="participation-fee-notice" role="note">
        <span className="participation-fee-notice-icon" aria-hidden="true">!</span>
        <div>
          <h3>Hinweis zur Teilnahmegebühr</h3>
          <p>
            Die Teilnahmegebühr wird mit der verbindlichen Anmeldung fällig. Der
            Impfstoff wird ausschließlich auf Grundlage der eingegangenen
            Anmeldungen bestellt und bereitgestellt.
          </p>
          <p>
            Bei einer Absage oder einem unentschuldigten Nichterscheinen kann die
            bereits entrichtete Teilnahmegebühr daher grundsätzlich nicht
            erstattet werden.
          </p>
          <p>
            Sollte in begründeten Ausnahmefällen eine Erstattung möglich sein,
            entscheidet der Veranstalter im Einzelfall.
          </p>
        </div>
      </aside>
    </div>
  </div>

  <h2>Warum ist die Newcastle-Impfung wichtig?</h2>

<p>
  Die Newcastle-Krankheit (Atypische Geflügelpest) ist eine
  hochansteckende und anzeigepflichtige Viruserkrankung des Geflügels.
  Zum Schutz der Tierbestände schreibt der Gesetzgeber eine regelmäßige
  Impfung von Geflügel vor.
</p>

<p>
  Die Impfpflicht gilt bereits ab dem ersten gehaltenen Tier.
  Unabhängig davon, ob nur wenige Hühner im Garten gehalten werden oder
  ein größerer Bestand vorhanden ist, müssen die Tiere entsprechend den
  geltenden Vorschriften gegen die Newcastle-Krankheit geimpft werden.
</p>

<p>
  Mit der Sammelimpfung des {club?.name || 'RGZV Hagen und Umgebung seit 1903 e.V.'}
  bieten wir Geflügelhaltern eine einfache und kostengünstige
  Möglichkeit, dieser Verpflichtung nachzukommen. Die Anmeldung, Bezahlung und Organisation erfolgen bequem online über die Impfgruppen-App des Vereins.
</p>
<div
  style={{
    background:'#f9fafb',
    padding:'20px',
    borderRadius:'12px',
    marginTop:'25px',
    marginBottom:'25px'
  }}
>
  <h3>Ihre Vorteile</h3>

  <p>✔ Online anmelden</p>
  <p>✔ Online bezahlen</p>
  <p>✔ Automatische Bestätigung per E-Mail</p>
  <p>✔ Offizielle Sammelimpfbescheinigung</p>

  <p style={{ marginTop:'15px', fontWeight:'600' }}>
    Bei Nichterscheinen kann die Teilnahmegebühr nicht erstattet werden.
  </p>
</div>
  <button
  onClick={() => window.location.hash = '#'}
  className="primary"
  style={{ marginTop:'20px' }}
>
  Jetzt zur Anmeldung
</button>
<p style={{ marginTop: '30px', textAlign: 'center' }}>
  Sie möchten Ihren Verein registrieren?{' '}
  <a
    href="#register"
    style={{
      color: '#2563eb',
      fontWeight: 'bold',
      textDecoration: 'none'
    }}
  >
    Hier klicken
  </a>
</p>
</main>

<Footer />

</div>
)
}
  return (
  <>
  <div className="page signup-page">
    <Header />
    <main
      className="signup-shell"
>
      <section className="signup-hero">
        <div className="signup-eyebrow">Online-Anmeldung</div>
        <h1>Teilnehmer anmelden</h1>
        <p>Registrieren Sie Ihre Tiere einfach und sicher für den nächsten Impftermin.</p>
      </section>

      <section className="card signup-card">
        <div className="signup-card-heading">
          <span>Impfgruppe RGZV Hagen</span>
          <h2>Ihre Anmeldung</h2>
          <p>Bitte füllen Sie die folgenden Angaben vollständig aus.</p>
        </div>
        <div className="section-title signup-section-title">
  Persönliche Daten
</div>

<div className="form-section signup-form-section">

<form onSubmit={submit} className="form signup-form">
          <div className="two"><Input label="Vorname" name="firstname" value={form.firstname} onChange={update} required/><Input label="Nachname" name="lastname" value={form.lastname} onChange={update} required/></div>
          <div className="two"><Input label="Straße" name="street" value={form.street} onChange={update}/><Input label="Hausnummer" name="housenumber" value={form.housenumber} onChange={update}/></div>
          <div className="two"><Input label="PLZ" name="zipcode" value={form.zipcode} onChange={update}/><Input label="Ort" name="city" value={form.city} onChange={update}/></div>
          <div className="two"><Input label="E-Mail" name="email" type="email" value={form.email} onChange={update} onBlur={checkPreviousRegistration} required/><Input label="Telefon" name="phone" value={form.phone} onChange={update}/></div>

          {reuseLookup.status === 'checking' && (
            <p className="signup-reuse-status" role="status">Frühere Anmeldung wird geprüft …</p>
          )}

          {(reuseLookup.status === 'found' || reuseLookup.status === 'retrieving') && (
            <aside className="signup-reuse-card" aria-labelledby="signup-reuse-title">
              <div>
                <h3 id="signup-reuse-title">Frühere Anmeldung gefunden</h3>
                <p>Für diese E-Mail-Adresse wurden bereits Anmeldedaten gefunden. Möchten Sie Ihre zuletzt verwendeten Stammdaten übernehmen?</p>
              </div>
              <div className="signup-reuse-actions">
                <button type="button" className="primary" onClick={applyPreviousRegistration} disabled={reuseLookup.status === 'retrieving'}>
                  {reuseLookup.status === 'retrieving' ? 'Stammdaten werden übernommen …' : 'Ja, Stammdaten übernehmen'}
                </button>
                <button type="button" className="ghost" onClick={dismissPreviousRegistration} disabled={reuseLookup.status === 'retrieving'}>
                  Nein, neu eingeben
                </button>
              </div>
            </aside>
          )}

          {reuseLookup.status === 'error' && (
            <p className="signup-reuse-status signup-reuse-error" role="status">
              Die automatische Datenübernahme ist derzeit nicht verfügbar. Bitte geben Sie Ihre Daten erneut ein.
            </p>
          )}

          {reuseConfirmation && (
            <p className="signup-reuse-confirmation" role="status">{reuseConfirmation}</p>
          )}
     
          <div className="section-title signup-section-title">
  Tierhalterdaten
</div>
          <Input label="TSK Betriebsnummer." name="tsk_number" value={form.tsk_number} onChange={update} required/>
          <Input
  label="Mitgliedercode (optional)"
  name="member_code"
  value={form.member_code}
  onChange={update}
/>
  

<p
  style={{
    marginTop: '8px',
    marginBottom: '16px',
    color: '#6b7280',
    fontSize: '14px'
  }}
>
  Optional: Mitglieder Ihres Vereins erhalten bei Eingabe eines gültigen Mitgliedscodes automatisch den vergünstigten Preis.
</p>

          <div className="signup-animal-counts">
            <Input label="Anzahl Hühner" name="chicken_count" type="number" min="0" step="1" value={form.chicken_count} onChange={update}/>
            <Input label="Anzahl Zwerghühner" name="bantam_count" type="number" min="0" step="1" value={form.bantam_count} onChange={update}/>
            <Input label="Anzahl Puten" name="turkey_count" type="number" min="0" step="1" value={form.turkey_count} onChange={update}/>
          </div>
          <p className="signup-animal-total" aria-live="polite">Gesamtzahl Tiere: <strong>{animalTotal}</strong></p>
          <label>Impfstoff<input value="Newcastle-Impfung" readOnly aria-readonly="true" /></label>
          <div className="section-title signup-section-title">
  Impfung
</div>
          <select
  name="vaccination_date_id"
value={form.vaccination_date_id}
  onChange={update}
  required
>
  <option value="">Bitte Impftermin wählen</option>

  {vaccinationDates.map(v => (
    <option key={v.id} value={v.id}>
      {v.title} - {new Date(v.date).toLocaleDateString('de-DE')}
    </option>
  ))}
</select>
          <div className="section-title signup-section-title">
  Zahlung & Datenschutz
</div>
          <label className="privacy-check">
  <input
    type="checkbox"
    checked={privacyAccepted}
    onChange={e => setPrivacyAccepted(e.target.checked)}
  />
  Ich habe die Datenschutzerklärung gelesen und stimme der Verarbeitung meiner Daten zu.
</label>
   <div className="payment-methods" style={{ marginTop: '15px', marginBottom: '15px' }}>
  <strong>Zahlungsart:</strong>

  <div className="payment-option" style={{ marginTop: '10px', opacity: PAYPAL_ENABLED ? 1 : 0.65 }}>
    <input
      type="radio"
      name="paymentMethod"
      value="paypal"
      checked={paymentMethod === 'paypal'}
      onChange={(e) => setPaymentMethod(e.target.value)}
      disabled={!PAYPAL_ENABLED}
      aria-describedby="paypal-unavailable-note"
    />
    <span style={{ marginLeft: '8px' }}>
      ⚠️ PayPal – Derzeit nicht verfügbar
    </span>
    {!PAYPAL_ENABLED && (
      <p id="paypal-unavailable-note" style={{ margin: '6px 0 0 26px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
        PayPal steht derzeit nicht zur Verfügung.
      </p>
    )}
  </div>

  <div className="payment-option" style={{ marginTop: '10px', opacity: STRIPE_ENABLED ? 1 : 0.65 }}>
    <input
      type="radio"
      name="paymentMethod"
      value="stripe"
      checked={paymentMethod === 'stripe'}
      onChange={(e) => setPaymentMethod(e.target.value)}
      disabled={!STRIPE_ENABLED}
      aria-describedby="stripe-unavailable-note"
    />
    <span style={{ marginLeft: '8px' }}>
      Stripe / Online-Zahlung – Derzeit nicht verfügbar
    </span>
    {!STRIPE_ENABLED && (
      <p id="stripe-unavailable-note" style={{ margin: '6px 0 0 26px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
        Online-Zahlung über Stripe steht derzeit nicht zur Verfügung.
      </p>
    )}
  </div>

  <div className="payment-option" style={{ marginTop: '10px', opacity: 0.65 }}>
    <input
      type="radio"
      name="paymentMethod"
      value="sepa"
      disabled
      aria-describedby="sepa-unavailable-note"
    />
    <span style={{ marginLeft: '8px' }}>
      SEPA-Lastschrift – Derzeit nicht verfügbar
    </span>
    <p id="sepa-unavailable-note" style={{ margin: '6px 0 0 26px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
      SEPA-Lastschrift steht derzeit nicht zur Verfügung. Bitte nutzen Sie Kreditkarte, Apple Pay, Google Pay oder Barzahlung vor Ort.
    </p>
  </div>

  <div className="payment-option" style={{ marginTop: '10px' }}>
    <input
      type="radio"
      name="paymentMethod"
      value="bar"
      checked={paymentMethod === 'bar'}
      onChange={(e) => setPaymentMethod(e.target.value)}
    />
    <span style={{ marginLeft: '8px' }}>Barzahlung vor Ort – Verfügbar</span>
  </div>

  <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
    Online-Zahlungen stehen derzeit nicht zur Verfügung. Bitte wählen Sie für Ihre Anmeldung „Barzahlung vor Ort“.
  </p>

  <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
    {paymentMethod === 'bar'
      ? 'Die Teilnahmegebühr bezahlen Sie am Impftag vor Ort in bar. Es erfolgt keine Weiterleitung zu einem Zahlungsdienstleister.'
      : paymentMethod === 'stripe'
        ? 'Nach der Anmeldung werden Sie zur sicheren Zahlung per Kreditkarte, Apple Pay oder Google Pay weitergeleitet.'
        : 'Nach der Anmeldung werden Sie zur sicheren Zahlung mit PayPal weitergeleitet.'}
  </p>
</div>
          <aside
            className="participation-fee-notice participation-fee-notice-compact"
            role="note"
          >
            <span className="participation-fee-notice-icon" aria-hidden="true">!</span>
            <p>
              <strong>Hinweis:</strong> Mit Ihrer verbindlichen Anmeldung wird Ihr
              Teilnahmeplatz fest reserviert und der Impftermin auf Grundlage
              aller eingegangenen Anmeldungen organisiert. Bei einer Absage oder
              einem unentschuldigten Nichterscheinen besteht kein Anspruch auf
              Erstattung der bereits entrichteten Teilnahmegebühr.
            </p>
          </aside>
          <button disabled={loading} className="primary signup-submit">
            {loading
              ? 'Speichern...'
              : paymentMethod === 'bar'
                ? animalTotal > 0
                  ? `${animalTotal} Tiere verbindlich zur Newcastle-Impfung anmelden`
                  : 'Verbindlich zur Newcastle-Impfung anmelden'
                : animalTotal > 0
                  ? `${animalTotal} Tiere zur Newcastle-Impfung anmelden & bezahlen`
                  : 'Zur Newcastle-Impfung anmelden & bezahlen'}
          </button>
          {message && <p className="message">{message}</p>}
        </form>
  </div>
      </section>
          </main>
    <button
  type="button"
  className="ghost"
  onClick={() => window.location.hash = '#'}
>
  ← Zurück
</button>
    <Footer />
  </div>
  {showPaymentSuccess && (
    <SignupSuccessOverlay
      emailSent={confirmationEmailSent}
      showMembershipInvitation={showMembershipInvitation}
      onHome={() => {
        setShowPaymentSuccess(false)
        setShowMembershipInvitation(false)
        window.location.hash = '#'
      }}
      onAnother={() => {
        setShowPaymentSuccess(false)
        setConfirmationEmailSent(false)
        setShowMembershipInvitation(false)
        setForm(emptyForm())
        reuseRequestRef.current += 1
        setReuseLookup({ status: 'idle', email: '', token: '' })
        setReuseConfirmation('')
        setPrivacyAccepted(false)
        setPaymentMethod('stripe')
        setMessage('')
      }}
    />
  )}
  </>
)
}

function MembershipInvitationCard() {
  return (
    <aside className="membership-invitation-card" aria-labelledby="membership-invitation-title">
      <h3 id="membership-invitation-title">Schön, dass Sie dabei sind!</h3>
      <div className="membership-invitation-intro">
        <p>Vielen Dank für Ihre Anmeldung!</p>
        <p>Wir freuen uns sehr, Sie bei unserer Newcastle-Sammelimpfung begrüßen zu dürfen.</p>
        <p>Vielleicht haben Sie ja Lust, unseren Verein auch einmal abseits des Impftages kennenzulernen.</p>
        <p>Der <strong>RGZV Hagen und Umgebung seit 1903 e. V.</strong> lebt von Menschen, die Freude an Geflügel, der Gemeinschaft und dem Austausch mit Gleichgesinnten haben.</p>
        <p>Ganz gleich, ob Sie bereits Rassegeflügel züchten, Hobbyhalter sind oder einfach einmal unverbindlich vorbeischauen möchten – Sie sind bei uns jederzeit herzlich willkommen.</p>
      </div>

      <div className="membership-invitation-questions">
        <section>
          <h4>Wann treffen wir uns?</h4>
          <p>Unsere Vereinsabende finden regelmäßig <strong>an jedem ersten Mittwoch im Monat</strong> statt.</p>
          <p>Der genaue Veranstaltungsort kann gelegentlich wechseln und wird deshalb immer aktuell auf unserer Homepage im Laufband bekanntgegeben.</p>
          <p>So wissen Sie jederzeit, wo wir uns treffen.</p>
        </section>
        <section>
          <h4>Muss ich Mitglied sein?</h4>
          <p>Nein.</p>
          <p>Ganz im Gegenteil!</p>
          <p>Wir freuen uns immer über Gäste, die unseren Verein ganz unverbindlich kennenlernen möchten.</p>
          <p>Schauen Sie einfach vorbei und machen Sie sich selbst ein Bild.</p>
        </section>
        <section>
          <h4>Kann ich einfach vorbeikommen?</h4>
          <p>Ja, selbstverständlich!</p>
          <p>Eine Anmeldung ist nicht erforderlich.</p>
          <p>Kommen Sie einfach vorbei – wir freuen uns darauf, Sie persönlich kennenzulernen.</p>
        </section>
        <section>
          <h4>Was erwartet mich?</h4>
          <p>Vor allem eine bunt gemischte Gemeinschaft von Menschen, die eines verbindet:</p>
          <p>Die Freude am schönen Rassegeflügel.</p>
          <p>Bei unseren Vereinsabenden wird gefachsimpelt, gelacht, Erfahrungen werden ausgetauscht und natürlich geht es auch um Zucht, Haltung, Ausstellungen und alles, was unser gemeinsames Hobby so besonders macht.</p>
          <p>Ganz egal, ob Sie gerade erst anfangen oder schon viele Jahre Geflügel halten – bei uns findet jeder ein offenes Ohr und nette Gesprächspartner.</p>
        </section>
        <section>
          <h4>Wie werde ich Mitglied?</h4>
          <p>Ganz unkompliziert.</p>
          <p>Sprechen Sie uns einfach bei einem Vereinsabend an.</p>
          <p>Wir beantworten gerne alle Ihre Fragen und freuen uns, wenn wir Sie vielleicht schon bald als neues Mitglied in unserem Verein begrüßen dürfen.</p>
        </section>
      </div>

      <div className="membership-invitation-closing">
        <p>Wir würden uns sehr freuen, Sie auch einmal persönlich außerhalb eines Impftermins begrüßen zu dürfen.</p>
        <p>Vielleicht ist Ihr erster Besuch ja der Beginn eines neuen gemeinsamen Hobbys.</p>
      </div>

      <a
        className="membership-invitation-link"
        href="https://www.rgzv-hagen-westfalen.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        🏠 Mehr über unseren Verein erfahren
      </a>
    </aside>
  )
}

function SignupSuccessOverlay({ emailSent, showMembershipInvitation, onHome, onAnother }) {
  const homeButtonRef = useRef(null)
  const onHomeRef = useRef(onHome)
  const leaveTimerRef = useRef(null)
  const leavingRef = useRef(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const confetti = Array.from({ length: 24 }, (_, index) => ({
    id: index,
    x: `${((index * 73) % 520) - 260}px`,
    y: `${100 + ((index * 47) % 210)}px`,
    rotate: `${180 + ((index * 59) % 300)}deg`
  }))

  useEffect(() => {
    onHomeRef.current = onHome
  }, [onHome])

  const leave = action => {
    if (leavingRef.current) return
    leavingRef.current = true
    setIsLeaving(true)
    leaveTimerRef.current = window.setTimeout(action, 240)
  }

  useEffect(() => {
    const timer = showMembershipInvitation
      ? null
      : window.setTimeout(() => leave(onHomeRef.current), 8000)
    homeButtonRef.current?.focus()

    return () => {
      if (timer) window.clearTimeout(timer)
      window.clearTimeout(leaveTimerRef.current)
    }
  }, [showMembershipInvitation])

  return (
    <div className={`signup-success-overlay${isLeaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
      <section className={`signup-success-card${showMembershipInvitation ? ' has-membership-invitation' : ''}`} role="status" aria-live="polite">
        <div className="signup-success-confetti" aria-hidden="true">
          {confetti.map(piece => (
            <i
              key={piece.id}
              className="signup-success-confetti-piece"
              style={{ '--confetti-x': piece.x, '--confetti-y': piece.y, '--confetti-rotate': piece.rotate }}
            />
          ))}
        </div>
        <div className="signup-success-icon" aria-hidden="true">
          <svg viewBox="0 0 52 52" focusable="false">
            <path d="M14 27.5 22 35.5 39 17.5" />
          </svg>
        </div>
        <h2 id="signup-success-title">Anmeldung erfolgreich!</h2>
        <p>Vielen Dank für Ihre Anmeldung.<br />Ihre Daten wurden erfolgreich gespeichert.</p>
        {emailSent && <p className="signup-success-email">Eine Bestätigungs-E-Mail wurde an Ihre E-Mail-Adresse versendet.</p>}
        {showMembershipInvitation && <MembershipInvitationCard />}
        <div className="signup-success-actions">
          <button ref={homeButtonRef} type="button" className="signup-success-home" onClick={() => leave(onHome)}>Zur Startseite</button>
          <button type="button" className="signup-success-another" onClick={() => leave(onAnother)}>Weitere Anmeldung erfassen</button>
        </div>
      </section>
    </div>
  )
}

function CheckinPanel({ participants, vaccinationDates, onChanged, adminRole }) {
  const [dateId, setDateId] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [quickFilter, setQuickFilter] = useState('')
  const [actionId, setActionId] = useState('')
  const [participantOverrides, setParticipantOverrides] = useState({})
  const [candidate, setCandidate] = useState(null)
  const [qrImage, setQrImage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const scannerRef = useRef(null)
  const scannerBusyRef = useRef(false)
  const selectedParticipants = participants
    .filter(item => String(item.vaccination_date_id) === String(dateId))
    .map(item => ({ ...item, ...(participantOverrides[item.id] || {}) }))
  const checkedIn = selectedParticipants.filter(item => item.checked_in).length
  const paid = selectedParticipants.filter(item => item.payment_status === 'bezahlt').length
  const liveStats = [
    { label: 'Angemeldet', icon: '👥', value: selectedParticipants.length, tone: 'neutral', filter: 'all' },
    { label: 'Eingecheckt', icon: '✅', value: checkedIn, tone: 'positive', filter: 'checked-in' },
    { label: 'Noch erwartet', icon: '⏳', value: Math.max(0, selectedParticipants.length - checkedIn), tone: 'warning', filter: 'expected' },
    { label: 'Bezahlt', icon: '💶', value: paid, tone: 'positive', filter: 'paid' },
    { label: 'Offen', icon: '⚠️', value: Math.max(0, selectedParticipants.length - paid), tone: 'warning', filter: 'open' },
    { label: 'Tiere', icon: '🐔', value: selectedParticipants.reduce((sum, item) => sum + Number(item.animal_count || 0), 0), tone: 'neutral', filter: 'animals' }
  ]
  const canManagePayments = adminRole === 'clubadmin' || adminRole === 'superadmin'
  const selectedVaccinationDate = vaccinationDates.find(date => String(date.id) === String(dateId))

  function maskParticipantEmail(value) {
    const [localPart = '', domain = ''] = String(value || '').split('@')
    if (!domain) return ''
    return `${localPart.slice(0, 2)}${localPart.length > 2 ? '***' : ''}@${domain}`
  }

  function participantPhoneSuffix(value) {
    return String(value || '').replace(/\D/g, '').slice(-4)
  }

  const filterParticipants = selectedParticipants.map(item => ({
    ...item,
    email_masked: maskParticipantEmail(item.email),
    phone_suffix: participantPhoneSuffix(item.phone),
    vaccination_date: selectedVaccinationDate?.date || '',
    vaccination_title: selectedVaccinationDate?.title || 'Impftermin',
    other_appointment: false
  }))
  const quickFilterResults = quickFilter
    ? filterParticipants
      .filter(item => {
        if (quickFilter === 'checked-in') return item.checked_in
        if (quickFilter === 'expected') return !item.checked_in
        if (quickFilter === 'paid') return item.payment_status === 'bezahlt'
        if (quickFilter === 'open') return item.payment_status !== 'bezahlt'
        return true
      })
      .sort((left, right) => quickFilter === 'animals'
        ? Number(right.animal_count || 0) - Number(left.animal_count || 0)
        : `${left.lastname} ${left.firstname}`.localeCompare(`${right.lastname} ${right.firstname}`, 'de'))
    : []
  const displayedResults = query.trim().length >= 2 ? searchResults : quickFilterResults

  useEffect(() => () => { scannerRef.current?.stop?.().catch(() => {}) }, [])
  useEffect(() => {
    if (dateId || !vaccinationDates.length) return
    const today = new Date().toISOString().slice(0, 10)
    const nextDate = vaccinationDates.find(date => date.date >= today) || vaccinationDates[0]
    if (nextDate) setDateId(String(nextDate.id))
  }, [dateId, vaccinationDates])
  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!dateId || trimmedQuery.length < 2) {
      setSearchResults([])
      setSearching(false)
      return undefined
    }
    let active = true
    setSearching(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ action: 'search-participants', vaccinationDateId: dateId, query: trimmedQuery })
        })
        const result = await response.json()
        if (!active) return
        if (!response.ok) {
          setSearchResults([])
          setFeedback(result.error || 'Teilnehmersuche derzeit nicht möglich.')
          return
        }
        setSearchResults(result.participants || [])
        setFeedback('')
      } catch {
        if (active) {
          setSearchResults([])
          setFeedback('Teilnehmersuche derzeit nicht möglich.')
        }
      } finally {
        if (active) setSearching(false)
      }
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [dateId, query])

  function formatDate(value) {
    if (!value) return '–'
    return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T12:00:00`))
  }

  function formatCheckinTime(value) {
    if (!value) return ''
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  }

  function checkinPaymentMethodLabel(value) {
    if (value === 'bar') return 'Barzahlung vor Ort'
    if (value === 'paypal') return 'PayPal'
    if (value === 'stripe') return 'Kreditkarte / Apple Pay / Google Pay'
    return 'Noch nicht festgelegt'
  }

  function formatPaymentAmount(value) {
    return `${Number(value || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} €`
  }

  async function showQr(participant) {
    setCandidate(participant)
    setFeedback('')
    setQrImage(await QRCode.toDataURL(participant.checkin_token, { width: 280, margin: 1, color: { dark: '#123c2b', light: '#ffffff' } }))
  }
  async function startScanner() {
    if (!dateId) return setFeedback('Bitte wählen Sie zuerst einen Impftermin.')
    if (scannerActive || (candidate && candidate.payment_status !== 'bezahlt' && !candidate.checked_in)) return
    setCandidate(null)
    setQrImage('')
    scannerBusyRef.current = false
    setScannerActive(true)
    setFeedback('')
    requestAnimationFrame(async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('checkin-scanner')
      scannerRef.current = scanner
      await scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 230, height: 230 } }, async token => {
        if (scannerBusyRef.current) return
        scannerBusyRef.current = true
        await scanner.stop().catch(() => {})
        scannerRef.current = null
        setScannerActive(false)
        await loadScannedParticipant(token)
      }, () => {})
    })
  }

  async function loadScannedParticipant(token) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'qr-preview', token, vaccinationDateId: dateId })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.participant) {
        setCandidate(null)
        setFeedback(
          result.error === 'Der Teilnehmer gehört nicht zu diesem Impftermin.'
            ? result.error
            : response.status === 401 || response.status === 403
              ? 'Keine Berechtigung für diesen Check-in.'
            : result.error || 'Die Teilnehmerdaten konnten nicht geladen werden.'
        )
        return
      }
      const scannedParticipant = { ...result.participant, checkin_token: token }
      setCandidate(scannedParticipant)
      if (scannedParticipant.checked_in) {
        setFeedback(
          scannedParticipant.payment_status === 'bezahlt'
            ? 'Dieser Teilnehmer wurde bereits eingecheckt.'
            : 'Dieser Teilnehmer wurde bereits eingecheckt. Die Teilnahmegebühr ist weiterhin offen.'
        )
        return
      }
      if (scannedParticipant.payment_status === 'bezahlt') {
        await saveQrCheckin(scannedParticipant, false, 'Check-in erfolgreich gespeichert.')
        return
      }
      setFeedback('Achtung: Die Teilnahmegebühr dieses Teilnehmers ist noch offen.')
    } catch {
      setCandidate(null)
      setFeedback('Die Teilnehmerdaten konnten nicht geladen werden.')
    }
  }

  async function saveQrCheckin(participant, allowOpenPayment, successMessage, checkedInValue = true) {
    if (!participant || !dateId || actionId) return false
    setActionId(participant.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          action: 'qr-checkin',
          token: participant.checkin_token,
          vaccinationDateId: dateId,
          checkedIn: checkedInValue,
          allowOpenPayment
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.participant) setCandidate({ ...participant, ...result.participant })
        const knownStatusMessage = [
          'Dieser Teilnehmer wurde bereits eingecheckt.',
          'Achtung: Die Teilnahmegebühr dieses Teilnehmers ist noch offen.'
        ].includes(result.error)
        setFeedback(
          response.status === 401 || response.status === 403
            ? 'Keine Berechtigung für diesen Check-in.'
            : knownStatusMessage
              ? result.error
              : 'Der Teilnehmer konnte nicht eingecheckt werden.'
        )
        return false
      }
      setFeedback(checkedInValue ? successMessage : 'Check-in wurde zurückgesetzt.')
      setCandidate({ ...participant, ...result.participant })
      setParticipantOverrides(current => ({
        ...current,
        [participant.id]: { ...(current[participant.id] || {}), ...result.participant }
      }))
      await onChanged()
      return true
    } catch {
      setFeedback('Der Teilnehmer konnte nicht eingecheckt werden.')
      return false
    } finally {
      setActionId('')
      scannerBusyRef.current = false
    }
  }

  async function saveCashPaymentAndCheckin(participant) {
    if (!participant || !dateId || actionId || !canManagePayments) return
    setActionId(participant.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          action: 'manual-update',
          participantId: participant.id,
          vaccinationDateId: dateId,
          markPaid: true,
          checkIn: true
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (result.participant) {
          setCandidate({ ...participant, ...result.participant })
          setParticipantOverrides(current => ({
            ...current,
            [participant.id]: { ...(current[participant.id] || {}), ...result.participant }
          }))
        }
        const knownStatusMessage = [
          'Diese Zahlung wurde bereits verbucht.',
          'Dieser Teilnehmer wurde bereits eingecheckt.',
          'Die Aktion wurde bereits ausgeführt. Bitte Status aktualisieren.'
        ].includes(result.error)
        setFeedback(
          response.status === 401 || response.status === 403
            ? 'Keine Berechtigung für diesen Check-in.'
            : knownStatusMessage
              ? result.error
              : 'Die Zahlung und der Check-in konnten nicht gespeichert werden.'
        )
        return
      }
      setCandidate({ ...participant, ...result.participant })
      setParticipantOverrides(current => ({
        ...current,
        [participant.id]: { ...(current[participant.id] || {}), ...result.participant }
      }))
      setFeedback('Die Barzahlung wurde erfasst und der Teilnehmer wurde eingecheckt.')
      await onChanged()
    } catch {
      setFeedback('Die Zahlung und der Check-in konnten nicht gespeichert werden.')
    } finally {
      setActionId('')
      scannerBusyRef.current = false
    }
  }

  function cancelQrDecision() {
    setCandidate(null)
    setQrImage('')
    setFeedback('')
    scannerBusyRef.current = false
  }

  async function runManualAction(participant, { markPaid = false, checkIn = false }) {
    if (actionId || (checkIn && participant.checked_in)) return
    if (markPaid) {
      const question = checkIn
        ? 'Zahlung verbuchen und Teilnehmer gleichzeitig einchecken?'
        : 'Vor-Ort-Zahlung wirklich verbuchen?'
      if (!window.confirm(question)) return
    }
    setActionId(participant.id)
    setFeedback('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'manual-update', participantId: participant.id, vaccinationDateId: dateId, markPaid, checkIn })
      })
      const result = await response.json()
      if (!response.ok) {
        setFeedback(result.error || 'Aktion konnte nicht gespeichert werden.')
        return
      }
      setSearchResults(current => current.map(item =>
        item.id === participant.id ? { ...item, ...result.participant } : item
      ))
      setParticipantOverrides(current => ({
        ...current,
        [participant.id]: { ...(current[participant.id] || {}), ...result.participant }
      }))
      setFeedback(
        markPaid && checkIn
          ? 'Zahlung und Check-in wurden gespeichert.'
          : markPaid
            ? 'Teilnehmer wurde als bezahlt markiert.'
            : 'Manueller Check-in wurde gespeichert.'
      )
      await onChanged()
    } catch {
      setFeedback('Aktion konnte nicht gespeichert werden.')
    } finally {
      setActionId('')
    }
  }

  return <section className="card checkin-panel">
    <div className="checkin-head"><div><span>QR-CHECK-IN</span><h2>Teilnehmer-Check-in am Impftermin</h2></div></div>
    <select value={dateId} onChange={event => { setDateId(event.target.value); setQuery(''); setQuickFilter(''); setSearchResults([]); setCandidate(null); setQrImage(''); setFeedback(''); scannerBusyRef.current = false }}><option value="">Impftermin auswählen</option>{vaccinationDates.map(date => <option key={date.id} value={date.id}>{date.title} · {date.date}</option>)}</select>
    {dateId && <>
      <div className="checkin-live-stats" aria-label="Live-Statistik des ausgewählten Impftermins">
        {liveStats.map(stat => <button type="button" key={stat.label} className={`checkin-live-stat ${stat.tone}${quickFilter === stat.filter ? ' active' : ''}`} aria-pressed={quickFilter === stat.filter} onClick={() => { setQuickFilter(stat.filter); setQuery(''); setSearchResults([]); setCandidate(null); setQrImage('') }}>
          <span><b aria-hidden="true">{stat.icon}</b>{stat.label}</span>
          <strong>{Number(stat.value).toLocaleString('de-DE')}</strong>
        </button>)}
      </div>
      {quickFilter && quickFilter !== 'all' && <div className="checkin-filter-bar">
        <span>{liveStats.find(stat => stat.filter === quickFilter)?.label}: {displayedResults.length} Teilnehmer</span>
        <button type="button" className="ghost small" onClick={() => setQuickFilter('all')}>Alle Teilnehmer anzeigen</button>
      </div>}
      <div className="checkin-actions">
        <button className="primary" type="button" onClick={startScanner}>QR-Code scannen</button>
        <input value={query} onChange={event => { setQuery(event.target.value); setQuickFilter('') }} placeholder="Name, E-Mail, Telefon oder TSK suchen..." />
      </div>
      <div className="checkin-search-state" aria-live="polite">
        {query.trim().length === 1 && 'Bitte mindestens zwei Zeichen eingeben.'}
        {searching && 'Teilnehmer werden gesucht …'}
        {!searching && query.trim().length >= 2 && searchResults.length === 0 && <>
          <strong>Kein passender Teilnehmer gefunden.</strong>
          <span>Bitte Schreibweise prüfen oder nach E-Mail-Adresse beziehungsweise Telefonnummer suchen.</span>
        </>}
      </div>
      <div className="checkin-candidates">
        {displayedResults.map(item => <article key={item.id} className={`checkin-person checkin-result${item.other_appointment ? ' other-date' : ''}`}>
          <div className="checkin-result-main">
            <strong>{item.firstname} {item.lastname}</strong>
            {item.other_appointment && <span className="checkin-other-date">Anderer Impftermin: {formatDate(item.vaccination_date)}</span>}
            <div className="checkin-result-details">
              <span>Impftermin: {formatDate(item.vaccination_date)}</span>
              <span>Tiere: {item.animal_count}</span>
              <span>Ort: {item.city || '–'}</span>
              {item.phone_suffix && <span>Telefon: •••• {item.phone_suffix}</span>}
              {!item.phone_suffix && item.email_masked && <span>E-Mail: {item.email_masked}</span>}
            </div>
          </div>
          <div className="checkin-result-actions">
            <div className="checkin-result-statuses">
              <span className={item.payment_status === 'bezahlt' ? 'checkin-status done' : 'checkin-status'}>
                {item.payment_status === 'bezahlt' ? '💶 Zahlung: Bezahlt' : '⚠️ Zahlung: Offen'}
              </span>
              <span className={item.checked_in ? 'checkin-status done' : 'checkin-status'}>
                {item.checked_in ? `✅ Bereits eingecheckt${item.checked_in_at ? ` um ${formatCheckinTime(item.checked_in_at)} Uhr` : ''}` : '⏳ Noch nicht eingecheckt'}
              </span>
            </div>
            <div className="checkin-result-buttons">
              {!item.checked_in && item.payment_status === 'bezahlt' && <button type="button" className="small" disabled={actionId === item.id} onClick={() => runManualAction(item, { checkIn: true })}>✅ Manuell einchecken</button>}
              {canManagePayments && !item.checked_in && item.payment_status !== 'bezahlt' && <button type="button" className="primary checkin-combined" disabled={actionId === item.id} onClick={() => runManualAction(item, { markPaid: true, checkIn: true })}>💶✅ Vor Ort bezahlt &amp; eingecheckt</button>}
              {canManagePayments && item.checked_in && item.payment_status !== 'bezahlt' && <button type="button" className="small checkin-pay" disabled={actionId === item.id} onClick={() => runManualAction(item, { markPaid: true })}>💶✅ Zahlung nachträglich verbuchen</button>}
            </div>
          </div>
        </article>)}
      </div>
    </>}
    {scannerActive && <div className="checkin-scanner-wrap"><div id="checkin-scanner" /><button className="ghost" type="button" onClick={async () => { await scannerRef.current?.stop?.().catch(() => {}); scannerRef.current = null; scannerBusyRef.current = false; setScannerActive(false) }}>Scanner schließen</button></div>}
    {candidate && candidate.payment_status !== 'bezahlt' && !candidate.checked_in && (
      <div className="checkin-payment-warning" role="dialog" aria-modal="true" aria-labelledby="checkin-payment-warning-title">
        <div>
          <span className="checkin-payment-warning-label">Zahlung offen</span>
          <h3 id="checkin-payment-warning-title">Achtung: Die Teilnahmegebühr dieses Teilnehmers ist noch offen.</h3>
          <p>Bitte bestätigen Sie, ob die Zahlung jetzt vor Ort erfolgt ist.</p>
        </div>
        <dl>
          <div><dt>Teilnehmer</dt><dd>{candidate.firstname} {candidate.lastname}</dd></div>
          <div><dt>Zahlungsart</dt><dd>{checkinPaymentMethodLabel(candidate.payment_method)}</dd></div>
          <div><dt>Offener Betrag</dt><dd>{formatPaymentAmount(candidate.payment_amount)}</dd></div>
          <div><dt>Impftermin</dt><dd>{candidate.vaccination_title} · {formatDate(candidate.vaccination_date)}</dd></div>
        </dl>
        <div className="checkin-payment-warning-actions">
          <button type="button" className="ghost" disabled={actionId === candidate.id} onClick={cancelQrDecision}>Abbrechen</button>
          <button type="button" className="small" disabled={actionId === candidate.id} onClick={() => saveQrCheckin(candidate, true, 'Der Teilnehmer wurde eingecheckt. Die Teilnahmegebühr bleibt offen.')}>Nur einchecken</button>
          <button type="button" className="primary" disabled={actionId === candidate.id || !canManagePayments} title={!canManagePayments ? 'Keine Berechtigung zum Erfassen einer Zahlung.' : undefined} onClick={() => saveCashPaymentAndCheckin(candidate)}>Vor Ort bezahlt &amp; einchecken</button>
        </div>
      </div>
    )}
    {candidate && (candidate.payment_status === 'bezahlt' || candidate.checked_in) && <div className="checkin-confirm"><div>{qrImage && <img src={qrImage} alt={`QR-Code für ${candidate.firstname} ${candidate.lastname}`} />}<div><strong>{candidate.firstname} {candidate.lastname}</strong><p>{candidate.checked_in ? `Bereits eingecheckt${candidate.checked_in_at ? ` um ${formatCheckinTime(candidate.checked_in_at)} Uhr` : ''}.${candidate.payment_status !== 'bezahlt' ? ' Die Teilnahmegebühr ist weiterhin offen.' : ''}` : 'Noch nicht eingecheckt.'}</p></div></div><div>{candidate.checked_in && <button className="ghost" type="button" disabled={actionId === candidate.id} onClick={() => saveQrCheckin(candidate, false, '', false)}>Zurücksetzen</button>}<button className="ghost" type="button" disabled={actionId === candidate.id} onClick={cancelQrDecision}>Schließen</button></div></div>}
    {feedback && <p className="checkin-feedback" role="status">{feedback}</p>}
  </section>
}

function isMissingAdminMembershipSchema(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || /club_admin_memberships/i.test(error?.message || '')
}

function formatAdministratorLastActivity(value) {
  if (!value) return 'zuletzt online unbekannt'
  const lastActivity = new Date(value)
  if (Number.isNaN(lastActivity.getTime())) return 'zuletzt online unbekannt'

  const now = new Date()
  const elapsedMilliseconds = Math.max(0, now.getTime() - lastActivity.getTime())
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60000)
  if (elapsedMinutes < 1) return 'zuletzt online gerade eben'
  if (elapsedMinutes < 60) return `zuletzt online vor ${elapsedMinutes} Minuten`

  const localPartsFormatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
  const localDay = date => {
    const parts = Object.fromEntries(
      localPartsFormatter
        .formatToParts(date)
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)])
    )
    return Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000
  }
  const dayDifference = localDay(now) - localDay(lastActivity)
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(lastActivity)

  if (dayDifference === 0) return `zuletzt online heute um ${time} Uhr`
  if (dayDifference === 1) return `zuletzt online gestern um ${time} Uhr`

  const date = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(lastActivity)
  return `zuletzt online ${date} um ${time} Uhr`
}

function AdminPresence() {
  const [administrators, setAdministrators] = useState([])
  const [presenceError, setPresenceError] = useState('')
  const lastTouchRef = useRef(0)

  useEffect(() => {
    let active = true

    async function loadPresence() {
      const { data, error } = await supabase.rpc('get_admin_presence')
      if (!active) return
      if (error) {
        console.error('Admin-Präsenz konnte nicht geladen werden:', error)
        setPresenceError('Online-Status nicht verfügbar.')
        return
      }
      setPresenceError('')
      setAdministrators(Array.isArray(data) ? data : [])
    }

    async function touchPresence(force = false) {
      const now = Date.now()
      if (!force && now - lastTouchRef.current < 15000) return
      lastTouchRef.current = now
      const { error } = await supabase.rpc('touch_admin_presence', { p_online: true })
      if (error) {
        console.error('Admin-Aktivität konnte nicht aktualisiert werden:', error)
        if (active) setPresenceError('Online-Status nicht verfügbar.')
        return
      }
      await loadPresence()
    }

    const registerActivity = () => {
      void touchPresence(false)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void touchPresence(true)
    }

    void touchPresence(true)
    const polling = window.setInterval(() => void touchPresence(true), 45000)
    window.addEventListener('pointerdown', registerActivity, { passive: true })
    window.addEventListener('keydown', registerActivity)
    window.addEventListener('focus', registerActivity)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      window.clearInterval(polling)
      window.removeEventListener('pointerdown', registerActivity)
      window.removeEventListener('keydown', registerActivity)
      window.removeEventListener('focus', registerActivity)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <aside className="admin-presence" aria-label="Administratorstatus">
      <div className="admin-presence-heading">
        <span className="admin-presence-live" aria-hidden="true" />
        <strong>Administratoren</strong>
      </div>
      {presenceError ? (
        <p className="admin-presence-error" role="status">{presenceError}</p>
      ) : (
        <ul aria-live="polite">
          {administrators.map(administrator => (
            <li key={administrator.admin_email}>
              <span
                className={`admin-presence-dot ${administrator.online ? 'admin-presence-dot-online' : ''}`}
                aria-hidden="true"
              />
              <span className="admin-presence-person">
                <strong>{administrator.admin_name || 'Administrator'}</strong>
                <small>{administrator.admin_email}</small>
              </span>
              <span className={administrator.online ? 'admin-presence-status-online' : 'admin-presence-status-offline'}>
                {administrator.online ? 'online' : formatAdministratorLastActivity(administrator.last_activity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function Admin() {
  const [logged, setLogged] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminContext, setAdminContext] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || !active) return
      const { data: memberships, error } = await supabase.from('club_admin_memberships').select('club_id, role, active').eq('active', true)
      if (error && active) {
        setLoginError(isMissingAdminMembershipSchema(error) ? 'Die Sicherheitsmigration für den Adminbereich wurde noch nicht ausgeführt.' : 'Der Adminzugang ist noch nicht vollständig konfiguriert.')
        return
      }
      if (active && memberships?.[0]) { setAdminContext(memberships[0]); setLogged(true) }
    }).finally(() => active && setAuthLoading(false))
    return () => { active = false }
  }, [])
  async function login() {
    setLoginError('')
    if (!hasSupabase) return setLoginError(supabaseConfigMessage)
    const normalizedEmail = email.trim()

const { data, error } = await supabase.auth.signInWithPassword({
  email: normalizedEmail,
  password
})

if (error) {
  if (error.message?.includes('Invalid login credentials')) {
    return setLoginError('E-Mail oder Passwort ist nicht korrekt.')
  }

  if (error.message?.includes('Email not confirmed')) {
    return setLoginError('Die E-Mail-Adresse ist noch nicht bestätigt.')
  }

  return setLoginError(`Anmeldung fehlgeschlagen: ${error.message}`)
}

if (!data.session) {
  return setLoginError(
    'Die Anmeldung wurde akzeptiert, aber es konnte keine Sitzung erstellt werden.'
  )
}
    const { data: memberships, error: membershipError } = await supabase.from('club_admin_memberships').select('club_id, role, active').eq('active', true)
    if (membershipError) {
      await supabase.auth.signOut()
      return setLoginError(isMissingAdminMembershipSchema(membershipError) ? 'Die Sicherheitsmigration für den Adminbereich wurde noch nicht ausgeführt.' : 'Der Adminzugang ist noch nicht vollständig konfiguriert.')
    }
    if (!memberships?.[0]) { await supabase.auth.signOut(); return setLoginError('Für dieses Konto ist keine aktive Vereinsrolle hinterlegt.') }
    setAdminContext(memberships[0]); setLogged(true)
  }
  async function logout() {
    setLogoutError('')
    const { error: presenceError } = await supabase.rpc('touch_admin_presence', { p_online: false })
    if (presenceError) console.error('Admin-Präsenz konnte beim Abmelden nicht beendet werden:', presenceError)
    const { error } = await supabase.auth.signOut()
    if (error) {
      await supabase.rpc('touch_admin_presence', { p_online: true })
      setLogoutError('Abmeldung fehlgeschlagen. Bitte erneut versuchen.')
      return
    }
    setEmail('')
    setPassword('')
    setLoginError('')
    setAdminContext(null)
    setLogged(false)
  }
  if (authLoading) return null
  if (!logged) return (
    <div className="page admin-login-page">
      <Header />
      <main className="admin-login-shell">
        <section className="admin-login-hero">
          <div className="admin-login-eyebrow">Geschützter Bereich</div>
          <h1>Admin-Login</h1>
          <p>Verwalten Sie Teilnehmer, Impftermine und Zahlungen zentral an einem Ort.</p>
        </section>

        <section className="card admin-login-card">
          <div className="admin-login-icon"><Lock size={28}/></div>
          <div className="admin-login-heading">
            <span>RGZV Hagen</span>
            <h2>Willkommen zurück</h2>
            <p>Bitte melden Sie sich mit Ihrem Admin-Konto an.</p>
          </div>
          <label className="admin-login-field"><span>E-Mail</span><input placeholder="admin@verein.de" value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" /></label>
          <label className="admin-login-field"><span>Passwort</span><input placeholder="Passwort" value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
          {loginError && <p role="alert" className="admin-login-error">{loginError}</p>}
          <button className="primary admin-login-submit" onClick={login}>Einloggen</button>
          <a className="admin-login-back" href="#">← Zur Anmeldung</a>
        </section>
      </main>
      <Footer />
    </div>
  )
  return <AdminDashboard adminContext={adminContext} onLogout={logout} logoutError={logoutError} />
}

function AdminDashboard({ onLogout, logoutError, adminContext }) {
  const [participants, setParticipants] = useState([])
  const [isVaccinationDay, setIsVaccinationDay] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [mailDialogOpen, setMailDialogOpen] = useState(false)
  const [mailType, setMailType] = useState('')
  const [newTime, setNewTime] = useState('')
const [newMeetingPoint, setNewMeetingPoint] = useState('')
const [selectedDate, setSelectedDate] = useState(null)
  const [editingParticipant, setEditingParticipant] = useState(null)
  const [vaccinationDates, setVaccinationDates] = useState([])
  const [newDate, setNewDate] = useState('')
  const [newDateTitle, setNewDateTitle] = useState('')
const [newDateNote, setNewDateNote] = useState('')
  const [newDateAddress, setNewDateAddress] = useState(emptyVaccinationAddress())
  const [editingVaccinationDate, setEditingVaccinationDate] = useState(null)
  const [vetSendDate, setVetSendDate] = useState(null)
  const [vetSending, setVetSending] = useState(false)
  const [smartAssistant, setSmartAssistant] = useState(null)
  const [smartAssistantLoading, setSmartAssistantLoading] = useState(true)
  const [smartAssistantError, setSmartAssistantError] = useState('')
  const [smartAssistantOpen, setSmartAssistantOpen] = useState(false)
  const [adminManagementOpen, setAdminManagementOpen] = useState(false)
  const [administratorMemberships, setAdministratorMemberships] = useState([])
  const [administratorMembershipsLoading, setAdministratorMembershipsLoading] = useState(false)
  const [administratorMembershipsError, setAdministratorMembershipsError] = useState('')
  const [selectedAdministrator, setSelectedAdministrator] = useState(null)
  const [administratorDetailLoading, setAdministratorDetailLoading] = useState(false)
  const [administratorDetailError, setAdministratorDetailError] = useState('')
  const [adminCreateOpen, setAdminCreateOpen] = useState(false)
  const [adminCreateForm, setAdminCreateForm] = useState({ firstName: '', lastName: '', email: '', clubId: '', role: '' })
  const [adminCreateBusy, setAdminCreateBusy] = useState(false)
  const [adminCreateError, setAdminCreateError] = useState('')
  const [adminCreateSuccess, setAdminCreateSuccess] = useState('')
  const [adminStatusTarget, setAdminStatusTarget] = useState(null)
  const [adminStatusBusy, setAdminStatusBusy] = useState(false)
  const [adminStatusError, setAdminStatusError] = useState('')
  const [adminStatusSuccess, setAdminStatusSuccess] = useState('')
  const [adminRoleTarget, setAdminRoleTarget] = useState(null)
  const [adminRoleBusy, setAdminRoleBusy] = useState(false)
  const [adminRoleError, setAdminRoleError] = useState('')
  const [adminRoleSuccess, setAdminRoleSuccess] = useState('')
  const [adminDeleteTarget, setAdminDeleteTarget] = useState(null)
  const [adminDeleteBusy, setAdminDeleteBusy] = useState(false)
  const [adminDeleteError, setAdminDeleteError] = useState('')
  const [adminDeleteSuccess, setAdminDeleteSuccess] = useState('')
  const [dateFeedback, setDateFeedback] = useState('')
  const [clubs, setClubs] = useState([])
const [selectedClub, setSelectedClub] = useState(null)
  const adminClubId = adminContext?.club_id
  const activeClub = selectedClub || clubs.find(club => club.id === adminClubId) || null
  const dashboardClubId = activeClub?.id || adminClubId
  async function openAdminManagement() {
    if (adminContext?.role !== 'superadmin') return
    setAdminManagementOpen(true)
    setAdministratorMembershipsLoading(true)
    setAdministratorMembershipsError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ action: 'list-admin-memberships' })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAdministratorMembershipsError(
          response.status === 403
            ? 'Keine Berechtigung für die Adminverwaltung.'
            : 'Die Administratoren konnten nicht geladen werden.'
        )
        return
      }
      setAdministratorMemberships(result.administrators || [])
    } catch {
      setAdministratorMembershipsError('Die Administratoren konnten nicht geladen werden.')
    } finally {
      setAdministratorMembershipsLoading(false)
    }
  }
  function administratorRoleLabel(role) {
    if (role === 'superadmin') return 'Superadmin'
    if (role === 'clubadmin') return 'Vereinsadmin'
    if (role === 'checkin_admin') return 'Check-in-Admin'
    return role
  }
  function openAdminCreate() {
    if (adminContext?.role !== 'superadmin') return
    setAdminCreateForm({
      firstName: '',
      lastName: '',
      email: '',
      clubId: activeClub?.id || adminClubId || '',
      role: ''
    })
    setAdminCreateError('')
    setAdminCreateSuccess('')
    setAdminCreateOpen(true)
  }
  async function createAdministrator() {
    if (adminContext?.role !== 'superadmin') return
    const { firstName, lastName, email, clubId, role } = adminCreateForm
    if (![firstName, lastName, email, clubId, role].every(value => String(value || '').trim())) {
      setAdminCreateError('Bitte füllen Sie alle Pflichtfelder aus.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setAdminCreateError('Bitte geben Sie eine gültige E-Mail-Adresse ein.')
      return
    }
    setAdminCreateBusy(true)
    setAdminCreateError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'invite-administrator',
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          clubId,
          role
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const allowedMessages = [
          'Bitte füllen Sie alle Pflichtfelder aus.',
          'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
          'Diese E-Mail-Adresse ist bereits als Administrator vorhanden.',
          'Die Einladung konnte nicht gesendet werden. Bitte erneut versuchen.',
          'Der Administrator konnte nicht angelegt werden.',
          'Keine Berechtigung für die Adminverwaltung.'
        ]
        setAdminCreateError(
          allowedMessages.includes(result.error)
            ? result.error
            : 'Der Administrator konnte nicht angelegt werden.'
        )
        return
      }
      setAdminCreateOpen(false)
      setAdminCreateForm({ firstName: '', lastName: '', email: '', clubId: '', role: '' })
      setAdminCreateSuccess('Der Administrator wurde angelegt und per E-Mail eingeladen.')
      await openAdminManagement()
    } catch {
      setAdminCreateError('Der Administrator konnte nicht angelegt werden.')
    } finally {
      setAdminCreateBusy(false)
    }
  }
  function confirmAdministratorStatus(membership) {
    if (adminContext?.role !== 'superadmin' || membership.role === 'superadmin') return
    setAdminStatusError('')
    setAdminStatusTarget({ ...membership, nextActive: !membership.active })
  }
  async function updateAdministratorStatus() {
    if (adminContext?.role !== 'superadmin' || !adminStatusTarget || adminStatusTarget.role === 'superadmin') return
    setAdminStatusBusy(true)
    setAdminStatusError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'set-admin-membership-active',
          email: adminStatusTarget.email,
          club: adminStatusTarget.club,
          role: adminStatusTarget.role,
          active: adminStatusTarget.nextActive
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const allowedMessages = [
          'Keine Berechtigung für die Adminverwaltung.',
          'Der Administrator wurde nicht gefunden.',
          'Ein Superadmin kann über diese Funktion nicht gesperrt werden.',
          'Der Status des Administrators konnte nicht geändert werden.'
        ]
        setAdminStatusError(
          allowedMessages.includes(result.error)
            ? result.error
            : 'Der Status des Administrators konnte nicht geändert werden.'
        )
        return
      }
      const changedAdministrator = adminStatusTarget
      setAdminStatusTarget(null)
      setAdminStatusSuccess(
        changedAdministrator.nextActive
          ? 'Der Administrator wurde freigeschaltet.'
          : 'Der Administrator wurde gesperrt.'
      )
      setSelectedAdministrator(current =>
        current &&
        current.email === changedAdministrator.email &&
        current.club === changedAdministrator.club &&
        current.role === changedAdministrator.role
          ? { ...current, active: changedAdministrator.nextActive }
          : current
      )
      await openAdminManagement()
    } catch {
      setAdminStatusError('Der Status des Administrators konnte nicht geändert werden.')
    } finally {
      setAdminStatusBusy(false)
    }
  }
  function openAdministratorRole(membership) {
    if (adminContext?.role !== 'superadmin' || membership.role === 'superadmin') return
    setAdminRoleError('')
    setAdminRoleTarget({ membership, newRole: membership.role })
  }
  async function updateAdministratorRole() {
    if (
      adminContext?.role !== 'superadmin' ||
      !adminRoleTarget ||
      adminRoleTarget.membership.role === 'superadmin' ||
      !['clubadmin', 'checkin_admin'].includes(adminRoleTarget.newRole)
    ) return
    setAdminRoleBusy(true)
    setAdminRoleError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'set-admin-membership-role',
          email: adminRoleTarget.membership.email,
          club: adminRoleTarget.membership.club,
          currentRole: adminRoleTarget.membership.role,
          newRole: adminRoleTarget.newRole
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const allowedMessages = [
          'Keine Berechtigung für die Adminverwaltung.',
          'Der Administrator wurde nicht gefunden.',
          'Die ausgewählte Rolle ist nicht zulässig.',
          'Die Superadmin-Rolle kann über diese Funktion nicht geändert werden.',
          'Die Rolle des Administrators konnte nicht geändert werden.'
        ]
        setAdminRoleError(
          allowedMessages.includes(result.error)
            ? result.error
            : 'Die Rolle des Administrators konnte nicht geändert werden.'
        )
        return
      }
      const changedAdministrator = adminRoleTarget.membership
      const newRole = adminRoleTarget.newRole
      setAdminRoleTarget(null)
      setAdminRoleSuccess('Die Rolle des Administrators wurde geändert.')
      setSelectedAdministrator(current =>
        current &&
        current.email === changedAdministrator.email &&
        current.club === changedAdministrator.club &&
        current.role === changedAdministrator.role
          ? { ...current, role: newRole }
          : current
      )
      await openAdminManagement()
    } catch {
      setAdminRoleError('Die Rolle des Administrators konnte nicht geändert werden.')
    } finally {
      setAdminRoleBusy(false)
    }
  }
  function confirmAdministratorDelete(membership) {
    if (adminContext?.role !== 'superadmin' || membership.role === 'superadmin') return
    setAdminDeleteError('')
    setAdminDeleteTarget(membership)
  }
  async function deleteAdministrator() {
    if (adminContext?.role !== 'superadmin' || !adminDeleteTarget || adminDeleteTarget.role === 'superadmin') return
    setAdminDeleteBusy(true)
    setAdminDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'delete-administrator',
          email: adminDeleteTarget.email,
          club: adminDeleteTarget.club,
          role: adminDeleteTarget.role
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const allowedMessages = [
          'Keine Berechtigung für die Adminverwaltung.',
          'Der Administrator wurde nicht gefunden.',
          'Ein Superadmin kann über diese Funktion nicht gelöscht werden.',
          'Der Administrator konnte nicht gelöscht werden.'
        ]
        setAdminDeleteError(
          allowedMessages.includes(result.error)
            ? result.error
            : 'Der Administrator konnte nicht gelöscht werden.'
        )
        return
      }
      const deletedAdministrator = adminDeleteTarget
      setAdminDeleteTarget(null)
      setAdminDeleteSuccess('Der Administrator wurde gelöscht.')
      setSelectedAdministrator(current =>
        current &&
        current.email === deletedAdministrator.email &&
        current.club === deletedAdministrator.club &&
        current.role === deletedAdministrator.role
          ? null
          : current
      )
      await openAdminManagement()
    } catch {
      setAdminDeleteError('Der Administrator konnte nicht gelöscht werden.')
    } finally {
      setAdminDeleteBusy(false)
    }
  }
  async function openAdministratorDetail(membership) {
    if (adminContext?.role !== 'superadmin') return
    setSelectedAdministrator(null)
    setAdministratorDetailLoading(true)
    setAdministratorDetailError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'get-admin-membership-detail',
          email: membership.email,
          club: membership.club,
          role: membership.role
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAdministratorDetailError(
          response.status === 403
            ? 'Keine Berechtigung für die Adminverwaltung.'
            : response.status === 404
              ? 'Der Administrator wurde nicht gefunden.'
              : 'Die Administratordaten konnten nicht geladen werden.'
        )
        return
      }
      setSelectedAdministrator(result.administrator || null)
      if (!result.administrator) setAdministratorDetailError('Der Administrator wurde nicht gefunden.')
    } catch {
      setAdministratorDetailError('Die Administratordaten konnten nicht geladen werden.')
    } finally {
      setAdministratorDetailLoading(false)
    }
  }
  async function sendReminderMail() {
  if (!selectedDate) return

  try {
    const response = await fetch('/api/send-reminder-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vaccinationDateId: selectedDate.id,
        type: mailType,
        newTime,
        newMeetingPoint,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      alert(result.error || 'Fehler beim Versenden der E-Mail.')
      return
    }
if (result.sent === 0) {
  alert('Für diesen Impftermin wurden keine bezahlten Teilnehmer gefunden.')
  return
}
    alert(`${result.sent} Erinnerungs-E-Mail(s) erfolgreich versendet.`)
    setMailDialogOpen(false)
    setMailType('')
    setNewTime('')
    setNewMeetingPoint('')
  } catch (err) {
    console.error(err)
    alert('Serverfehler beim Versenden der E-Mails.')
  }
}
  const isTestVaccinationDate = vaccinationDate =>
    Object.values(vaccinationDate || {}).some(
      value => typeof value === 'string' && value.toLowerCase().includes('test')
    )

  async function adminDashboardRequest(action, payload = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/send-reminder-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`
      },
      body: JSON.stringify({ action, ...payload })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Die Adminauswertung konnte nicht verarbeitet werden.')
    return result
  }

  async function loadSmartAssistant(silent = false) {
    if (!dashboardClubId) return
    if (!silent) {
      setSmartAssistantLoading(true)
      setSmartAssistantError('')
    }
    try {
      const result = await adminDashboardRequest('smart-assistant', { clubId: dashboardClubId })
      setSmartAssistant(result)
    } catch (error) {
      console.error('Vereins-Ampel konnte nicht geladen werden:', error)
      setSmartAssistantError('Die Vereins-Ampel konnte derzeit nicht geladen werden.')
    } finally {
      if (!silent) setSmartAssistantLoading(false)
    }
  }

  function openSmartAssistantTask(task) {
    setSmartAssistantOpen(false)
    if (task.action === 'participants') {
      if (task.id === 'open-payments') setStatusFilter('open')
      document.getElementById('participant-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (task.action === 'vet') {
      const nextDate = vaccinationDates.find(date => !isTestVaccinationDate(date) && date.date >= new Date().toISOString().slice(0, 10))
      if (nextDate && canSendVetCertificate(nextDate)) setVetSendDate(nextDate)
      document.getElementById('appointment-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const targetId = task.action === 'appointments'
      ? 'appointment-management'
      : task.action === 'club'
        ? 'admin-dashboard-top'
        : 'admin-dashboard-top'
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function load() {
    setLoading(true)
    const { data: clubData } = await supabase
  .from('clubs')
  .select('*')
  .order('name')

setClubs(clubData || [])
    if (hasSupabase) {
const clubId = adminClubId

const { data, error } = await supabase
  .from('participants')
  .select('*')
  .eq('club_id', clubId)
  .order('created_at', { ascending: false })
      if (!error) setParticipants(data || [])
      const { data: dates } = await supabase
  .from('vaccination_dates')
  .select('*')
  .eq('club_id', clubId)
  .order('date', { ascending: true })

setVaccinationDates(dates || [])
      await loadSmartAssistant()
      const nextDate = dates?.[0]?.date

const today = new Date().toISOString().split('T')[0]

setIsVaccinationDay(
  nextDate === today
)
    } else setParticipants(JSON.parse(localStorage.getItem('participants') || '[]'))
    setLoading(false)
  }
  async function addVaccinationDate() {
  if (!newDate || !newDateTitle) return

  setDateFeedback('')
  const { data, error } = await supabase
    .from('vaccination_dates')
    .insert([
  {
    club_id: adminClubId,
    title: newDateTitle,
    date: newDate,
    note: newDateNote,
    ...newDateAddress
  }
])
    .select('*')
    .single()

  if (error) {
    setDateFeedback('Impftermin konnte nicht gespeichert werden.')
    return
  }
  setNewDate('')
    setNewDateTitle('')
setNewDateNote('')
  setNewDateAddress(emptyVaccinationAddress())
  setDateFeedback('Impftermin wurde gespeichert.')
  await load()
}
  async function updateVaccinationDate() {
    if (!editingVaccinationDate?.date || !editingVaccinationDate?.title) return
    setDateFeedback('')
    const clubId = adminClubId
    const { id, club_id, created_at, ...updates } = editingVaccinationDate
    const { error } = await supabase
      .from('vaccination_dates')
      .update(updates)
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) {
      setDateFeedback('Impftermin konnte nicht aktualisiert werden.')
      return
    }
    setEditingVaccinationDate(null)
    setDateFeedback('Impftermin wurde aktualisiert.')
    load()
  }
  useEffect(()=>{ load() }, [])
  useEffect(() => {
    if (!dashboardClubId) return undefined
    const intervalId = window.setInterval(() => {
      loadSmartAssistant(true)
    }, 30000)
    return () => window.clearInterval(intervalId)
  }, [dashboardClubId])
  async function markPaid(id, paid) {
  if (hasSupabase) {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/admin-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ participantId: id, paid })
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { alert(result.error || 'Zahlungsstatus konnte nicht gespeichert werden.'); return }
    if (result.warning) alert(result.warning)
    else if (paid && result.barPaymentRecorded) alert('Die Barzahlung wurde erfolgreich verbucht.')
    else if (paid && result.emailSent) alert('Zahlung wurde verbucht und die Bestätigungsmail wurde versendet.')
    else if (paid && result.alreadyProcessed) alert('Die Zahlung ist bereits als bezahlt verbucht.')
    else alert('Der Zahlungsstatus wurde erfolgreich gespeichert.')
  } else {
    const list = participants.map(p =>
      p.id === id ? { ...p, payment_status: paid ? 'bezahlt' : 'offen' } : p
    )
    localStorage.setItem('participants', JSON.stringify(list))
    setParticipants(list)
    return
  }

  load()
}
  async function saveParticipant(p) {
   const clubId = adminClubId
  const { error } = await supabase
    .from('participants')
    .update({
      firstname: p.firstname,
      lastname: p.lastname,
      street: p.street,
      housenumber: p.housenumber,
      zipcode: p.zipcode,
      city: p.city,
      email: p.email,
      phone: p.phone,
      tsk_number: p.tsk_number,
      animal_type: p.animal_type,
      animal_count: p.animal_count,
      vaccine: p.vaccine
    })
    .eq('id', p.id)
.eq('club_id', clubId)
  if (!error) {
    setEditingParticipant(null)
    load()
  }
}
  async function deleteParticipant(id) {
  if (!confirm('Teilnehmer wirklich löschen?')) return
const clubId = adminClubId
  await supabase
    .from('participants')
    .delete()
    .eq('id', id)
.eq('club_id', clubId)
  load()
  }
  const bindingParticipants = participants.filter(isBindingRegistration)
  const dashboardToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date())
  const activeDashboardAppointment = vaccinationDates.find(appointment => appointment.date >= dashboardToday) || null
  const activeDashboardParticipants = activeDashboardAppointment
    ? bindingParticipants.filter(participant => String(participant.vaccination_date_id) === String(activeDashboardAppointment.id))
    : []
  const filtered = participants.filter(p => {
  const matchesSearch = `${p.firstname} ${p.lastname} ${p.city} ${p.email}`.toLowerCase().includes(q.toLowerCase())
  const matchesStatus =
    (statusFilter === 'all' && isBindingRegistration(p)) ||
    (statusFilter === 'paid' && isBindingRegistration(p) && p.payment_status === 'bezahlt') ||
    (statusFilter === 'open' && isBindingRegistration(p) && p.payment_status !== 'bezahlt') ||
    p.registration_status === statusFilter

  return matchesSearch && matchesStatus
    })
  const stats = useMemo(() => ({
    total: activeDashboardParticipants.length,
    animals: activeDashboardParticipants.reduce((sum, participant) => sum + Number(participant.animal_count || 0), 0),
    revenue: activeDashboardParticipants
      .filter(participant => participant.payment_status === 'bezahlt')
      .reduce((sum, participant) => sum + Number(participant.payment_amount || 0), 0)
  }), [participants, vaccinationDates])
  const dateStats = vaccinationDates.map(v => ({
  ...v,
  count: bindingParticipants.filter(p => p.vaccination_date_id === v.id).length
}))
  async function pdfForVaccinationDate(v) {
  const list = bindingParticipants.filter(
    p => String(p.vaccination_date_id) === String(v.id)
  )

  const doc = new jsPDF({ orientation: 'landscape' })
    

  doc.setFontSize(20)
doc.text('RGZV Hagen und Umgebung seit 1903 e.V.', 14, 15)

doc.setFontSize(10)
doc.text('Im Wiedenbusch 41 · 58099 Hagen', 14, 22)

doc.text('1. Vorsitzender: Frank Sternal', 14, 28)

doc.text('1. Kassierer: Thorsten von Oesen', 14, 34)

doc.text(`Impftermin: ${v.title} - ${v.date}`, 14, 40)

  autoTable(doc, {
    startY: 48,
    head: [['Name', 'Adresse', 'E-Mail', 'TSK Betriebsnummer.', 'Tiere', 'Impfung', 'Zahlung']],
    body: list.map(p => [
      `${p.firstname} ${p.lastname}`,
      `${p.street || ''} ${p.housenumber || ''}, ${p.zipcode || ''} ${p.city || ''}`,
      p.email || '',
      p.tsk_number || '',
      formatParticipantAnimals(p),
      p.vaccine || '',
      p.payment_status || 'offen'
    ])
  })

  await addPdfWatermark(doc)
  doc.save(`teilnehmerliste-${v.date}.pdf`)
}

  const formatGermanVaccinationDate = value => {
    const [year, month, day] = String(value || '').split('-')
    return year && month && day ? `${day}.${month}.${year}` : ''
  }

  const localDateKey = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const canSendVetCertificate = vaccinationDate =>
    Boolean(vaccinationDate?.date) && vaccinationDate.date <= localDateKey()

  async function sendVetCertificateForDate(vaccinationDate) {
    if (!vaccinationDate || vetSending || !canSendVetCertificate(vaccinationDate)) return

    const list = checkedInParticipantsForVaccinationDate(participants, vaccinationDate)
    if (list.length === 0) {
      alert('Für diesen Impftermin wurden noch keine Teilnehmer eingecheckt.')
      return
    }

    setVetSending(true)
    try {
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('Sammelimpfbescheinigung', 14, 15)
      doc.setFontSize(10)
      doc.text('Hiermit wird bescheinigt, dass die nachstehend aufgeführten', 14, 28)
      doc.text('Geflügelbestände gegen die Newcastle-Krankheit', 14, 35)
      doc.text('(atypische Geflügelpest) gemäß den geltenden', 14, 42)
      doc.text('tierseuchenrechtlichen Vorschriften schutzgeimpft wurden.', 14, 49)
      doc.setFontSize(11)
      doc.text('Impfstoff: Nobilis ND Clone 30', 14, 65)
      doc.text('Charge: ______________________', 14, 75)
      doc.text('Verwendbar bis: ______________', 14, 85)
      doc.text(`Impftermin: ${vaccinationDate.title || ''}`, 14, 100)
      doc.text(`Datum: ${formatGermanVaccinationDate(vaccinationDate.date)}`, 14, 108)

      autoTable(doc, {
        startY: 120,
        head: [['Name', 'Adresse', 'TSK Betriebsnummer', 'Tierart', 'Anzahl']],
        body: list.map(participant => [
          `${participant.firstname || ''} ${participant.lastname || ''}`.trim(),
          `${participant.street || ''} ${participant.housenumber || ''}, ${participant.zipcode || ''} ${participant.city || ''}`.trim(),
          participant.tsk_number || '',
          formatParticipantAnimals(participant),
          participant.animal_count || ''
        ])
      })

      const signatureY = doc.lastAutoTable.finalY + 20
      doc.text('Ort, Datum: ______________________', 14, signatureY)
      doc.text('Tierarzt (Stempel / Unterschrift): ______________________', 14, signatureY + 15)

      await addPdfWatermark(doc)
      const response = await fetch('/api/send-vet-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          pdfData: doc.output('datauristring'),
          datum: vaccinationDate.date,
          vaccinationDateId: vaccinationDate.id,
          participantIds: list.map(participant => participant.id)
        })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Die Sammelimpfbescheinigung konnte nicht versendet werden.')
      }

      setVetSendDate(null)
      alert('Die Sammelimpfbescheinigung wurde erfolgreich versendet.')
      load()
    } catch (error) {
      console.error('Tierarztversand fehlgeschlagen:', error)
      alert(error.message || 'Beim Versand der Sammelimpfbescheinigung ist ein Fehler aufgetreten.')
    } finally {
      setVetSending(false)
    }
  }

  async function cashReportForVaccinationDate(v) {
    const list = bindingParticipants.filter(
      participant => String(participant.vaccination_date_id) === String(v.id)
    )
    const paid = list.filter(participant => participant.payment_status === 'bezahlt')
    const isPaymentMethod = (participant, method) =>
      String(participant.payment_method || '').toLowerCase() === method
    const amount = participant => Number(participant.payment_amount || 0)
    const totalRevenue = paid.reduce((sum, participant) => sum + amount(participant), 0)
    const paypalRevenue = paid
      .filter(participant => isPaymentMethod(participant, 'paypal'))
      .reduce((sum, participant) => sum + amount(participant), 0)
    const stripeRevenue = paid
      .filter(participant => isPaymentMethod(participant, 'stripe'))
      .reduce((sum, participant) => sum + amount(participant), 0)
    const cashRevenue = totalRevenue - paypalRevenue - stripeRevenue
    const formatDate = value => value
      ? new Date(value).toLocaleDateString('de-DE')
      : '-'
    const formatAmount = value => `${Number(value || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} EUR`
    const paymentMethodLabel = participant => {
      if (isPaymentMethod(participant, 'paypal')) return 'PayPal'
      if (isPaymentMethod(participant, 'stripe')) return 'Stripe'
      if (isPaymentMethod(participant, 'bar')) return 'Barzahlung vor Ort'
      if (participant.payment_status === 'bezahlt') return 'Barzahlung'
      return '-'
    }

    const doc = new jsPDF({ orientation: 'landscape' })
    const clubName = activeClub?.name || APP.clubName

    doc.setFontSize(20)
    doc.text(clubName, 14, 15)
    doc.setFontSize(16)
    doc.text('Kassenbericht', 14, 24)
    doc.setFontSize(10)
    doc.text(`Impftermin: ${v.title || '-'}`, 14, 32)
    doc.text(`Datum des Impftermins: ${formatDate(v.date)}`, 14, 38)
    doc.text(`Erstellungsdatum: ${formatDate(new Date())}`, 14, 44)

    doc.setFontSize(11)
    doc.text(`Teilnehmer gesamt: ${list.length}`, 14, 55)
    doc.text(`Bezahlte Teilnehmer: ${paid.length}`, 14, 62)
    doc.text(`Offene Zahlungen: ${list.length - paid.length}`, 14, 69)
    doc.text(`Summe aller Einnahmen: ${formatAmount(totalRevenue)}`, 115, 55)
    doc.text(`Summe Barzahlung: ${formatAmount(cashRevenue)}`, 115, 62)
    doc.text(`Summe PayPal: ${formatAmount(paypalRevenue)}`, 205, 55)
    doc.text(`Summe Stripe: ${formatAmount(stripeRevenue)}`, 205, 62)

    autoTable(doc, {
      startY: 78,
      head: [[
        'Nr.',
        'Nachname',
        'Vorname',
        'Mitglied',
        'Tierart',
        'Anzahl Tiere',
        'Impfstoff',
        'Zahlungsart',
        'Betrag',
        'Zahlungsstatus',
        'Zahlungsdatum'
      ]],
      body: list.map((participant, index) => [
        index + 1,
        participant.lastname || '',
        participant.firstname || '',
        participant.is_member ? 'Ja' : 'Nein',
        formatParticipantAnimals(participant),
        participant.animal_count || 0,
        participant.vaccine || '',
        paymentMethodLabel(participant),
        formatAmount(participant.payment_amount),
        participant.payment_status || 'offen',
        formatDate(participant.payment_date)
      ]),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [22, 58, 47], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10 },
        3: { cellWidth: 15 },
        5: { cellWidth: 18 },
        8: { cellWidth: 22 },
        9: { cellWidth: 24 },
        10: { cellWidth: 23 }
      }
    })

    let finalY = doc.lastAutoTable.finalY + 12
    if (finalY > doc.internal.pageSize.getHeight() - 48) {
      doc.addPage()
      finalY = 20
    }

    doc.setFillColor(255, 248, 241)
    doc.setDrawColor(242, 140, 40)
    doc.roundedRect(14, finalY, 100, 14, 2, 2, 'FD')
    doc.setFontSize(13)
    doc.setFont(undefined, 'bold')
    doc.text(`Gesamteinnahmen: ${formatAmount(totalRevenue)}`, 19, finalY + 9)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.text('____________________________', 14, finalY + 28)
    doc.text('Erstellt von', 14, finalY + 34)
    doc.text('____________________________', 115, finalY + 28)
    doc.text('Datum / Unterschrift', 115, finalY + 34)

    await addPdfWatermark(doc)
    doc.save(`kassenbericht-${v.date}.pdf`)
  }

  const assistantStatus = smartAssistant?.status || 'green'
  const assistantHeadline = smartAssistantLoading
    ? 'Vereinsstatus wird geprüft'
    : smartAssistantError
      ? 'Status derzeit nicht verfügbar'
      : assistantStatus === 'red'
        ? 'Sofortiger Handlungsbedarf'
        : assistantStatus === 'yellow'
          ? `Es gibt ${smartAssistant?.taskCount || 0} offene Aufgabe${smartAssistant?.taskCount === 1 ? '' : 'n'}`
          : 'Alles in Ordnung'
  const assistantIcon = assistantStatus === 'red' ? '🔴' : assistantStatus === 'yellow' ? '🟡' : '🟢'



  return <div className="page admin"><Header admin />

  {adminDeleteTarget && adminContext?.role === 'superadmin' && (
    <div className="modal admin-delete-modal">
      <section className="modal-card" role="dialog" aria-modal="true">
        <p>Soll dieser Administrator wirklich endgültig gelöscht werden? Der Zugang kann danach nicht mehr verwendet werden.</p>
        {adminDeleteError && <p role="alert" className="admin-inline-error">{adminDeleteError}</p>}
        <button type="button" className="ghost" onClick={() => setAdminDeleteTarget(null)} disabled={adminDeleteBusy}>Abbrechen</button>
        <button type="button" className="primary" onClick={deleteAdministrator} disabled={adminDeleteBusy}>Administrator endgültig löschen</button>
      </section>
    </div>
  )}

  {adminRoleTarget && adminContext?.role === 'superadmin' && (
    <div className="modal admin-role-modal">
      <section className="modal-card" role="dialog" aria-modal="true">
        <p>Soll die Rolle dieses Administrators wirklich geändert werden?</p>
        <p>
          {administratorRoleLabel(adminRoleTarget.membership.role)}
          {' → '}
          {administratorRoleLabel(adminRoleTarget.newRole)}
        </p>
        <label>
          Rolle
          <select
            value={adminRoleTarget.newRole}
            onChange={event => setAdminRoleTarget({ ...adminRoleTarget, newRole: event.target.value })}
          >
            <option value="clubadmin">Vereinsadmin</option>
            <option value="checkin_admin">Check-in-Admin</option>
          </select>
        </label>
        {adminRoleError && <p role="alert" className="admin-inline-error">{adminRoleError}</p>}
        <button type="button" className="ghost" onClick={() => setAdminRoleTarget(null)} disabled={adminRoleBusy}>Abbrechen</button>
        <button
          type="button"
          className="primary"
          onClick={updateAdministratorRole}
          disabled={adminRoleBusy || adminRoleTarget.newRole === adminRoleTarget.membership.role}
        >
          Rolle speichern
        </button>
      </section>
    </div>
  )}

  {adminStatusTarget && adminContext?.role === 'superadmin' && (
    <div className="modal admin-status-modal">
      <section className="modal-card" role="dialog" aria-modal="true">
        <p>
          {adminStatusTarget.nextActive
            ? 'Soll dieser Administrator wieder freigeschaltet werden?'
            : 'Soll dieser Administrator wirklich gesperrt werden? Er kann sich anschließend nicht mehr im Adminbereich anmelden.'}
        </p>
        {adminStatusError && <p role="alert" className="admin-inline-error">{adminStatusError}</p>}
        <button type="button" className="ghost" onClick={() => setAdminStatusTarget(null)} disabled={adminStatusBusy}>Abbrechen</button>
        <button type="button" className="primary" onClick={updateAdministratorStatus} disabled={adminStatusBusy}>
          {adminStatusTarget.nextActive ? 'Administrator freischalten' : 'Administrator sperren'}
        </button>
      </section>
    </div>
  )}

  {adminCreateOpen && adminContext?.role === 'superadmin' && (
    <div className="modal admin-create-modal">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-create-title">
        <div className="admin-modal-heading">
          <h2 id="admin-create-title">Neuen Administrator anlegen</h2>
          <button type="button" className="ghost" onClick={() => setAdminCreateOpen(false)}>Schließen</button>
        </div>
        <label>Vorname *<input value={adminCreateForm.firstName} onChange={event => setAdminCreateForm({ ...adminCreateForm, firstName: event.target.value })} /></label>
        <label>Nachname *<input value={adminCreateForm.lastName} onChange={event => setAdminCreateForm({ ...adminCreateForm, lastName: event.target.value })} /></label>
        <label>E-Mail-Adresse *<input type="email" value={adminCreateForm.email} onChange={event => setAdminCreateForm({ ...adminCreateForm, email: event.target.value })} /></label>
        <label>
          Verein *
          <select value={adminCreateForm.clubId} onChange={event => setAdminCreateForm({ ...adminCreateForm, clubId: event.target.value })}>
            <option value="">Bitte auswählen</option>
            {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        <label>
          Rolle *
          <select value={adminCreateForm.role} onChange={event => setAdminCreateForm({ ...adminCreateForm, role: event.target.value })}>
            <option value="">Bitte auswählen</option>
            <option value="clubadmin">Vereinsadmin</option>
            <option value="checkin_admin">Check-in-Admin</option>
          </select>
        </label>
        {adminCreateError && <p role="alert" className="admin-inline-error">{adminCreateError}</p>}
        <button type="button" className="primary" onClick={createAdministrator} disabled={adminCreateBusy}>
          {adminCreateBusy ? 'Einladung wird gesendet …' : 'Administrator anlegen'}
        </button>
      </section>
    </div>
  )}

  {(administratorDetailLoading || administratorDetailError || selectedAdministrator) && adminContext?.role === 'superadmin' && (
    <div className="modal admin-detail-modal">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="administrator-detail-title">
        <div className="admin-modal-heading">
          <h2 id="administrator-detail-title">Administratordetails</h2>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSelectedAdministrator(null)
              setAdministratorDetailError('')
              setAdministratorDetailLoading(false)
            }}
          >
            Schließen
          </button>
        </div>
        {administratorDetailLoading && <p>Administratordaten werden geladen …</p>}
        {administratorDetailError && <p role="alert" className="admin-inline-error">{administratorDetailError}</p>}
        {selectedAdministrator && !administratorDetailLoading && !administratorDetailError && (
          <dl>
            <dt>Vorname</dt>
            <dd>{selectedAdministrator.firstName || 'Nicht hinterlegt'}</dd>
            <dt>Nachname</dt>
            <dd>{selectedAdministrator.lastName || 'Nicht hinterlegt'}</dd>
            <dt>E-Mail-Adresse</dt>
            <dd>{selectedAdministrator.email || 'Nicht hinterlegt'}</dd>
            <dt>Rolle</dt>
            <dd>{administratorRoleLabel(selectedAdministrator.role)}</dd>
            <dt>Zugeordneter Verein</dt>
            <dd>{selectedAdministrator.club || 'Nicht hinterlegt'}</dd>
            <dt>Status</dt>
            <dd>{selectedAdministrator.active ? 'Aktiv' : 'Gesperrt'}</dd>
            <dt>Erstellungsdatum</dt>
            <dd>{selectedAdministrator.createdAt ? new Date(selectedAdministrator.createdAt).toLocaleDateString('de-DE') : 'Nicht hinterlegt'}</dd>
            <dt>Letzte Anmeldung</dt>
            <dd>{selectedAdministrator.lastSignInAt ? new Date(selectedAdministrator.lastSignInAt).toLocaleString('de-DE') : 'Nicht hinterlegt'}</dd>
          </dl>
        )}
      </section>
    </div>
  )}

  {adminManagementOpen && adminContext?.role === 'superadmin' && (
    <div className="modal">
      <section className="modal-card admin-management-modal" role="dialog" aria-modal="true" aria-labelledby="admin-management-title">
        <div className="admin-modal-heading">
          <h2 id="admin-management-title">Adminverwaltung</h2>
          <div>
            <button type="button" className="primary" onClick={openAdminCreate}>Neuen Administrator anlegen</button>
            <button type="button" className="ghost" onClick={() => setAdminManagementOpen(false)}>Schließen</button>
          </div>
        </div>
        {adminCreateSuccess && <p role="status">{adminCreateSuccess}</p>}
        {adminStatusSuccess && <p role="status">{adminStatusSuccess}</p>}
        {adminRoleSuccess && <p role="status">{adminRoleSuccess}</p>}
        {adminDeleteSuccess && <p role="status">{adminDeleteSuccess}</p>}
        {administratorMembershipsLoading && <p>Administratoren werden geladen …</p>}
        {administratorMembershipsError && <p role="alert" className="admin-inline-error">{administratorMembershipsError}</p>}
        {!administratorMembershipsLoading && !administratorMembershipsError && (
          <div className="table-wrap admin-management-table-wrap">
            <table className="admin-management-table">
              <thead>
                <tr>
                  <th>E-Mail-Adresse</th>
                  <th>Verein</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Erstellungsdatum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {administratorMemberships.map((membership, index) => (
                  <tr key={`${membership.email}-${membership.club}-${index}`}>
                    <td>{membership.email || '—'}</td>
                    <td>{membership.club || '—'}</td>
                    <td>{administratorRoleLabel(membership.role)}</td>
                    <td>{membership.active ? 'Aktiv' : 'Gesperrt'}</td>
                    <td>{membership.createdAt ? new Date(membership.createdAt).toLocaleDateString('de-DE') : '—'}</td>
                    <td>
                      <div className="admin-management-actions">
                      <button type="button" className="ghost" onClick={() => openAdministratorDetail(membership)}>Details anzeigen</button>
                      {membership.role !== 'superadmin' && (
                        <>
                          <button type="button" className="ghost" onClick={() => openAdministratorRole(membership)}>Rolle ändern</button>
                          <button type="button" className="ghost" onClick={() => confirmAdministratorStatus(membership)}>
                            {membership.active ? 'Sperren' : 'Freischalten'}
                          </button>
                          <button type="button" className="ghost" onClick={() => confirmAdministratorDelete(membership)}>Löschen</button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )}

  {smartAssistantOpen && (
    <div className="modal">
      <section className="modal-card smart-assistant-modal" role="dialog" aria-modal="true" aria-labelledby="smart-assistant-title">
        <div className="admin-modal-heading">
          <div>
            <span className="smart-assistant-eyebrow">Intelligente Vereins-Ampel</span>
            <h2 id="smart-assistant-title">{assistantIcon} {assistantHeadline}</h2>
          </div>
          <button type="button" className="ghost" onClick={() => setSmartAssistantOpen(false)}>Schließen</button>
        </div>
        {smartAssistantError && <p className="admin-inline-error">{smartAssistantError}</p>}
        {!smartAssistantError && !(smartAssistant?.tasks || []).length && (
          <div className="smart-assistant-all-clear">
            <ShieldCheck size={24} />
            <div><strong>Keine offenen Aufgaben</strong><span>Alle automatisch geprüften Bereiche sind in Ordnung.</span></div>
          </div>
        )}
        <div className="smart-assistant-tasks">
          {(smartAssistant?.tasks || []).map(task => (
            <article key={task.id} className={`smart-assistant-task smart-assistant-task-${task.priority}`}>
              <span className="smart-assistant-task-dot" aria-hidden="true">{task.priority === 'red' ? '🔴' : '🟡'}</span>
              <div>
                <strong>{task.title}</strong>
                <p>{task.detail}</p>
              </div>
              <button type="button" className="ghost" onClick={() => openSmartAssistantTask(task)}>
                {task.actionLabel} →
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )}

  {mailDialogOpen && (
    <div className="modal">
      <div className="card">
        <h2>E-Mail versenden</h2>

        <button className="primary" onClick={() => setMailType('time')}>
          Uhrzeit geändert
        </button>

        <button className="primary" onClick={() => setMailType('location')}>
          Treffpunkt geändert
        </button>

        {mailType === 'time' && (
          <input
            type="text"
            placeholder="Neue Uhrzeit"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
          />
        )}

        {mailType === 'location' && (
          <input
            type="text"
            placeholder="Neuer Treffpunkt"
            value={newMeetingPoint}
            onChange={e => setNewMeetingPoint(e.target.value)}
          />
        )}

        <button
          className="primary"
          onClick={sendReminderMail}
          disabled={
            (mailType === 'time' && !newTime) ||
            (mailType === 'location' && !newMeetingPoint)
          }
        >
          E-Mail senden
        </button>

        <button
          className="ghost"
          onClick={() => setMailDialogOpen(false)}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )}

  {vetSendDate && (
    <div className="modal">
      <section className="modal-card vet-send-modal" role="dialog" aria-modal="true" aria-labelledby="vet-send-title">
        <h2 id="vet-send-title">Sammelimpfbescheinigung versenden</h2>
        <p>
          Sammelimpfbescheinigung für den Impftermin am{' '}
          <strong>{formatGermanVaccinationDate(vetSendDate.date)}</strong> jetzt versenden?
        </p>
        <div className="vaccination-modal-actions">
          <button type="button" className="ghost" onClick={() => setVetSendDate(null)} disabled={vetSending}>
            Abbrechen
          </button>
          <button type="button" className="primary" onClick={() => sendVetCertificateForDate(vetSendDate)} disabled={vetSending}>
            {vetSending ? 'Wird gesendet …' : 'Jetzt senden'}
          </button>
        </div>
      </section>
    </div>
  )}

  {editingVaccinationDate && (
    <div className="modal">
      <section className="modal-card vaccination-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-vaccination-title">
        <h2 id="edit-vaccination-title">Impftermin bearbeiten</h2>
        <label>Titel (inklusive Uhrzeit, falls vorhanden)<input value={editingVaccinationDate.title || ''} onChange={event => setEditingVaccinationDate({ ...editingVaccinationDate, title: event.target.value })} /></label>
        <label>Datum<input type="date" value={editingVaccinationDate.date || ''} onChange={event => setEditingVaccinationDate({ ...editingVaccinationDate, date: event.target.value })} /></label>
        <label>Hinweis oder Beschreibung<input value={editingVaccinationDate.note || ''} onChange={event => setEditingVaccinationDate({ ...editingVaccinationDate, note: event.target.value })} /></label>
        <VaccinationAddressFields value={editingVaccinationDate} onChange={address => setEditingVaccinationDate({ ...editingVaccinationDate, ...address })} />
        {dateFeedback && <p className="vaccination-date-feedback">{dateFeedback}</p>}
        <div className="vaccination-modal-actions">
          <button className="primary" onClick={updateVaccinationDate}>Änderungen speichern</button>
          <button className="ghost" onClick={() => setEditingVaccinationDate(null)}>Abbrechen</button>
        </div>
      </section>
    </div>
  )}

  
    <main className="admin-wrap admin-dashboard-layout">
      <div id="admin-dashboard-top" className="admin-top">
        <h1>Adminbereich</h1>
        <div>
          {logoutError && <span role="alert">{logoutError}</span>}
          {adminContext?.role === 'superadmin' && (
            <button className="ghost" onClick={openAdminManagement}>Adminverwaltung</button>
          )}
          <a
            className="ghost admin-manual-download"
            href="/Bedienungsanleitung-Impfgruppenmanager.pdf"
            download
          >
            <Download size={16}/> Bedienungsanleitung herunterladen
          </a>
          <button className="ghost" onClick={onLogout}><LogOut size={16}/> Abmelden</button>
        </div>
      </div>
      <AdminPresence />
      <div className="stats admin-dashboard-stats">
        <InteractiveStatCard className="stat" icon={<Users/>} label="Teilnehmer" value={stats.total} loading={loading} tone="stat-participants" animationIndex={0} />
        <InteractiveStatCard className="stat" icon={<ShieldCheck/>} label="Tiere" value={stats.animals} loading={loading} tone="stat-animals" animationIndex={1} />
        <InteractiveStatCard className="stat" icon={<Euro/>} label="Einnahmen" value={stats.revenue} loading={loading} currency tone="stat-revenue" animationIndex={2} />
      </div>
      <p style={{ margin: '0', textAlign: 'center' }}>
        {activeDashboardAppointment
          ? `Aktueller Impftermin: ${activeDashboardAppointment.title} – ${formatGermanVaccinationDate(activeDashboardAppointment.date)}`
          : 'Zurzeit ist kein zukünftiger Impftermin vorhanden.'}
      </p>
      <button
        type="button"
        className={`smart-assistant-card smart-assistant-card-${smartAssistantError ? 'error' : assistantStatus}`}
        onClick={() => setSmartAssistantOpen(true)}
      >
        <span className="smart-assistant-card-icon" aria-hidden="true">{smartAssistantError ? '⚪' : assistantIcon}</span>
        <span className="smart-assistant-card-copy">
          <small>Intelligente Vereins-Ampel</small>
          <strong>{assistantHeadline}</strong>
          <span>
            {smartAssistantLoading
              ? 'Teilnehmer, Termine, Tierarzt und System werden ausgewertet.'
              : smartAssistantError || (assistantStatus === 'green'
                ? 'Aktuell besteht kein Handlungsbedarf.'
                : 'Aufgaben ansehen und direkt zum passenden Bereich wechseln.')}
          </span>
        </span>
        <span className="smart-assistant-card-action">Aufgaben anzeigen →</span>
      </button>
      <CheckinPanel participants={bindingParticipants} vaccinationDates={vaccinationDates} onChanged={load} adminRole={adminContext?.role} />
      <section className="card admin-appointments-card">
  <h2>Anmeldungen pro Impftermin</h2>

  {dateStats.map((d, index) => (
    <div key={d.id} className="date-stat dashboard-date-row" style={{ '--date-row-delay': `${index * 70}ms` }}>
      <div>
        <strong>{d.title}</strong>
        <br />
        <small>{d.date}</small>
      </div>

      <strong>{d.count} Teilnehmer</strong>
    </div>
  ))}
</section>
      <section id="appointment-management" className="card admin-appointment-management-card">
  <h2>Impftermin anlegen</h2>

  <input
    type="text"
    placeholder="Titel des Impftermins"
    value={newDateTitle}
    onChange={e => setNewDateTitle(e.target.value)}
  />

  <input
    type="date"
    value={newDate}
    onChange={e => setNewDate(e.target.value)}
  />

  <input
    type="text"
    placeholder="Hinweis (optional)"
    value={newDateNote}
    onChange={e => setNewDateNote(e.target.value)}
  />

  <VaccinationAddressFields value={newDateAddress} onChange={setNewDateAddress} />

  <button className="primary" onClick={addVaccinationDate}>
    Impftermin speichern
  </button>
  {dateFeedback && <p className="vaccination-date-feedback">{dateFeedback}</p>}
        

{vaccinationDates.map(v => (
  <div
  key={v.id}
  className="date-card"
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }}
>
    <div>
      <strong>{v.title}</strong>
      <br />
      {new Date(v.date).toLocaleDateString('de-DE')}
      {v.note && (
        <>
          <br />
          <small>{v.note}</small>
        </>
      )}
      {formatVaccinationAddress(v).length > 0 && (
        <div className="vaccination-date-address">
          {formatVaccinationAddress(v).map(line => <small key={line}>{line}</small>)}
        </div>
      )}
    </div>
<div
  style={{
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  }}
>
  <button
    className="small"
    onClick={() => {
      setDateFeedback('')
      setEditingVaccinationDate({ ...emptyVaccinationAddress(), ...v })
    }}
  >
    Bearbeiten
  </button>

  {hasVaccinationRouteAddress(v) && <button className="small" onClick={() => openVaccinationRoute(v)}>Route prüfen</button>}

  <button
    className="small"
    onClick={() => pdfForVaccinationDate(v)}
  >
    PDF
  </button>

  <button
    className="small"
    onClick={() => cashReportForVaccinationDate(v)}
  >
    Kassenbericht
  </button>

  <button
  className="small"
  onClick={() => {
    setSelectedDate(v)
    setMailDialogOpen(true)
  }}
>
  E-Mail
</button>

  <button
    className="small"
    onClick={() => setVetSendDate(v)}
    disabled={!canSendVetCertificate(v) || vetSending}
    title={!canSendVetCertificate(v) ? 'Der Versand an den Tierarzt ist erst am Tag des Impftermins möglich.' : 'Sammelimpfbescheinigung an den Tierarzt senden'}
  >
    {vetSending && String(vetSendDate?.id) === String(v.id) ? 'Wird gesendet …' : 'Tierarzt'}
  </button>

  <button
    className="small"
    onClick={async () => {
      if (!confirm('Impftermin wirklich löschen?')) return

      await supabase
        .from('vaccination_dates')
        .delete()
        .eq('id', v.id)
        .eq('club_id', adminClubId)

      load()
    }}
  >
    Löschen
  </button>
</div>
    </div>
))}

</section>

    <section id="participant-management" className="card admin-participant-management-card">
  <div
    className="table-head"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      marginBottom: '20px'
    }}
  >
    <div className="search" style={{ flex: '1' }}>
      <Search size={18} />
      <input
        placeholder="Suchen..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />
    </div>

    <select
      value={statusFilter}
      onChange={e => setStatusFilter(e.target.value)}
    >
      <option value="all">Alle Zahlungen</option>
      <option value="paid">Bezahlt</option>
      <option value="open">Offen</option>
      <option value="pending_payment">Onlinezahlung noch nicht abgeschlossen</option>
      <option value="cancelled">Zahlung abgebrochen</option>
      <option value="expired">Zahlungsversuch abgelaufen</option>
      <option value="payment_failed">Zahlung fehlgeschlagen</option>
    </select>

    <ExportButtons
      participants={filtered.filter(isBindingRegistration)}
      certificateParticipants={participants}
      vaccinationDates={vaccinationDates}
    />
  </div>

  {loading ? (
    <p>Lade...</p>
  ) : (
    <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Adresse</th>
          <th>E-Mail</th>
          <th>Telefon</th>
          <th>TSK Betriebsnummer.</th>
          <th>Mitglied</th>
          <th>Tiere</th>
          <th>Impfung</th>
          <th>Impftermin</th>
          <th>Zahlung</th>
          <th>Anmeldestatus</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        {filtered.map(p => (
          

            <tr key={p.id}>
              <td>{p.firstname} {p.lastname}</td>
              <td>{p.street} {p.housenumber}, {p.zipcode} {p.city}</td>
              <td>{p.email}</td>
<td>{p.phone}</td>
<td>{p.tsk_number}</td>
              <td>{p.is_member ? 'Ja' : 'Nein'}</td>
              <td>{formatParticipantAnimals(p)}</td>
              <td>{p.vaccine}</td>
              <td>
  {
    vaccinationDates.find(v => v.id === p.vaccination_date_id)
      ? `${vaccinationDates.find(v => v.id === p.vaccination_date_id).title} - ${vaccinationDates.find(v => v.id === p.vaccination_date_id).date}`
      : '-'
  }
</td>
              <td>
                <span className={`status-badge ${p.payment_status === 'bezahlt' ? 'paid' : 'open'}`}>
                  {p.payment_status}{p.payment_method === 'bar' ? ' · Barzahlung vor Ort' : ''}
                </span>
              </td>
              <td><span className={`status-badge ${isBindingRegistration(p) ? 'paid' : 'open'}`}>{registrationStatusLabels[p.registration_status] || p.registration_status}</span></td>
              <td>
  <button className="small" onClick={()=>markPaid(p.id,p.payment_status!=='bezahlt')}>
    {p.payment_status==='bezahlt'?'Offen':'Bezahlt'}
  </button>

  <button
    className="small"
    onClick={()=>setEditingParticipant(p)}
  >
    Bearbeiten
  </button>
          <button
  className="small"
  onClick={() => deleteParticipant(p.id)}
>
  Löschen
</button>
          <button
  className="small"
  onClick={() =>
  window.location.href =
    `mailto:${p.email}` +
`?subject=Anmeldung zum Impftermin RGZV Hagen` +
`&body=Hallo ${p.firstname} ${p.lastname},%0D%0A%0D%0A` +
`vielen Dank für Ihre Anmeldung zum Impftermin des RGZV Hagen und Umgebung seit 1903 e.V.%0D%0A%0D%0A` +
`Ihre Anmeldung wurde erfolgreich erfasst und in unsere Teilnehmerliste aufgenommen. Der benötigte Impfstoff wird anhand der eingegangenen Anmeldungen bestellt und vorbereitet.%0D%0A%0D%0A` +
`Sollten sich Änderungen ergeben oder Sie den Termin wider Erwarten nicht wahrnehmen können, bitten wir um eine kurze Mitteilung, damit wir entsprechend planen können.%0D%0A%0D%0A` +
`Bei Fragen stehen wir Ihnen gerne zur Verfügung.%0D%0A%0D%0A` +
`Mit freundlichen Grüßen%0D%0A%0D%0A` +
`Ihr Impfwart%0D%0A%0D%0A` +
`RGZV Hagen und Umgebung seit 1903 e.V.`
}
>
  E-Mail
</button>
</td></tr>))}</tbody></table></div>)}
      </section>
      {editingParticipant && (
  <div className="modal">
  <div className="modal-card">
    <h2>Teilnehmer bearbeiten</h2>

    <input
      value={editingParticipant.firstname || ''}
      onChange={e => setEditingParticipant({...editingParticipant, firstname: e.target.value})}
      placeholder="Vorname"
    />

    <input
      value={editingParticipant.lastname || ''}
      onChange={e => setEditingParticipant({...editingParticipant, lastname: e.target.value})}
      placeholder="Nachname"
    />

    <input
      value={editingParticipant.street || ''}
      onChange={e => setEditingParticipant({...editingParticipant, street: e.target.value})}
      placeholder="Straße"
    />

    <input
      value={editingParticipant.housenumber || ''}
      onChange={e => setEditingParticipant({...editingParticipant, housenumber: e.target.value})}
      placeholder="Hausnummer"
    />

    <input
      value={editingParticipant.zipcode || ''}
      onChange={e => setEditingParticipant({...editingParticipant, zipcode: e.target.value})}
      placeholder="PLZ"
    />

    <input
      value={editingParticipant.city || ''}
      onChange={e => setEditingParticipant({...editingParticipant, city: e.target.value})}
      placeholder="Ort"
    />

    <input
      value={editingParticipant.email || ''}
      onChange={e => setEditingParticipant({...editingParticipant, email: e.target.value})}
      placeholder="E-Mail"
    />

    <input
      value={editingParticipant.phone || ''}
      onChange={e => setEditingParticipant({...editingParticipant, phone: e.target.value})}
      placeholder="Telefon"
    />

    <input
      value={editingParticipant.tsk_number || ''}
      onChange={e => setEditingParticipant({...editingParticipant, tsk_number: e.target.value})}
      placeholder="TSK Betriebsnummer"
    />

    <p><strong>Tierarten:</strong> {formatParticipantAnimals(editingParticipant)}</p>

    <input
      type="number"
      value={editingParticipant.animal_count || 0}
      onChange={e => setEditingParticipant({...editingParticipant, animal_count: Number(e.target.value)})}
      placeholder="Tieranzahl"
    />

    <select
      value={editingParticipant.vaccine || 'Newcastle'}
      onChange={e => setEditingParticipant({...editingParticipant, vaccine: e.target.value})}
    >
      <option value="Newcastle">Newcastle</option>
      <option value="IB">IB</option>
      <option value="ILT">ILT</option>
      <option value="Marek">Marek</option>
      <option value="Kokzidiose">Kokzidiose</option>
      <option value="Salmonellen">Salmonellen</option>
    </select>

    <button onClick={() => saveParticipant(editingParticipant)}>
      Speichern
    </button>

    <button onClick={() => setEditingParticipant(null)}>
      Abbrechen
    </button>
  </div>
    </div>
)}
    </main>
  </div>
}



function ExportButtons({ participants, certificateParticipants, vaccinationDates }) {
  const nextDate = vaccinationDates?.[0]?.date
  const today = new Date().toISOString().slice(0, 10)
  const isVaccinationDay = nextDate === today
  function csv() {
    const h=['Vorname','Nachname','Adresse','PLZ','Ort','E-Mail','Telefon','TSK Betriebsnummer.','Tiere','Impfung','Zahlung']
    const rows=participants.map(p=>[p.firstname,p.lastname,`${p.street||''} ${p.housenumber||''}`.trim(),p.zipcode,p.city,p.email,p.phone,p.tsk_number,formatParticipantAnimals(p),p.vaccine,p.payment_status])
    const out=[h,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n')
    const blob=new Blob([out],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob)
    a.download='teilnehmerliste-rgzv-hagen.csv'
    a.click()
  }

  async function pdf() {
    const doc = new jsPDF()
    autoTable(doc, {
      head:[['Name','Adresse','E-Mail','TSK','Tiere','Impfung','Zahlung']],
      body: participants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.email || '',
        p.tsk_number || '',
        formatParticipantAnimals(p),
        p.vaccine || '',
        p.payment_status || ''
      ])
    })
    await addPdfWatermark(doc)
    doc.save('teilnehmerliste.pdf')
  }


  async function sendVetCertificate() {
    const vaccinationDate = vaccinationDates?.[0]
    const checkedParticipants = checkedInParticipantsForVaccinationDate(certificateParticipants, vaccinationDate)
    if (checkedParticipants.length === 0) {
      alert('Für diesen Impftermin wurden noch keine Teilnehmer eingecheckt.')
      return
    }

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('Sammelimpfbescheinigung', 14, 15)

    doc.setFontSize(10)
    doc.text('Hiermit wird bescheinigt, dass die nachstehend aufgeführten',14,28)
    doc.text('Geflügelbestände gegen die Newcastle-Krankheit',14,35)
    doc.text('(atypische Geflügelpest) gemäß den geltenden',14,42)
    doc.text('tierseuchenrechtlichen Vorschriften schutzgeimpft wurden.',14,49)

    doc.setFontSize(11)
    doc.text('Impfstoff: Nobilis ND Clone 30',14,65)
    doc.text('Charge: ______________________',14,75)
    doc.text('Verwendbar bis: ______________',14,85)

    doc.text(`Impftermin: ${vaccinationDates?.[0]?.title || ""}`,14,100)
    doc.text(`Datum: ${vaccinationDates?.[0]?.date || ""}`,14,108)

    autoTable(doc, {
      startY: 120,
      head:[['Name','Adresse','TSK Betriebsnummer','Tierart','Anzahl']],
      body: checkedParticipants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.tsk_number || '',
        formatParticipantAnimals(p),
        p.animal_count || ''
      ])
    })

    await addPdfWatermark(doc)
    const response = await fetch('/api/send-vet-certificate', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
      },
      body: JSON.stringify({
  pdfData: doc.output('datauristring'),
  datum: vaccinationDate?.date || '',
  vaccinationDateId: vaccinationDate?.id,
  participantIds: checkedParticipants.map(participant => participant.id)
})
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.success) {
      alert(result.error || 'Die Sammelimpfbescheinigung konnte nicht versendet werden.')
      return
    }

    alert('Bescheinigung an Tierarzt versendet')
  }

  async function vaccinationCertificate() {
    const vaccinationDate = vaccinationDates?.[0]
    const checkedParticipants = checkedInParticipantsForVaccinationDate(certificateParticipants, vaccinationDate)
    if (checkedParticipants.length === 0) {
      alert('Für diesen Impftermin wurden noch keine Teilnehmer eingecheckt.')
      return
    }

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('Sammelimpfbescheinigung', 14, 15)

    doc.setFontSize(10)
    doc.text('Hiermit wird bescheinigt, dass die nachstehend aufgeführten',14,28)
    doc.text('Geflügelbestände gegen die Newcastle-Krankheit',14,35)
    doc.text('(atypische Geflügelpest) gemäß den geltenden',14,42)
    doc.text('tierseuchenrechtlichen Vorschriften schutzgeimpft wurden.',14,49)

    doc.setFontSize(11)
    doc.text('Impfstoff: Nobilis ND Clone 30',14,65)
    doc.text('Charge: ______________________',14,75)
    doc.text('Verwendbar bis: ______________',14,85)

    doc.text(`Impftermin: ${vaccinationDates?.[0]?.title || ""}`,14,100)
    doc.text(`Datum: ${vaccinationDates?.[0]?.date || ""}`,14,108)

    autoTable(doc, {
      startY: 120,
      head:[['Name','Adresse','TSK Betriebsnummer','Tierart','Anzahl']],
      body: checkedParticipants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.tsk_number || '',
        formatParticipantAnimals(p),
        p.animal_count || ''
      ])
    })

    const y = doc.lastAutoTable.finalY + 20
    doc.text('Ort, Datum: ______________________',14,y)
    doc.text('Tierarzt (Stempel / Unterschrift): ______________________',14,y+15)

    await addPdfWatermark(doc)
    doc.save('sammelimpfbescheinigung.pdf')

    
  }

  return (
    <div className="actions">
      <button onClick={pdf}><Download size={16}/> PDF</button>
      <button onClick={csv}><Download size={16}/> CSV</button>
      <button onClick={vaccinationCertificate}>Bescheinigung</button>
      <button
  onClick={sendVetCertificate}
  disabled={!isVaccinationDay}
  style={{
    opacity: isVaccinationDay ? 1 : 0.4,
    cursor: isVaccinationDay ? 'pointer' : 'not-allowed'
  }}
>
  Tierarzt
</button>
    </div>
  )
}


function VaccinationAddressFields({ value, onChange }) {
  const update = field => event => onChange({ ...value, [field]: event.target.value })
  return (
    <div className="vaccination-address-fields">
      <label>Veranstaltungsort<input value={value.venue_name || ''} onChange={update('venue_name')} placeholder="z. B. Vereinsheim RGZV Hagen" /></label>
      <div className="two">
        <label>Straße<input value={value.street || ''} onChange={update('street')} /></label>
        <label>Hausnummer<input value={value.house_number || ''} onChange={update('house_number')} /></label>
      </div>
      <div className="two">
        <label>Postleitzahl<input value={value.postal_code || ''} onChange={update('postal_code')} /></label>
        <label>Ort<input value={value.city || ''} onChange={update('city')} /></label>
      </div>
      <label className="vaccination-address-public"><input type="checkbox" checked={Boolean(value.address_public)} onChange={event => onChange({ ...value, address_public: event.target.checked })} /> Adresse öffentlich für Route freigeben</label>
    </div>
  )
}

function Input({ label, ...props }) { return <label>{label}<input {...props}/></label> }
function Stat({ icon,label,value }) { return <div className="stat">{icon}<span>{label}</span><strong>{value}</strong></div> }
function Datenschutz() {
  return (
    <div className="page legal-page privacy-page">
      <Header />
      <main className="card legal-document">
        

 <h2>Datenschutzerklärung für das Anmeldeformular</h2>

<p>
  Nach Artikel 13 der DSGVO werden Sie im Folgenden über die Verarbeitung
  Ihrer im Anmeldeformular angegebenen personenbezogenen Daten informiert.
</p>

<h3>Kontaktdaten des Formularanbieters</h3>

<p>
  Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e.V. (kurz RGZV)
  <br />
  Vertreten durch seinen 1. Vorsitzenden Frank Sternal
  <br />
  Im Wiedenbusch 41
  <br />
  58099 Hagen
  <br />
  kontakt@rgzv-hagen-westfalen.de
</p>

<h3>Verarbeitete Daten</h3>

<p>
  Neben den in der Datenschutzerklärung des RGZV beschriebenen Daten,
  werden folgende Daten im Anmeldeformular erfasst:
</p>

<ul>
  <li>Vorname, Nachname</li>
  <li>Anschrift</li>
  <li>E-Mail</li>
  <li>Telefon</li>
  <li>Betriebsnummer/Registrierungsnummer der Tierseuchenkasse (kurz TSK)</li>
  <li>Die Bestätigung der Einwilligungserklärung</li>
  <li>Auswahl Impftermin</li>
  <li>Zahlstatus</li>
</ul>

<h3>Zweck der Datenverarbeitung</h3>

<p>
  Die Daten aus dem Anmeldeformular werden ausschließlich zum Zweck der
  Anmeldung zum ausgewählten Impftermin verwendet.
</p>

<h3>Rechtsgrundlage</h3>

<p>
  Die Daten werden auf Basis einer Einwilligung der betreffenden Person
  gemäß Art. 6 Abs. 1 lit. a DSGVO erhoben.
</p>

<h3>Empfänger der personenbezogenen Daten</h3>

<p>
  Die mit diesem Anmeldeformular erhobenen personenbezogenen Daten sind
  ausschließlich Impfgruppenkoordination und dem zuständigen Tierarzt
  zugänglich und werden nicht an Dritte weitergegeben.
</p>

<h3>Dauer der Speicherung</h3>

<p>
  Die im Rahmen dieses Anmeldeformulars erhobenen personenbezogenen Daten
  werden grundsätzlich gelöscht, sobald sie nicht mehr für den Zweck ihrer
  Erhebung benötigt werden.
</p>

<h3>Widerspruchs- und Beseitigungsmöglichkeit</h3>

<p>
  Der Nutzende hat jederzeit die Möglichkeit, seine Einwilligung zur
  Verarbeitung der personenbezogenen Daten zu widerrufen.
</p>

<p>
  Alle personenbezogenen Daten, die in dem Anmeldeformular erhoben und
  gespeichert wurden, werden in diesem Fall gelöscht.
</p>

<p>
  Im Einzelnen können Sie Ihre Rechte der Datenschutzerklärung des RGZV
  entnehmen.
</p>

<h3>Nutzung von personenbezogenen Daten bei Zahlungsvorgängen</h3>

<p>
  Wenn Sie über unsere Website Zahlungen tätigen möchten, ist es
  erforderlich, dass Sie Ihre persönlichen Daten angeben, die wir für die
  Abwicklung der Zahlung benötigen.
</p>

<p>
  Alle Felder im Zahlungsformular sind Pflichtfelder und eine Angabe somit
  zwingend erforderlich.
</p>

<p>
  Die von Ihnen angegebenen Daten verarbeiten wir zur Abwicklung der
  Zahlung. Dazu können wir Ihre Zahlungsdaten an unsere Hausbank
  weitergeben.
</p>

<p>
  Rechtsgrundlage hierfür ist Art. 6 Abs. 1 Buchstabe b DSGVO.
</p>

<h3>Bezahlung mit PayPal</h3>

<p>
  Sollten Sie sich für eine Bezahlung mit dem Online-Zahlungsdienstleister
  PayPal entscheiden, werden Ihre Kontaktdaten an PayPal übermittelt.
</p>

<p>
  PayPal ist ein Angebot der PayPal (Europe) S.à.r.l. & Cie. S.C.A.,
  22-24 Boulevard Royal, L-2449 Luxembourg.
</p>

<p>
  Bei den an PayPal übermittelten personenbezogenen Daten handelt es sich
  zumeist um Vorname, Nachname, IP-Adresse, E-Mail-Adresse oder andere
  Daten, die zur Zahlungsabwicklung erforderlich sind.
</p>

<p>
  Diese Übermittlung ist zur Abwicklung Ihrer Zahlung mit der von Ihnen
  ausgewählten Zahlungsart notwendig, insbesondere zur Bestätigung Ihrer
  Identität und zur Administration Ihrer Zahlung.
</p>

<p>
  Rechtsgrundlage ist Art. 6 Abs. 1 Buchstabe b DSGVO.
</p>

<p>
  Bitte beachten Sie jedoch: Personenbezogene Daten können seitens PayPal
  auch an Leistungserbringer, an Subunternehmer oder andere verbundene
  Unternehmen weitergegeben werden, soweit dies zur Erfüllung der
  vertraglichen Verpflichtungen aus Ihrem Zahlungsauftrag erforderlich ist
  oder die personenbezogenen Daten im Auftrag verarbeitet werden sollen.
</p>

<p>
  Abhängig von der über PayPal ausgewählten Zahlungsart, z.B. Rechnung oder
  Lastschrift, werden die an PayPal übermittelten personenbezogenen Daten
  von PayPal an Wirtschaftsauskunfteien übermittelt.
</p>

<p>
  Diese Übermittlung dient der Identitäts- und Bonitätsprüfung in Bezug auf
  den von Ihnen getätigten Zahlungsauftrag.
</p>

<p>
  Um welche Auskunfteien es sich hierbei handelt und welche Daten von
  PayPal allgemein erhoben, verarbeitet, gespeichert und weitergegeben
  werden, entnehmen Sie der Datenschutzerklärung von PayPal unter:
</p>

<p>
  <a
    href="https://www.paypal.com/de/webapps/mpp/ua/privacy-full"
    target="_blank"
    rel="noopener noreferrer"
  >
    https://www.paypal.com/de/webapps/mpp/ua/privacy-full
  </a>
</p>
<h3>Bezahlung mit Stripe</h3>

<p>
  Sofern Sie eine Zahlung über Stripe durchführen, werden die für die
  Zahlungsabwicklung erforderlichen personenbezogenen Daten an Stripe
  übermittelt.
</p>

<p>
  Stripe ist ein Zahlungsdienst der Stripe Payments Europe Ltd.,
  1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland.
</p>

<p>
  Zu den übermittelten Daten können insbesondere Name,
  E-Mail-Adresse, Zahlungsbetrag, Transaktionsdaten sowie weitere für
  die Zahlungsabwicklung erforderliche Informationen gehören.
</p>

<p>
  Die Übermittlung dieser Daten erfolgt ausschließlich zum Zweck der
  Zahlungsabwicklung und auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.
</p>

<p>
  Weitere Informationen zur Datenverarbeitung durch Stripe finden Sie
  in der Datenschutzerklärung von Stripe unter:
</p>

<p>
  <a
    href="https://stripe.com/de/privacy"
    target="_blank"
    rel="noopener noreferrer"
  >
    https://stripe.com/de/privacy
  </a>
</p>
<h3>Bezahlung mit Kreditkarte</h3>

<p>
  Wenn Sie eine Zahlung per Kreditkarte wählen (z.B. Visa oder Mastercard),
  benötigen wir Ihre Kreditkartendaten.
</p>

<p>
  Wir geben diese Daten soweit zur Abwicklung der Zahlung erforderlich, an
  unseren externen Dienstleister Telecash weiter, der diese Daten bis zur
  vollständigen Abwicklung der Zahlung speichert.
</p>

<p>
  Nähere Informationen zum Umgang mit Ihren Daten durch Telecash können Sie
  der Datenschutzerklärung des Dienstleisters entnehmen:
</p>

<p>
  <a
    href="https://www.telecash.de/datenschutz"
    target="_blank"
    rel="noopener noreferrer"
  >
    https://www.telecash.de/datenschutz
  </a>
</p>

<p>
  Die vollständige Datenschutzerklärung des RGZV Hagen und Umgebung seit 1903 e.V. finden Sie unter:
  <br />
  <a
    href="https://rgzv-hagen-westfalen.com/Datenschutz/"
    target="_blank"
    rel="noopener noreferrer"
  >
    Datenschutzerklärung auf der Vereinswebsite öffnen
  </a>
</p>

<p>
  Stand Juni 2026
</p>

        <a className="legal-back" href="#">Zurück zur Anmeldung</a>
      </main>
    </div>
  )
}

function Impressum() {
  return (
    <div className="page legal-page imprint-page">
      <Header />
      <main className="card legal-document">
        <h1>Impressum</h1>

        <p>
  Rassegeflügelzuchtverein Hagen und Umgebung seit 1903 e.V.
  <br />
  Vertretungsberechtigter 1. Vorsitzender
  <br />
  Frank Sternal
  <br />
  Im Wiedenbusch 41
  <br />
  58099 Hagen
  <br />
  Tel: 02331/631841
  <br />
  Email: kontakt@rgzv-hagen-westfalen.de
  <br />
  Internet: www.rgzv-hagen-westfalen.de
</p>

<p>
  Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:
  <br />
  Frank Sternal
  <br />
  Email: webmaster@rgzv-hagen-westfalen.de
</p>

<p>
  Registergericht: Hagen
  <br />
  Registernummer: VR 3271
</p>

        <a className="legal-back" href="#">Zurück zur Anmeldung</a>
      </main>
    </div>
  )
}
function PoultryQuiz() {
  const [questions, setQuestions] = useState(() => createPoultryQuizRound())
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [results, setResults] = useState([])
  const [finished, setFinished] = useState(false)

  const currentQuestion = questions[questionIndex]
  const correctCount = results.filter(result => result.correct).length
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0

  const certificate = percentage >= 95
    ? { icon: '👑', title: 'Geflügelmeister' }
    : percentage >= 80
      ? { icon: '🏆', title: 'Geflügel-Profi' }
      : percentage >= 60
        ? { icon: '🥚', title: 'Erfahrener Geflügelhalter' }
        : percentage >= 40
          ? { icon: '🐔', title: 'Hobbyhalter' }
          : { icon: '🐣', title: 'Geflügel-Einsteiger' }

  function chooseAnswer(answer) {
    if (selectedAnswer) return
    setSelectedAnswer(answer)
    setResults(previous => [
      ...previous,
      {
        questionId: currentQuestion.id,
        selected: answer,
        correct: answer === currentQuestion.correct
      }
    ])
  }

  function continueQuiz() {
    if (!selectedAnswer) return
    if (questionIndex === questions.length - 1) {
      setFinished(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setQuestionIndex(previous => previous + 1)
    setSelectedAnswer('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startNewQuiz() {
    setQuestions(createPoultryQuizRound())
    setQuestionIndex(0)
    setSelectedAnswer('')
    setResults([])
    setFinished(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const motivation = percentage >= 95
    ? 'Herzlichen Glückwunsch! Sie gehören zu unseren Geflügelmeistern.'
    : percentage >= 80
      ? 'Ausgezeichnet! Ihr Geflügelwissen ist auf Profi-Niveau.'
      : percentage >= 60
        ? 'Sehr gut! Beim nächsten Mal schaffen Sie bestimmt den Geflügel-Profi.'
        : percentage >= 40
          ? 'Eine gute Grundlage – mit jedem Durchlauf wächst Ihr Geflügelwissen.'
          : 'Ein gelungener Einstieg. Starten Sie ein neues Quiz und entdecken Sie noch mehr Geflügelwissen.'

  return (
    <div className="page poultry-quiz-page">
      <PremiumBackground />
      <Header />
      <main className="poultry-quiz-shell">
        {!finished ? (
          <>
            <section className="poultry-quiz-heading">
              <div>
                <span className="poultry-quiz-eyebrow">Geflügelwissen entdecken</span>
                <h1>🧠 Geflügel-Quiz</h1>
                <p>10 zufällige Fragen aus {poultryQuizMeta.topics.length} Themenbereichen – unterhaltsam lernen und direkt erfahren, warum eine Antwort richtig ist.</p>
              </div>
              <div className="poultry-quiz-progress-copy">
                <strong>{questionIndex + 1}</strong>
                <span>von {questions.length}</span>
              </div>
            </section>

            <div className="poultry-quiz-progress" aria-label={`Frage ${questionIndex + 1} von ${questions.length}`}>
              <span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
            </div>

            <section className="poultry-question-card">
              <div className="poultry-question-meta">
                <span>{currentQuestion.topic}</span>
                <span className={`poultry-difficulty poultry-difficulty-${currentQuestion.difficulty}`}>{currentQuestion.difficulty}</span>
              </div>
              <h2>{currentQuestion.question}</h2>
              <div className="poultry-answer-grid">
                {currentQuestion.answers.map((answer, index) => {
                  const isSelected = selectedAnswer === answer
                  const isCorrect = selectedAnswer && answer === currentQuestion.correct
                  const isIncorrect = isSelected && answer !== currentQuestion.correct
                  return (
                    <button
                      key={answer}
                      type="button"
                      className={[
                        'poultry-answer',
                        isCorrect ? 'poultry-answer-correct' : '',
                        isIncorrect ? 'poultry-answer-incorrect' : '',
                        selectedAnswer && !isSelected && !isCorrect ? 'poultry-answer-muted' : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => chooseAnswer(answer)}
                      disabled={Boolean(selectedAnswer)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {answer}
                    </button>
                  )
                })}
              </div>

              {selectedAnswer && (
                <div className={`poultry-feedback ${selectedAnswer === currentQuestion.correct ? 'poultry-feedback-correct' : 'poultry-feedback-incorrect'}`}>
                  <div className="poultry-feedback-title">
                    <span>{selectedAnswer === currentQuestion.correct ? '✓' : '!'}</span>
                    <strong>{selectedAnswer === currentQuestion.correct ? 'Richtig beantwortet' : 'Die richtige Antwort'}</strong>
                  </div>
                  {selectedAnswer !== currentQuestion.correct && <p className="poultry-correct-answer">{currentQuestion.correct}</p>}
                  <p>{currentQuestion.explanation}</p>
                </div>
              )}

              <div className="poultry-question-actions">
                <a href="#" className="poultry-quiz-back">← Zur Startseite</a>
                <button type="button" className="primary poultry-next-button" onClick={continueQuiz} disabled={!selectedAnswer}>
                  {questionIndex === questions.length - 1 ? 'Auswertung anzeigen' : 'Nächste Frage →'}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="poultry-result">
            <div className="poultry-result-heading">
              <span className="poultry-quiz-eyebrow">Quiz abgeschlossen</span>
              <h1>Ihre Auswertung</h1>
              <p>{motivation}</p>
            </div>

            <div className="poultry-result-stats">
              <article><strong>{correctCount}/{questions.length}</strong><span>Punkte</span></article>
              <article><strong>{percentage}%</strong><span>Ergebnis</span></article>
              <article><strong>{correctCount}</strong><span>Richtig</span></article>
              <article><strong>{questions.length - correctCount}</strong><span>Falsch</span></article>
            </div>

            <article className="poultry-certificate">
              <div className="poultry-certificate-border">
                <span className="poultry-certificate-label">Digitale Urkunde</span>
                <div className="poultry-certificate-icon" aria-hidden="true">{certificate.icon}</div>
                <h2>{certificate.title}</h2>
                <p>Herzlichen Glückwunsch zu Ihrem Ergebnis im Geflügel-Quiz!</p>
                <strong>{correctCount} von {questions.length} Punkten · {percentage}%</strong>
                <time>{new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date())}</time>
              </div>
            </article>

            <div className="poultry-result-actions">
              <a href="#" className="poultry-quiz-back">← Zur Startseite</a>
              <button type="button" className="primary" onClick={startNewQuiz}>Neues Quiz starten</button>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}

function Header({ admin = false }) {
  const showAdminLogin = !admin && window.location.hash !== '#admin'
  return (
    <header
      style={{
        background: 'transparent',
        padding: '14px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      {!hasSupabase && <p role="alert" style={{ margin: '0 0 10px', color: '#ffe1c2', fontSize: '13px', fontWeight: '700', textAlign: 'center' }}>{supabaseConfigMessage}</p>}
      <div className="app-header-inner">
        <a className="app-header-brand" href="#" aria-label="Impfgruppenmanager Startseite">
          <span className="app-header-brand-mark" aria-hidden="true"><img src="/shield-orange.png" alt="" /></span>
          <span className="app-header-brand-copy"><strong>Impfgruppenmanager</strong><small>RGZV Hagen</small></span>
        </a>
        {!admin && (
          <nav className="public-header-links" aria-label="Öffentliche Bereiche">
            <a href="#quiz" className="public-quiz-link">🧠 Geflügel-Quiz</a>
            {showAdminLogin && <a href="#admin">Admin-Login</a>}
          </nav>
        )}
      </div>
    </header>
  )
}
function Footer({ showDeveloper = false }) {
  return (
    <footer
      className={showDeveloper ? 'footer footer-with-signature' : 'footer'}
      style={{
        textAlign: 'center',
        padding: '30px 20px',
        color: '#ffffff',
        background: 'transparent',
        borderTop: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="footer-content">
      © 2026 Thorsten von Oesen – Für den RGZV Hagen und Umgebung seit 1903 e.V.
      {' | '}
      <a href="#datenschutz" style={{ color: '#ffffff' }}>
        Datenschutz
      </a>
      {' | '}
      <a href="#impressum" style={{ color: '#ffffff' }}>
        Impressum
      </a>
      {showDeveloper && (
        <div className="footer-signature">
          Entwickelt von <span>Thorsten von Oesen</span> · Konzeption, Entwicklung &amp; Design
        </div>
      )}
      </div>
    </footer>
  )
}

createRoot(document.getElementById('root')).render(<><PremiumBackground /><App /></>)
