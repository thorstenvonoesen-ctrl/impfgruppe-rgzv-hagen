import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Syringe, ShieldCheck, Users, Euro, Download, Search, Lock, LogOut, CalendarDays, Navigation } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { supabase, hasSupabase, supabaseConfigMessage } from './supabase.js'
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
async function getMemberCode() {
  if (!hasSupabase) return null

  const { data } = await supabase
    .from('clubs')
    .select('member_code')
    .eq('slug', getCurrentSlug())
    .maybeSingle()

  return data?.member_code ?? null
}
import './styles.css'
import logo from './public/Logoklein.jpg'
import { APP } from './config'
const vaccines = ['Newcastle', 'IB', 'ILT', 'Marek', 'Kokzidiose', 'Salmonellen']
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN?.trim() || ''
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || ''
const MEMBER_CODE = 'RGZV2026'
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
animal_type:'',
animal_count:'',
vaccine:'Newcastle',
  vaccination_date_id:'',
member_code:''
}
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
  if (page === '#info') return <InfoPage />
  if (page === '#info-newcastle') return <InfoNewcastle />
  if (page === '#info-pflicht') return <InfoPflicht />
  if (page === '#info-sammelimpfung') return <InfoSammelimpfung />
  if (page === '#info-anmeldung') return <InfoAnmeldung />
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

  if (status === 'later') return <div className="appointment-weather weather-note">Wettervorschau erst näher am Termin verfügbar</div>
  if (status === 'unavailable') return <div className="appointment-weather weather-note">Wettervorschau nicht verfügbar</div>
  if (status !== 'ready' || !weather) return <div className="appointment-weather weather-note">Wettervorschau wird geladen</div>

  return <div className="appointment-weather"><span>{weather.icon} {Math.round(weather.temperature)} °C · {weather.label}</span><small>Regenwahrscheinlichkeit: {weather.precipitation} %</small></div>
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
      <em>Noch {days} Tage · {hours} Stunden · {minutes} Minuten · <b>{seconds} Sekunden</b></em>
      {showPublicAddress && <small className="appointment-public-address">{routeAddress}</small>}
      {canOpenRoute && <button type="button" className="appointment-route-button" onClick={() => openVaccinationRoute(appointment)}><Navigation size={14} />{isAdmin ? 'Route prüfen' : 'Route starten'}</button>}
      <WeatherPreview location={getWeatherLocation(club, appointment)} date={appointment.date} />
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

function LiveSignupStats({ club }) {
  const [stats, setStats] = useState({ participants: 0, animals: 0, dates: [] })
  const [ready, setReady] = useState(false)

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

  return (
    <section className="live-signup-stats" aria-label="Aktuelle Anmeldestatistik">
      <InteractiveStatCard className="live-stat-card" icon={<Users size={25}/>} label="Teilnehmer" value={stats.participants} loading={!ready} tone="stat-participants" animationIndex={0} />
      <InteractiveStatCard className="live-stat-card" icon={<Syringe size={25}/>} label="Tiere" value={stats.animals} loading={!ready} tone="stat-animals" animationIndex={1} />
      <InteractiveStatCard className="live-stat-card" icon={<CalendarDays size={25}/>} label="Nächster Impftermin" loading={!ready} appointmentDates={stats.dates} club={club} isAppointment tone="stat-date" animationIndex={2} />
    </section>
  )
}
function ClubSelect() {
  const [clubs, setClubs] = useState([])
const [pulse, setPulse] = useState(true)
  useEffect(() => {
    loadClubs()
  }, [])
useEffect(() => {
  const interval = setInterval(() => {
    setPulse(p => !p)
  }, 1000)

  return () => clearInterval(interval)
}, [])
  async function loadClubs() {
    if (!hasSupabase) return
    const { data } = await supabase.from('clubs').select('*').order('name')
    setClubs(data || [])
  }
  const currentClub = clubs.find(club => club.slug === getCurrentSlug()) || null

  return (
    <div
  className="page"
  style={{
    minHeight: "99vh",
    background: 'transparent'
  }}
>
     <Header />



<main className="home-main" style={{ maxWidth:'1440px', margin:'12px auto' }}>
        <div className="home-hero" style={{display:'grid',gridTemplateColumns:'250px minmax(0,1fr)',alignItems:'center',gap:'20px',background:'rgba(255,255,255,.08)',
backdropFilter:'blur(14px)',
border:'1px solid rgba(255,255,255,.15)',
boxShadow:'0 20px 50px rgba(0,0,0,.35)',color:'white',overflow:'hidden',
position:'relative',padding:'24px 40px',borderRadius:'28px',marginBottom:'24px'}}>
          <div
  style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }}
>
  <img
    src="/shield-orange.png"
    alt="Impfgruppenmanager"
    style={{
  width:'220px',
height:'220px',
  objectFit: 'contain'
}}
  />
</div>
          <div style={{ flex: 1, minWidth: 0 }}>
  <h1
    style={{
      margin: 0,
      color: '#ffffff',
      fontSize: '40px',
      fontWeight: '800',
      lineHeight: '1.05',
      letterSpacing: '-1px'
    }}
  >
    Newcastle-Sammelimpfung
<br />
<span
  style={{
  fontSize: '0.64em',
  fontWeight: '600',
  opacity: 0.95,
  whiteSpace: 'nowrap'
  }}
>
  Online-Anmeldung für den RGZV Hagen und Umgebung seit 1903 e.V.
</span>
  </h1>

  <p
    style={{
      marginTop: '18px',
      color: '#e5e7eb',
      fontSize: '17px',
      lineHeight: '1.8',
      maxWidth: '700px'
    }}
  >
    Schnell, einfach und sicher zur Anmeldung Ihres Impftermins.
    <br />
    Mitglieder des RGZV Hagen und Umgebung seit 1903 e.V. und Teilnehmer der Impfgruppe können direkt über „Zur Impfanmeldung“ ihren nächsten Impftermin anmelden.
  </p>

  <div
    style={{
      width: '120px',
      height: '5px',
      background: '#f28c28',
      borderRadius: '999px',
      marginTop: '32px'
    }}
  />
</div>
 
            
            
         
        </div>
        <LiveSignupStats club={currentClub} />
<div className="home-card-grid-wrap">

  <div className="home-nav-grid">

    <div
      className="home-nav-card"
      onClick={() => window.location.hash = '#info'}
      onMouseEnter={e => {
  e.currentTarget.style.transform = 'translateY(-8px)'
}}

onMouseLeave={e => {
  e.currentTarget.style.transform = 'translateY(0)'
}}
      style={{
        background: 'rgba(255,255,255,.08)',
backdropFilter: 'blur(14px)',
border: '1px solid rgba(255,255,255,.15)',
borderRadius: '22px',
padding: '24px',
cursor: 'pointer',
        transition: 'all .25s ease',
boxShadow: '0 20px 50px rgba(0,0,0,.35)'
      }}
    >
      <div style={{fontSize:'34px'}}>👥</div>

      <h3
  style={{
    margin:'12px 0 10px',
    fontSize:'18px',
    color:'#fff'
  }}
>
        Zur Impfanmeldung
      </h3>

      <p
  style={{
  color: '#f59e0b',
  lineHeight: '1.7',
  fontWeight: '700',
  opacity: pulse ? 1 : 0.45,
  transform: pulse ? 'scale(1)' : 'scale(1.02)',
  textShadow: pulse
    ? '0 0 12px rgba(245,158,11,0.8)'
    : '0 0 0 rgba(245,158,11,0)',
  transition: 'all 0.6s ease-in-out'
}}
>
        Direkt zur Anmeldung Ihrer Tiere für den nächsten Impftermin des RGZV Hagen.
      </p>
    </div>

    <div
      className="home-nav-card"
      onClick={() => window.location.hash = '#club-login-info'}
      onMouseEnter={e => {
  e.currentTarget.style.transform = 'translateY(-8px)'
}}

onMouseLeave={e => {
  e.currentTarget.style.transform = 'translateY(0)'
}}
      style={{
        background:'rgba(255,255,255,.08)',
backdropFilter:'blur(14px)',
border:'1px solid rgba(255,255,255,.15)',
        borderRadius:'22px',
        padding:'24px',
        boxShadow:'0 20px 50px rgba(0,0,0,.35)',
        cursor:'pointer',
        transition:'all .25s ease',
      }}
    >
      <div style={{fontSize:'34px'}}>🔒</div>

      <h3
  style={{
    margin:'12px 0 10px',
    fontSize:'18px',
    color:'#fff'
  }}
>
        Vereinslogin
      </h3>

      <p style={{color:'rgba(255,255,255,.82)',lineHeight:'1.7'}}>
        Melden Sie sich mit Ihren Zugangsdaten an und verwalten Sie Impftermine, Teilnehmer, Zahlungen und die Einstellungen Ihres Vereins.
      </p>
    </div>

    <div
      className="home-nav-card"
      onClick={() => window.location.hash = '#register-info'}
      onMouseEnter={e => {
  e.currentTarget.style.transform = 'translateY(-8px)'
}}

onMouseLeave={e => {
  e.currentTarget.style.transform = 'translateY(0)'
}}
      style={{
        background:'rgba(255,255,255,.08)',
backdropFilter:'blur(14px)',
border:'1px solid rgba(255,255,255,.15)',
        borderRadius:'22px',
        padding:'24px',
        boxShadow:'0 20px 50px rgba(0,0,0,.35)',
        cursor:'pointer',
transition:'all .25s ease'
      }}
    >
      <div style={{fontSize:'34px'}}>📅</div>

      <h3
  style={{
    margin:'12px 0 10px',
    fontSize:'18px',
    color:'#fff'
  }}
>
        Verein registrieren
      </h3>

      <p style={{color:'rgba(255,255,255,.82)',lineHeight:'1.7'}}>
  Registrieren Sie Ihren Verein und beantragen Sie die Freischaltung. Nach der Freigabe können Sie ihre eigene Newcastle-Sammelimpfung sowie Teilnehmer und Vereinsdaten selbst verwalten.
</p>

<p style={{
  marginTop:'12px',
  color:'#e38a2d',
  fontWeight:'600',
  fontSize:'14px'
}}>
  Freischaltung und Nutzung nach erfolgreicher Prüfung kostenpflichtig.
</p>
    

  
</div>

</div>
</div> 
<div
  className="home-credits"
  style={{
    textAlign: 'center',
    marginTop: '40px',
    marginBottom: '24px'
  }}
>
  <div
    style={{
      width: '80px',
      height: '4px',
      background: '#f28c28',
      borderRadius: '999px',
      margin: '0 auto 18px'
    }}
  />

  <div
    style={{
      color: 'rgba(255,255,255,0.75)',
      fontSize: '13px',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      marginBottom: '10px'
    }}
  >
    ENTWICKELT VON
  </div>

  <div
    style={{
      color: '#f28c28',
      fontFamily: "'Allura', cursive",
      fontSize: '42px',
      lineHeight: 1
    }}
  >
    Thorsten von Oesen
  </div>

  <div
    style={{
      color: 'rgba(255,255,255,0.65)',
      fontSize: '15px',
      marginTop: '12px'
    }}
  >
    Konzeption · Entwicklung · Design
  </div>
</div>
      </main>
      <Footer showDeveloper />
    </div>
  )
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
        Registrieren Sie Ihren Geflügelbestand bequem online für die nächste Newcastle-Sammelimpfung. Informieren Sie sich über die gesetzliche Impfpflicht, den Ablauf der Sammelimpfung und melden Sie Ihre Tiere anschließend direkt an.
      </p>

      <div className="info-page-benefits" aria-label="Vorteile der Online-Anmeldung">
        <span>✓ Online anmelden</span>
        <span>✓ Sicher bezahlen</span>
        <span>✓ QR-Code für den Check-in am Impftag</span>
      </div>

    </div>

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
    "Regelmäßige Newcastle-Impfungen schützen Ihren gesamten Geflügelbestand zuverlässig vor einer hochansteckenden Krankheit. Sie senken das Ausbruchsrisiko und tragen dauerhaft zur Gesundheit Ihrer Tiere bei."
  ],
  [
    "⚖️",
    "Gesetzliche Impfpflicht",
    "Die Newcastle-Impfung ist für Geflügelhalter gesetzlich vorgeschrieben und schützt vor größeren Ausbrüchen. Mit der App melden Sie Ihren Bestand einfach und übersichtlich zur Sammelimpfung an."
  ],
  [
    "👥",
    "Gemeinsame Sammelimpfung",
    "Die gemeinsame Planung bündelt Termine und Impfstoffbestellungen zentral. Das reduziert den organisatorischen Aufwand, spart wertvolle Zeit und ermöglicht allen Geflügelhaltern eine unkomplizierte Teilnahme."
  ],
  [
    "▣",
    "QR-Check-in",
    "Nach erfolgreicher Zahlung erhalten Sie automatisch Ihren persönlichen QR-Code per E-Mail. Am Impftag wird er nur noch vorgezeigt und für einen schnellen, sicheren Check-in gescannt."
  ]
].map(([icon, title, text]) => (
    <div
      className="info-page-card"
      key={title}
      onClick={() => {
  if (title === "Schutz Ihrer Tiere") {
    window.location.hash = "#info-newcastle"
  } else if (title === "Gesetzliche Impfpflicht") {
    window.location.hash = "#info-pflicht"
  } else if (title === "Gemeinsame Sammelimpfung") {
    window.location.hash = "#info-sammelimpfung"
  }
        else if (title === "QR-Check-in") {
  window.location.hash = "#info-anmeldung"
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

      <button
        className="info-page-signup-button"
        onClick={() => (window.location.hash = "#signup")}
        style={{
          margin: "12px auto 0",
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

  </div>

</section>

    </div>
  );
}
function InfoNewcastle() {
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
              Diese Informationsseite wird als Nächstes aufgebaut.
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
  const [paymentMethod, setPaymentMethod] = useState('paypal')
  const [showForm, setShowForm] = useState(true)
  const [countdown, setCountdown] = useState('')
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false)
  
  const update = e => setForm({ ...form, [e.target.name]: e.target.value })
 
  async function loadDates() {
  const clubId = await getDefaultClubId()
    const { data: clubData } = await supabase
  .from('clubs')
  .select('*')
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
    setConfirmationEmailSent(Boolean(result.emailSent))
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
    const { member_code, ...formData } = form
    try {
      let participantId = null
      let paymentAmount = 10
      if (hasSupabase) {
        const response = await fetch('/api/create-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, member_code, animal_count: Number(form.animal_count), vaccination_date_id: form.vaccination_date_id })
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Anmeldung konnte nicht gespeichert werden.')
        participantId = result.participantId
        paymentAmount = Number(result.paymentAmount || 10)
      } else {
        const currentMemberCode = await getMemberCode()
        const isMember = form.member_code?.trim().toUpperCase() === currentMemberCode?.trim().toUpperCase()
        paymentAmount = isMember ? 5 : 10
        const payload = { ...formData, club_id: await getDefaultClubId(), animal_count: Number(form.animal_count), vaccination_date_id: form.vaccination_date_id, payment_status: 'offen', payment_amount: paymentAmount, is_member: isMember }
        const list = JSON.parse(localStorage.getItem('participants') || '[]')
        list.push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
        localStorage.setItem('participants', JSON.stringify(list))
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
  body: JSON.stringify({
    participantId,
    amount: paymentAmount
  })
})

const result = await response.json()

if (result.url) {
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
          <div className="two"><Input label="E-Mail" name="email" type="email" value={form.email} onChange={update} required/><Input label="Telefon" name="phone" value={form.phone} onChange={update}/></div>
     
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

<label>
  Tierart
  <select
    name="animal_type"
    value={form.animal_type}
    onChange={update}
    required
  >
    <option value="">Bitte wählen</option>
    <option value="Hühner">Hühner</option>
    <option value="Zwerghühner">Zwerghühner</option>
    <option value="Puten">Puten</option>
    <option value="Tauben">Tauben</option>
    <option value="Wachteln">Wachteln</option>
    <option value="Wassergeflügel">Wassergeflügel</option>
    <option value="Sonstige">Sonstige</option>
  </select>
</label>
          <div className="two"><Input label="Anzahl Tiere" name="animal_count" type="number" min="1" value={form.animal_count} onChange={update} required/><label>Impfstoff<select name="vaccine" value={form.vaccine} onChange={update}>{vaccines.map(v=><option key={v}>{v}</option>)}</select></label></div>
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

  <div className="payment-option" style={{ marginTop: '10px' }}>
    <input
      type="radio"
      name="paymentMethod"
      value="paypal"
      checked={paymentMethod === 'paypal'}
      onChange={(e) => setPaymentMethod(e.target.value)}
    />
    <span style={{ marginLeft: '8px' }}>PayPal</span>
  </div>

  <div className="payment-option" style={{ marginTop: '10px' }}>
    <input
      type="radio"
      name="paymentMethod"
      value="stripe"
      checked={paymentMethod === 'stripe'}
      onChange={(e) => setPaymentMethod(e.target.value)}
    />
    <span style={{ marginLeft: '8px' }}>
      Kreditkarte / Apple Pay / Google Pay
    </span>
  </div>
</div>
          <button disabled={loading} className="primary signup-submit">{loading ? 'Speichern...' : 'Anmelden & bezahlen'}</button>
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
      onHome={() => {
        setShowPaymentSuccess(false)
        window.location.hash = '#'
      }}
      onAnother={() => {
        setShowPaymentSuccess(false)
        setConfirmationEmailSent(false)
        setForm(emptyForm())
        setPrivacyAccepted(false)
        setPaymentMethod('paypal')
        setMessage('')
      }}
    />
  )}
  </>
)
}

function SignupSuccessOverlay({ emailSent, onHome, onAnother }) {
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
    const timer = window.setTimeout(() => leave(onHomeRef.current), 8000)
    homeButtonRef.current?.focus()

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(leaveTimerRef.current)
    }
  }, [])

  return (
    <div className={`signup-success-overlay${isLeaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
      <section className="signup-success-card" role="status" aria-live="polite">
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
        <div className="signup-success-actions">
          <button ref={homeButtonRef} type="button" className="signup-success-home" onClick={() => leave(onHome)}>Zur Startseite</button>
          <button type="button" className="signup-success-another" onClick={() => leave(onAnother)}>Weitere Anmeldung erfassen</button>
        </div>
      </section>
    </div>
  )
}

function CheckinPanel({ participants, vaccinationDates, onChanged }) {
  const [dateId, setDateId] = useState('')
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [qrImage, setQrImage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const scannerRef = useRef(null)
  const selectedParticipants = participants.filter(item => String(item.vaccination_date_id) === String(dateId))
  const checkedIn = selectedParticipants.filter(item => item.checked_in).length

  useEffect(() => () => { scannerRef.current?.stop?.().catch(() => {}) }, [])
  async function showQr(participant) {
    setCandidate(participant)
    setFeedback('')
    setQrImage(await QRCode.toDataURL(participant.checkin_token, { width: 280, margin: 1, color: { dark: '#123c2b', light: '#ffffff' } }))
  }
  async function startScanner() {
    if (!dateId) return setFeedback('Bitte wählen Sie zuerst einen Impftermin.')
    setScannerActive(true)
    setFeedback('')
    requestAnimationFrame(async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('checkin-scanner')
      scannerRef.current = scanner
      await scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 230, height: 230 } }, async token => {
        const match = selectedParticipants.find(item => item.checkin_token === token)
        await scanner.stop().catch(() => {})
        scannerRef.current = null
        setScannerActive(false)
        if (match) { setCandidate(match); setFeedback('QR-Code erkannt. Bitte Check-in bestätigen.') }
        else setFeedback('Dieser QR-Code gehört nicht zum ausgewählten Impftermin.')
      }, () => {})
    })
  }
  async function confirmCheckin(checkedInValue) {
    if (!candidate || !dateId) return
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ token: candidate.checkin_token, vaccinationDateId: dateId, checkedIn: checkedInValue })
    })
    const result = await response.json()
    if (!response.ok) return setFeedback(result.error || 'Check-in konnte nicht gespeichert werden.')
    setFeedback(checkedInValue ? 'Check-in erfolgreich gespeichert.' : 'Check-in wurde zurückgesetzt.')
    setCandidate({ ...candidate, checked_in: checkedInValue })
    onChanged()
  }
  return <section className="card checkin-panel">
    <div className="checkin-head"><div><span>QR-CHECK-IN</span><h2>Einlass am Impftermin</h2></div>{dateId && <strong>{checkedIn}/{selectedParticipants.length} eingecheckt</strong>}</div>
    <select value={dateId} onChange={event => { setDateId(event.target.value); setCandidate(null); setQrImage(''); setFeedback('') }}><option value="">Impftermin auswählen</option>{vaccinationDates.map(date => <option key={date.id} value={date.id}>{date.title} · {date.date}</option>)}</select>
    {dateId && <><div className="checkin-actions"><button className="primary" type="button" onClick={startScanner}>QR-Code scannen</button><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, E-Mail oder TSK suchen" /></div>
      <div className="checkin-candidates">{selectedParticipants.filter(item => `${item.firstname} ${item.lastname} ${item.email} ${item.tsk_number}`.toLowerCase().includes(query.toLowerCase())).map(item => <div key={item.id} className="checkin-person"><div><strong>{item.firstname} {item.lastname}</strong><small>{item.email} · {item.animal_count} Tiere</small></div><div><span className={item.checked_in ? 'checkin-status done' : 'checkin-status'}>{item.checked_in ? 'Eingecheckt' : 'Offen'}</span><button type="button" className="small" onClick={() => showQr(item)}>QR-Code</button><button type="button" className="small" onClick={() => { setCandidate(item); setFeedback('Bitte Check-in bestätigen.') }}>Prüfen</button></div></div>)}</div></>}
    {scannerActive && <div className="checkin-scanner-wrap"><div id="checkin-scanner" /><button className="ghost" type="button" onClick={async () => { await scannerRef.current?.stop?.().catch(() => {}); scannerRef.current = null; setScannerActive(false) }}>Scanner schließen</button></div>}
    {candidate && <div className="checkin-confirm"><div>{qrImage && <img src={qrImage} alt={`QR-Code für ${candidate.firstname} ${candidate.lastname}`} />}<div><strong>{candidate.firstname} {candidate.lastname}</strong><p>{candidate.checked_in ? 'Bereits eingecheckt.' : 'Noch nicht eingecheckt.'}</p></div></div><div><button className="primary" type="button" onClick={() => confirmCheckin(true)}>Check-in bestätigen</button>{candidate.checked_in && <button className="ghost" type="button" onClick={() => confirmCheckin(false)}>Zurücksetzen</button>}</div></div>}
    {feedback && <p className="checkin-feedback" role="status">{feedback}</p>}
  </section>
}

function isMissingAdminMembershipSchema(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || /club_admin_memberships/i.test(error?.message || '')
}

function Admin() {
  const [logged, setLogged] = useState(false)
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminContext, setAdminContext] = useState(null)
  const [loginError, setLoginError] = useState('')
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
    if (!ADMIN_PIN) return setLoginError('Der Adminzugang ist noch nicht vollständig konfiguriert.')
    if (pin !== ADMIN_PIN) return setLoginError('Die Admin-PIN ist nicht korrekt.')
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
            <p>Bitte bestätigen Sie Ihre PIN und melden Sie sich mit Ihrem Admin-Konto an.</p>
          </div>
          <label className="admin-login-field">
            <span>Admin-PIN</span>
            <input placeholder="Admin-PIN" value={pin} onChange={e=>setPin(e.target.value)} type="password"/>
          </label>
          <label className="admin-login-field"><span>E-Mail</span><input placeholder="admin@verein.de" value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" /></label>
          <label className="admin-login-field"><span>Passwort</span><input placeholder="Passwort" value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
          {!ADMIN_PIN && <p role="alert" className="admin-login-error">Der Adminzugang ist noch nicht vollständig konfiguriert.</p>}
          {loginError && <p role="alert" className="admin-login-error">{loginError}</p>}
          <button className="primary admin-login-submit" onClick={login} disabled={!ADMIN_PIN}>Einloggen</button>
          <a className="admin-login-back" href="#">← Zur Anmeldung</a>
        </section>
      </main>
      <Footer />
    </div>
  )
  return <AdminDashboard adminContext={adminContext} onLogout={async()=>{ await supabase.auth.signOut(); setAdminContext(null); setLogged(false) }} />
}

function AdminDashboard({ onLogout, adminContext }) {
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
  const [dateFeedback, setDateFeedback] = useState('')
  const [clubs, setClubs] = useState([])
const [selectedClub, setSelectedClub] = useState(null)
  const adminClubId = adminContext?.club_id
  const activeClub = selectedClub || clubs.find(club => club.id === adminClubId) || null
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
  const { error } = await supabase
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

  if (error) {
    setDateFeedback('Impftermin konnte nicht gespeichert werden.')
    return
  }
  setNewDate('')
    setNewDateTitle('')
setNewDateNote('')
  setNewDateAddress(emptyVaccinationAddress())
  setDateFeedback('Impftermin wurde gespeichert.')
  load()
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
  async function markPaid(id, paid) {
  if (hasSupabase) {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/admin-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ participantId: id, paid })
    })
    if (!response.ok) { alert('Zahlungsstatus konnte nicht gespeichert werden.'); return }
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
  const filtered = participants.filter(p => {
  const matchesSearch = `${p.firstname} ${p.lastname} ${p.city} ${p.email}`.toLowerCase().includes(q.toLowerCase())
  const matchesStatus =
    statusFilter === 'all' ||
    (statusFilter === 'paid' && p.payment_status === 'bezahlt') ||
    (statusFilter === 'open' && p.payment_status !== 'bezahlt')

  return matchesSearch && matchesStatus
    })
  const stats = useMemo(() => ({
    total: participants.length,
    animals: participants.reduce((sum, participant) => sum + Number(participant.animal_count || 0), 0),
    revenue: participants
      .filter(participant => participant.payment_status === 'bezahlt')
      .reduce((sum, participant) => sum + Number(participant.payment_amount || 0), 0)
  }), [participants])
  const dateStats = vaccinationDates.map(v => ({
  ...v,
  count: participants.filter(p => p.vaccination_date_id === v.id).length
}))
  function pdfForVaccinationDate(v) {
  const list = participants.filter(
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
      p.animal_count || '',
      p.vaccine || '',
      p.payment_status || 'offen'
    ])
  })

  doc.save(`teilnehmerliste-${v.date}.pdf`)
}

  function cashReportForVaccinationDate(v) {
    const list = participants.filter(
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
        participant.animal_type || '',
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

    doc.save(`kassenbericht-${v.date}.pdf`)
  }




  return <div className="page admin"><Header admin />

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

  
    <main className="admin-wrap">
      <div className="admin-top"><h1>Adminbereich</h1><button className="ghost" onClick={onLogout}><LogOut size={16}/> Logout</button></div>
      <div className="stats admin-dashboard-stats">
        <InteractiveStatCard className="stat" icon={<Users/>} label="Teilnehmer" value={stats.total} loading={loading} tone="stat-participants" animationIndex={0} />
        <InteractiveStatCard className="stat" icon={<ShieldCheck/>} label="Tiere" value={stats.animals} loading={loading} tone="stat-animals" animationIndex={1} />
        <InteractiveStatCard className="stat" icon={<Euro/>} label="Einnahmen" value={stats.revenue} loading={loading} currency tone="stat-revenue" animationIndex={2} />
        <InteractiveStatCard className="stat" icon={<CalendarDays/>} label="Nächster Impftermin" loading={loading} appointmentDates={vaccinationDates} club={activeClub} isAppointment isAdmin tone="stat-date" animationIndex={3} />
      </div>
      <CheckinPanel participants={participants} vaccinationDates={vaccinationDates} onChanged={load} />
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
      <section className="card">
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

    <section className="card">
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
    </select>

    <ExportButtons
      participants={filtered}
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
              <td>{p.animal_count}</td>
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
                  {p.payment_status}
                </span>
              </td>
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



function ExportButtons({ participants, vaccinationDates }) {
  const nextDate = vaccinationDates?.[0]?.date
  const today = new Date().toISOString().slice(0, 10)
  const isVaccinationDay = nextDate === today
  function csv() {
    const h=['Vorname','Nachname','Adresse','PLZ','Ort','E-Mail','Telefon','TSK Betriebsnummer.','Tiere','Impfung','Zahlung']
    const rows=participants.map(p=>[p.firstname,p.lastname,`${p.street||''} ${p.housenumber||''}`.trim(),p.zipcode,p.city,p.email,p.phone,p.tsk_number,p.animal_count,p.vaccine,p.payment_status])
    const out=[h,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n')
    const blob=new Blob([out],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob)
    a.download='teilnehmerliste-rgzv-hagen.csv'
    a.click()
  }

  function pdf() {
    const doc = new jsPDF()
    autoTable(doc, {
      head:[['Name','Adresse','E-Mail','TSK','Tiere','Impfung','Zahlung']],
      body: participants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.email || '',
        p.tsk_number || '',
        p.animal_count || '',
        p.vaccine || '',
        p.payment_status || ''
      ])
    })
    doc.save('teilnehmerliste.pdf')
  }


  async function sendVetCertificate() {
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
      body: participants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.tsk_number || '',
        p.animal_type || '',
        p.animal_count || ''
      ])
    })

    await fetch('/api/send-vet-certificate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
  pdfData: doc.output('datauristring'),
  datum: vaccinationDates?.[0]?.date || ''
})
    })

    alert('Bescheinigung an Tierarzt versendet')
  }

  async function vaccinationCertificate() {
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
      body: participants.map(p => [
        `${p.firstname} ${p.lastname}`,
        `${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,
        p.tsk_number || '',
        p.animal_type || '',
        p.animal_count || ''
      ])
    })

    const y = doc.lastAutoTable.finalY + 20
    doc.text('Ort, Datum: ______________________',14,y)
    doc.text('Tierarzt (Stempel / Unterschrift): ______________________',14,y+15)

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
    <div className="page">
      <Header />
      <main className="card">
        

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

        <a href="#">Zurück zur Anmeldung</a>
      </main>
    </div>
  )
}

function Impressum() {
  return (
    <div className="page">
      <Header />
      <main className="card">
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

        <a href="#">Zurück zur Anmeldung</a>
      </main>
    </div>
  )
}
function Header() {
  return (
    <header
      style={{
        background: 'transparent',
        padding: '14px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      {!hasSupabase && <p role="alert" style={{ margin: '0 0 10px', color: '#ffe1c2', fontSize: '13px', fontWeight: '700', textAlign: 'center' }}>{supabaseConfigMessage}</p>}
      <div
  style={{
    width: '100%',
    display: 'flex',
    alignItems: 'center'
  }}
>
  

  

<a
  href="#admin"
  style={{
    marginLeft: 'auto',
    paddingRight: '32px',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '18px',
    fontWeight: '700'
  }}
>
  Admin-Login
</a>
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
