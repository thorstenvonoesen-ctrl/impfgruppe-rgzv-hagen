import React,{useEffect,useState} from 'react'
import {supabase} from './supabase.js'
import {parseCheckinToken} from './checkin-links.js'
import {previewCheckin} from './checkin-session.js'

// Mounted only after the existing admin login. Resolving a QR never changes attendance.
export default function QrCheckinLanding({token,onLogout,logoutError}) {
  const [participant,setParticipant]=useState(null)
  const [message,setMessage]=useState('Teilnehmer wird geprüft …')
  const [busy,setBusy]=useState(false)
  const [allowOpenPayment,setAllowOpenPayment]=useState(false)
  const parsed=parseCheckinToken(token)
  async function request(action,extra={},signal) {
    const {data:{session}}=await supabase.auth.getSession()
    const response=action==='qr-resolve'
      ?await previewCheckin({auth:supabase.auth,body:{action,token:parsed,...extra},signal})
      :await fetch('/api/checkin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},
        body:JSON.stringify({action,token:parsed,...extra}),signal})
    const result=await response.json()
    if(!response.ok)throw new Error(result.error||'Check-in konnte nicht verarbeitet werden.')
    return result
  }
  useEffect(()=>{
    setParticipant(null);setAllowOpenPayment(false)
    if(!parsed){setMessage('Ungültiger Check-in-QR-Code.');return}
    const controller=new AbortController()
    setMessage('Teilnehmer wird geprüft …')
    request('qr-resolve',{},controller.signal).then(result=>{
      if(controller.signal.aborted)return
      setParticipant(result.participant)
      setMessage(result.participant.checked_in?'Dieser Teilnehmer wurde bereits eingecheckt.':'Bitte Teilnehmer und Impftermin prüfen und den Check-in bestätigen.')
    }).catch(error=>{if(!controller.signal.aborted)setMessage(error.message)})
    return ()=>controller.abort()
  },[parsed])
  async function confirm() {
    if(busy||!participant||participant.checked_in)return
    setBusy(true)
    try {
      const result=await request('qr-checkin',{vaccinationDateId:participant.vaccination_date_id,allowOpenPayment})
      setParticipant(result.participant)
      setMessage(result.warning||'Check-in erfolgreich gespeichert.')
    }catch(error){setMessage(error.message)}finally{setBusy(false)}
  }
  return <main className="page"><section className="card" style={{maxWidth:800,margin:'24px auto'}}>
    <h1>Teilnehmer-Check-in</h1><p role="status">{message}</p>
    {participant&&<>
      <h2>{participant.firstname} {participant.lastname}</h2>
      <p>{participant.vaccination_title} · {participant.vaccination_date?.split('-').reverse().join('.')}</p>
      <p>{participant.checked_in?'Bereits eingecheckt':'Noch nicht eingecheckt'}{participant.checked_in_at?` · ${new Date(participant.checked_in_at).toLocaleString('de-DE')}`:''}</p>
      <p>{participant.payment_status==='bezahlt'?'Bezahlt':`Zahlung offen: ${Number(participant.payment_amount).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}`}</p>
      {!participant.checked_in&&<>
        {participant.payment_status!=='bezahlt'&&<label><input type="checkbox" checked={allowOpenPayment} onChange={event=>setAllowOpenPayment(event.target.checked)}/> Anwesenheit trotz offener Zahlung bestätigen. Der Zahlungsstatus bleibt unverändert.</label>}
        <button type="button" className="primary" disabled={busy||(participant.payment_status!=='bezahlt'&&!allowOpenPayment)} onClick={confirm}>{busy?'Wird gespeichert …':'Teilnehmer einchecken'}</button>
      </>}
    </>}
    <p><a href="#admin">Zur Administration</a></p>
    <button type="button" className="ghost" onClick={onLogout}>Abmelden</button>
    {logoutError&&<p role="alert">{logoutError}</p>}
  </section></main>
}
