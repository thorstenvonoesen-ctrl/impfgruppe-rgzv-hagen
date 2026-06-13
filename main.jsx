import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Syringe, ShieldCheck, Users, Euro, Download, Search, Lock, LogOut } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, hasSupabase } from './supabase.js'
import './styles.css'

const vaccines = ['Newcastle', 'IB', 'ILT', 'Marek', 'Kokzidiose', 'Salmonellen']
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'
const PAYMENT_URL = import.meta.env.VITE_PAYMENT_URL || ''

function emptyForm() {
  return { firstname:'', lastname:'', street:'', housenumber:'', zipcode:'', city:'', email:'', phone:'', tsk_number:'', animal_count:'', vaccine:'Newcastle' }
}

function App() {
  const [admin, setAdmin] = useState(location.hash === '#admin')
  useEffect(() => {
    const onHash = () => setAdmin(location.hash === '#admin')
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  return admin ? <Admin /> : <PublicSignup />
}

function PublicSignup() {
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const update = e => setForm({ ...form, [e.target.name]: e.target.value })
useEffect(() => {
  async function finishPaypalPayment() {
    const params = new URLSearchParams(window.location.search)
    const paypal = params.get('paypal')
    const token = params.get('token')
    const participantId = params.get('participant')

    if (paypal !== 'success' || !token || !participantId) return

    setMessage('PayPal-Zahlung wird bestätigt...')
    setLoading(true)

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
        await supabase
          .from('participants')
          .update({
            payment_status: 'bezahlt',
            payment_method: 'paypal',
            payment_date: new Date().toISOString(),
            payment_id: token
          })
          .eq('id', participantId)
      }

      setMessage('Zahlung erfolgreich bestätigt. Vielen Dank!')
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch (error) {
      setMessage('Fehler bei Zahlungsbestätigung: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  finishPaypalPayment()
}, [])
  async function submit(e) {
    e.preventDefault(); setMessage(''); setLoading(true)
    const payload = { ...form, animal_count: Number(form.animal_count), payment_status: 'offen', payment_amount: 10 }
    try {
      if (hasSupabase) {
        const { error } = await supabase.from('participants').insert(payload)
        if (error) throw error
      } else {
        const list = JSON.parse(localStorage.getItem('participants') || '[]')
        list.push({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
        localStorage.setItem('participants', JSON.stringify(list))
      }
      setMessage('Anmeldung gespeichert. Du wirst jetzt zur Bezahlung weitergeleitet.')
      setForm(emptyForm())
      const response = await fetch('/api/paypal-create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})body: JSON.stringify({ participantId: data?.[0]?.id })
})

const result = await response.json()

if (result.url) {
  window.location.href = result.url
} else {
  setMessage(
    'Fehler bei PayPal: ' +
    (result.paypal?.message || result.paypal?.name || result.error || JSON.stringify(result))
  )
}
    } catch (err) { setMessage('Fehler: ' + err.message) }
    finally { setLoading(false) }
  }

  return <div className="page">
    <Header />
    <main className="hero-grid">
      <section className="card intro">
        <div className="badge"><Syringe size={18}/> Online-Anmeldung</div>
        <h1>Anmeldung Impfgruppe RGZV Hagen</h1>
        <p>Bitte trage deine Daten ein. Nach dem Absenden wirst du zur Zahlung weitergeleitet.</p>
        <div className="price"><Euro/> 10 € pro Teilnehmer</div>
      </section>
      <section className="card">
        <h2>Teilnehmer anmelden</h2>
        <form onSubmit={submit} className="form">
          <div className="two"><Input label="Vorname" name="firstname" value={form.firstname} onChange={update} required/><Input label="Nachname" name="lastname" value={form.lastname} onChange={update} required/></div>
          <div className="two"><Input label="Straße" name="street" value={form.street} onChange={update}/><Input label="Hausnummer" name="housenumber" value={form.housenumber} onChange={update}/></div>
          <div className="two"><Input label="PLZ" name="zipcode" value={form.zipcode} onChange={update}/><Input label="Ort" name="city" value={form.city} onChange={update}/></div>
          <div className="two"><Input label="E-Mail" name="email" type="email" value={form.email} onChange={update} required/><Input label="Telefon" name="phone" value={form.phone} onChange={update}/></div>
          <Input label="Tierseuchenkassen-Nr." name="tsk_number" value={form.tsk_number} onChange={update} required/>
          <div className="two"><Input label="Anzahl Tiere" name="animal_count" type="number" min="1" value={form.animal_count} onChange={update} required/><label>Impfstoff<select name="vaccine" value={form.vaccine} onChange={update}>{vaccines.map(v=><option key={v}>{v}</option>)}</select></label></div>
          <button disabled={loading} className="primary">{loading ? 'Speichern...' : 'Anmelden & bezahlen'}</button>
          {message && <p className="message">{message}</p>}
        </form>
      </section>
    </main>
    <Footer />
  </div>
}

function Admin() {
  const [logged, setLogged] = useState(sessionStorage.getItem('admin') === '1')
  const [pin, setPin] = useState('')
  if (!logged) return <div className="page center"><section className="card login"><Lock/><h1>Adminbereich</h1><input placeholder="Admin-PIN" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button className="primary" onClick={()=>{ if(pin===ADMIN_PIN){sessionStorage.setItem('admin','1');setLogged(true)} }}>Einloggen</button><a href="#">Zur Anmeldung</a></section></div>
  return <AdminDashboard onLogout={()=>{sessionStorage.removeItem('admin');setLogged(false)}} />
}

function AdminDashboard({ onLogout }) {
  const [participants, setParticipants] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    if (hasSupabase) {
      const { data, error } = await supabase.from('participants').select('*').order('created_at', { ascending:false })
      if (!error) setParticipants(data || [])
    } else setParticipants(JSON.parse(localStorage.getItem('participants') || '[]'))
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])
  async function markPaid(id, paid) {
    if (hasSupabase) await supabase.from('participants').update({ payment_status: paid?'bezahlt':'offen', payment_date: paid ? new Date().toISOString() : null }).eq('id', id)
    else {
      const list = participants.map(p=>p.id===id ? {...p, payment_status: paid?'bezahlt':'offen'} : p)
      localStorage.setItem('participants', JSON.stringify(list)); setParticipants(list); return
    }
    load()
  }
  const filtered = participants.filter(p => `${p.firstname} ${p.lastname} ${p.city} ${p.email}`.toLowerCase().includes(q.toLowerCase()))
  const stats = useMemo(()=>({ total:participants.length, animals:participants.reduce((s,p)=>s+Number(p.animal_count||0),0), paid:participants.filter(p=>p.payment_status==='bezahlt').length, open:participants.filter(p=>p.payment_status!=='bezahlt').length }),[participants])
  return <div className="page admin"><Header admin />
    <main className="admin-wrap">
      <div className="admin-top"><h1>Adminbereich</h1><button className="ghost" onClick={onLogout}><LogOut size={16}/> Logout</button></div>
      <div className="stats"><Stat icon={<Users/>} label="Teilnehmer" value={stats.total}/><Stat icon={<ShieldCheck/>} label="Tiere" value={stats.animals}/><Stat icon={<Euro/>} label="Bezahlt" value={stats.paid}/><Stat icon={<Euro/>} label="Offen" value={stats.open}/></div>
      <section className="card">
        <div className="table-head"><div className="search"><Search size={18}/><input placeholder="Suchen..." value={q} onChange={e=>setQ(e.target.value)}/></div><ExportButtons participants={filtered}/></div>
        {loading ? <p>Lade...</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Adresse</th><th>E-Mail</th><th>TSK-Nr.</th><th>Tiere</th><th>Impfung</th><th>Zahlung</th><th></th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td>{p.firstname} {p.lastname}</td><td>{p.street} {p.housenumber}, {p.zipcode} {p.city}</td><td>{p.email}<br/><small>{p.phone}</small></td><td>{p.tsk_number}</td><td>{p.animal_count}</td><td>{p.vaccine}</td><td><span className={p.payment_status==='bezahlt'?'paid':'open'}>{p.payment_status}</span></td><td><button className="small" onClick={()=>markPaid(p.id,p.payment_status!=='bezahlt')}>{p.payment_status==='bezahlt'?'Offen':'Bezahlt'}</button></td></tr>)}</tbody></table></div>}
      </section>
    </main>
  </div>
}

function ExportButtons({ participants }) {
  function csv() { const h=['Vorname','Nachname','Adresse','PLZ','Ort','E-Mail','Telefon','TSK-Nr.','Tiere','Impfung','Zahlung']; const rows=participants.map(p=>[p.firstname,p.lastname,`${p.street||''} ${p.housenumber||''}`.trim(),p.zipcode,p.city,p.email,p.phone,p.tsk_number,p.animal_count,p.vaccine,p.payment_status]); const out=[h,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n'); const blob=new Blob([out],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='teilnehmerliste-rgzv-hagen.csv'; a.click() }
  function pdf() { const doc=new jsPDF({orientation:'landscape'}); doc.setFontSize(18); doc.text('RGZV Hagen - Teilnehmerliste Impfgruppe',14,16); doc.setFontSize(10); doc.text(`Export: ${new Date().toLocaleDateString('de-DE')}`,14,24); autoTable(doc,{startY:30,head:[['Name','Adresse','E-Mail','TSK-Nr.','Tiere','Impfung','Zahlung']],body:participants.map(p=>[`${p.firstname} ${p.lastname}`,`${p.street||''} ${p.housenumber||''}, ${p.zipcode||''} ${p.city||''}`,p.email||'',p.tsk_number||'',p.animal_count||'',p.vaccine||'',p.payment_status||'offen'])}); doc.save('teilnehmerliste-rgzv-hagen.pdf') }
  return <div className="actions"><button onClick={pdf}><Download size={16}/> PDF</button><button onClick={csv}><Download size={16}/> CSV</button></div>
}
function Input({ label, ...props }) { return <label>{label}<input {...props}/></label> }
function Stat({ icon,label,value }) { return <div className="stat">{icon}<span>{label}</span><strong>{value}</strong></div> }
function Header() { return <header><div className="logo"><Syringe/> <span>RGZV Hagen</span></div><nav><a href="#">Anmeldung</a><a href="#admin">Admin</a></nav></header> }
function Footer(){ return <footer>© RGZV Hagen · Anmeldung Impfgruppe</footer> }

createRoot(document.getElementById('root')).render(<App />)
