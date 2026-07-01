import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Syringe, ShieldCheck, Users, Euro, Download, Search, Lock, LogOut } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, hasSupabase } from './supabase.js'
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
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || ''
const MEMBER_CODE = 'RGZV2026'

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
if (page === '#signup') return <PublicSignup />
  if (page === '#admin') return <Admin />
  if (page === '#datenschutz') return <Datenschutz />
  if (page === '#impressum') return <Impressum />
if (page === '#register') return <ClubRegistration />
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
function ClubSelect() {
  const [clubs, setClubs] = useState([])

  useEffect(() => {
    loadClubs()
  }, [])

  async function loadClubs() {
    if (!hasSupabase) return
    const { data } = await supabase.from('clubs').select('*').order('name')
    setClubs(data || [])
  }

  return (
    <div className="page">
      <Header />
      <main style={{ maxWidth:'1240px', margin:'40px auto 80px' }}>
        <div style={{display:'grid',gridTemplateColumns:'150px 1fr 190px',alignItems:'center',gap:'20px',background:'#1f2937',color:'white',padding:'30px 36px',borderRadius:'28px',marginBottom:'50px'}}>
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
  width: '250px',
  height: '250px',
  objectFit: 'contain'
}}
  />
</div>
          <div>
  <h1
    style={{
      margin: 0,
      color: '#ffffff',
      fontSize: '46px',
      fontWeight: '800',
      lineHeight: '1.05',
      letterSpacing: '-1px'
    }}
  >
    Online-Anmeldung zur
    <br />
    gesetzlichen Impfpflicht
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
    Impfgruppenmanager – die einfache Lösung für Geflügelhalter.
    <br />
    Wählen Sie Ihren Verein aus und melden Sie sich schnell und bequem online an.
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
          <div
  style={{
    textAlign: 'left',
    marginLeft: '20px',
    marginTop: '-10px',
    alignSelf: 'center'
  }}
>
            <div style={{fontSize:'18px',marginBottom:'22px',fontWeight:'500',color:'#fff'}}>© 2026</div>
            <div
  style={{
    color: '#f28c28',
    fontFamily: "'Allura', cursive",
    fontSize: '24px',
    fontWeight: '400',
    lineHeight: '1',
    marginBottom: '12px'
  }}
>
  Thorsten von Oesen
</div>
            <div style={{color:'#fff',fontSize:'14px',lineHeight:'1.4',marginBottom:'16px'}}>Inhaber & Entwickler</div>
            <div style={{width:'64px',height:'4px',background:'#f28c28',borderRadius:'999px'}} />
          </div>
        </div>

        <div style={{display:'grid',gap:'20px',marginTop:'30px'}}>
          <div className="card" onClick={()=>{window.location.hash='#signup'}} style={{cursor:'pointer',padding:'40px',maxWidth:'760px',margin:'0 auto',border:'1px solid #f3e5d7',boxShadow:'0 10px 30px rgba(0,0,0,0.08)',borderRadius:'16px',background:'#fffaf5'}}>
            <h2 style={{margin:0,fontSize:'30px',fontWeight:'700',color:'#ff7a00'}}>
              {clubs.length>0 ? clubs[0].name : 'RGZV Hagen und Umgebung seit 1903 e.V.'}
            </h2>
            <p style={{marginTop:'12px',color:'#6b7280'}}>
              {clubs.length>0 ? `Online-Anmeldung zur Sammelimpfung des ${clubs[0].name}.` : 'Online-Anmeldung zur Sammelimpfung'}
            </p>
            <div style={{marginTop:'20px',color:'#ff7a00',fontWeight:'700'}}>Verein auswählen →</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginTop:'20px'}}>

  <div
    className="card"
    onClick={()=>alert('Ihre Daten werden sicher verarbeitet.\n\nDie Anmeldung erfolgt online und ohne Papierkram.')}
    style={{
      cursor:'pointer',
      padding:'36px',
      border:'1px solid #f3e5d7',
      borderRadius:'20px',
      background:'#fff',
      boxShadow:'0 10px 30px rgba(0,0,0,.06)'
    }}
  >
    <h3>Sicher & bequem</h3>

    <p style={{color:'#6b7280'}}>
      Ihre Daten werden sicher verarbeitet.
      Die Anmeldung erfolgt online und ohne Papierkram.
    </p>
  </div>

  <div
    className="card"
    onClick={()=>window.location.hash='#club-register'}
    style={{
      cursor:'pointer',
      padding:'36px',
      border:'1px solid #f3e5d7',
      borderRadius:'20px',
      background:'#fff',
      boxShadow:'0 10px 30px rgba(0,0,0,.06)'
    }}
  >
    <h3>Vereine verwalten</h3>

    <p style={{color:'#6b7280'}}>
      Vereine organisieren Impftermine und Teilnehmer zentral und übersichtlich.
    </p>
  </div>

</div>
        </div>
      </main>
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
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single()

  await supabase
    .from('participants')
    .update({
      payment_status: 'bezahlt',
      payment_method: 'stripe',
      payment_date: new Date().toISOString(),
      payment_id: 'stripe_checkout'
    })
    .eq('id', participantId)
  console.log('PARTICIPANT', participant)
console.log('EMAIL', participant?.email)
if (participant?.email) {
  console.log('SENDE EMAIL AN:', participant.email)

  const emailResult = await fetch('/api/send-payment-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: participant.email,
      firstname: participant.firstname,
      lastname: participant.lastname
    })
  })

  console.log('EMAIL RESPONSE STATUS:', emailResult.status)
  console.log('EMAIL RESPONSE:', await emailResult.text())
}


  setMessage('Stripe-Zahlung erfolgreich bestätigt.')
  setLoading(false)
  return
}
    try {
      const response = await fetch('/api/paypal-capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'PayPal-Zahlung konnte nicht bestätigt werden')
      }

      if (hasSupabase) {
  const { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single()

  await supabase
    .from('participants')
    .update({
  payment_status: 'bezahlt',
  payment_method: stripe === 'success' ? 'stripe' : 'paypal',
  payment_date: new Date().toISOString(),
  payment_id: stripe === 'success' ? 'stripe_checkout' : token
})
    .eq('id', participantId)

  if (participant?.email) {
    await fetch('/api/send-payment-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: participant.email,
        firstname: participant.firstname,
        lastname: participant.lastname
      })
    })
  }
}
 
      setMessage('Zahlung erfolgreich bestätigt. Vielen Dank!')
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
    if (!privacyAccepted) {
  setMessage('Bitte der Datenschutzerklärung zustimmen.')
  setLoading(false)
  return
}
    const currentMemberCode = await getMemberCode()
    const isMember =
  form.member_code?.trim() === currentMemberCode

const paymentAmount = isMember ? 5 : 10
    const { member_code, ...formData } = form
    const payload = {
  ...formData,
  club_id: await getDefaultClubId(),
  animal_count: Number(form.animal_count),
  vaccination_date_id: form.vaccination_date_id,
  payment_status: 'offen',
  payment_amount: paymentAmount,
  is_member: isMember
}
    try {
      let participantId = null
      if (hasSupabase) {
        const { data, error } = await supabase
  .from('participants')
  .insert(payload)
  .select()
        participantId = data?.[0]?.id
        if (error) throw error
      } else {
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
  <div className="page">
    <Header />
    <main
  style={{
    maxWidth: '900px',
    margin: '40px auto'
  }}
>
      
      <section className="card">
        <h2>Teilnehmer anmelden</h2>
        <div className="section-title">
  Persönliche Daten
</div>

<div className="form-section">

<form onSubmit={submit} className="form">
          <div className="two"><Input label="Vorname" name="firstname" value={form.firstname} onChange={update} required/><Input label="Nachname" name="lastname" value={form.lastname} onChange={update} required/></div>
          <div className="two"><Input label="Straße" name="street" value={form.street} onChange={update}/><Input label="Hausnummer" name="housenumber" value={form.housenumber} onChange={update}/></div>
          <div className="two"><Input label="PLZ" name="zipcode" value={form.zipcode} onChange={update}/><Input label="Ort" name="city" value={form.city} onChange={update}/></div>
          <div className="two"><Input label="E-Mail" name="email" type="email" value={form.email} onChange={update} required/><Input label="Telefon" name="phone" value={form.phone} onChange={update}/></div>
     
          <div className="section-title">
  Tierhalterdaten
</div>
          <Input label="TSK Betriebsnummer." name="tsk_number" value={form.tsk_number} onChange={update} required/>
          <Input
  label="Mitgliedercode (optional)"
  name="member_code"
  value={form.member_code}
  onChange={update}
/>
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
    <option value="Tauben">Tauben</option>
    <option value="Wachteln">Wachteln</option>
    <option value="Wassergeflügel">Wassergeflügel</option>
    <option value="Sonstige">Sonstige</option>
  </select>
</label>
          <div className="two"><Input label="Anzahl Tiere" name="animal_count" type="number" min="1" value={form.animal_count} onChange={update} required/><label>Impfstoff<select name="vaccine" value={form.vaccine} onChange={update}>{vaccines.map(v=><option key={v}>{v}</option>)}</select></label></div>
          <div className="section-title">
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
          <div className="section-title">
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
   <div style={{ marginTop: '15px', marginBottom: '15px' }}>
  <strong>Zahlungsart:</strong>

  <div style={{ marginTop: '10px' }}>
    <input
      type="radio"
      name="paymentMethod"
      value="paypal"
      checked={paymentMethod === 'paypal'}
      onChange={(e) => setPaymentMethod(e.target.value)}
    />
    <span style={{ marginLeft: '8px' }}>PayPal</span>
  </div>

  <div style={{ marginTop: '10px' }}>
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
          <button disabled={loading} className="primary">{loading ? 'Speichern...' : 'Anmelden & bezahlen'}</button>
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
)
}

function Admin() {
  const [logged, setLogged] = useState(sessionStorage.getItem('admin') === '1')
  const [pin, setPin] = useState('')
  if (!logged) return <div className="page center"><section className="card login"><Lock/><h1>Adminbereich</h1><input placeholder="Admin-PIN" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button className="primary" onClick={()=>{ if(pin===ADMIN_PIN){sessionStorage.setItem('admin','1');setLogged(true)} }}>Einloggen</button><a href="#">Zur Anmeldung</a></section></div>
  return <AdminDashboard onLogout={()=>{sessionStorage.removeItem('admin');setLogged(false)}} />
}

function AdminDashboard({ onLogout }) {
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
  const [clubs, setClubs] = useState([])
const [selectedClub, setSelectedClub] = useState(null)
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
      const clubId = await getDefaultClubId()

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

  await supabase
    .from('vaccination_dates')
    .insert([
  {
    club_id: await getDefaultClubId(),
    title: newDateTitle,
    date: newDate,
    note: newDateNote
  }
])

  setNewDate('')
    setNewDateTitle('')
setNewDateNote('')
  load()
}
  useEffect(()=>{ load() }, [])
  async function markPaid(id, paid) {
  if (hasSupabase) {
    const { data: participant } = await supabase
      .from('participants')
      .select('*')
      .eq('id', id)
      .single()

    await supabase
      .from('participants')
      .update({
        payment_status: paid ? 'bezahlt' : 'offen',
        payment_date: paid ? new Date().toISOString() : null
      })
      .eq('id', id)

    if (paid && participant?.email) {
      await fetch('/api/send-payment-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: participant.email,
          firstname: participant.firstname,
          lastname: participant.lastname
        })
      })
    }
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
   const clubId = await getDefaultClubId()                                  
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
const clubId = await getDefaultClubId()
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
  const stats = useMemo(()=>({ total:participants.length, animals:participants.reduce((s,p)=>s+Number(p.animal_count||0),0), paid:participants.filter(p=>p.payment_status==='bezahlt').length, open:participants.filter(p=>p.payment_status!=='bezahlt').length }),[participants])
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

  
    <main className="admin-wrap">
      <div className="admin-top"><h1>Adminbereich</h1><button className="ghost" onClick={onLogout}><LogOut size={16}/> Logout</button></div>
      <div className="stats"><Stat icon={<Users/>} label="Teilnehmer" value={stats.total}/><Stat icon={<ShieldCheck/>} label="Tiere" value={stats.animals}/><Stat icon={<Euro/>} label="Bezahlt" value={stats.paid}/><Stat icon={<Euro/>} label="Offen" value={stats.open}/></div>
      <section className="card">
  <h2>Anmeldungen pro Impftermin</h2>

  {dateStats.map(d => (
    <div key={d.id} className="date-stat">
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

  <button className="primary" onClick={addVaccinationDate}>
    Impftermin speichern
  </button>
        

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
    </div>
<div
  style={{
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  }}
>
  <button
    className="small"
    onClick={() => pdfForVaccinationDate(v)}
  >
    PDF
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
    <header>
      <div className="logo">
        <img
          src="/Logoklein.png"
          alt="Impfgruppenmanager"
          className="logo-img"
        />

        
      </div>

      <nav>
        <a href="#">Anmeldung</a>
<a href="#register">Verein registrieren</a>
<a href="#club-login">Vereins-Login</a>
<a href="#admin">Admin</a>
      </nav>
    </header>
  )
}
function Footer() {
  return (
    <footer>
      © 2026 Thorsten von Oesen – Impfgruppenmanager
      {' | '}
      <a href="#datenschutz">Datenschutz</a>
      {' | '}
      <a href="#impressum">Impressum</a>
    </footer>
  )
}

createRoot(document.getElementById('root')).render(<App />)
