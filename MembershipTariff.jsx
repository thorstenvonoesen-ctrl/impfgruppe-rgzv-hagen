import React, { useEffect, useRef, useState } from 'react'

export const tariffContext = (email,appointmentId,code='') => JSON.stringify([email.trim().toLowerCase(),appointmentId,code])
export default function MembershipTariff({ email='', appointmentId, memberCode='', onVerification, onQuote, showTariff=true }) {
  const [challenge,setChallenge]=useState(null)
  const [code,setCode]=useState('')
  const [proof,setProof]=useState(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const scope=tariffContext(email,appointmentId)
  const scopeRef=useRef(scope)
  scopeRef.current=scope
  const currentProof=proof?.scope===scope && proof.expiresAt>Date.now()?proof:null
  async function request(action,body={},signal) {
    const response=await fetch('/api/create-registration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,vaccinationDateId:appointmentId,...body}),signal})
    const result=await response.json()
    if(!response.ok) throw new Error(result.error||'Die E-Mail-Prüfung ist fehlgeschlagen.')
    return result
  }
  useEffect(()=>{setChallenge(null);setCode('');setProof(null);setMessage('');onVerification(null)},[scope,onVerification])
  useEffect(()=>{
    if(!proof || proof.scope!==scope) return
    const timer=setTimeout(()=>{setProof(null);onVerification(null);setMessage('Die E-Mail-Bestätigung ist abgelaufen. Bitte erneut bestätigen.')},Math.max(0,proof.expiresAt-Date.now()))
    return ()=>clearTimeout(timer)
  },[proof,scope,onVerification])
  useEffect(()=>{
    if(!showTariff||!onQuote) return
    const controller=new AbortController()
    onQuote(null)
    if(!appointmentId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    const timer=setTimeout(()=>{
      request('registration-price',{memberCode,proof:currentProof?.token},controller.signal)
        .then(result=>{if(!controller.signal.aborted) onQuote({...result,context:tariffContext(email,appointmentId,memberCode)})})
        .catch(error=>{if(!controller.signal.aborted) setMessage(error.message)})
    },300)
    return ()=>{clearTimeout(timer);controller.abort()}
  },[email,appointmentId,memberCode,currentProof,showTariff,onQuote])
  async function verify(action) {
    setBusy(true);setMessage('')
    const requestScope=scope
    try {
      const result=await request(action,{challengeId:challenge?.id,code})
      if(scopeRef.current!==requestScope) return
      if(action==='membership-challenge') {setChallenge({id:result.challengeId,scope:requestScope});setMessage(result.message)}
      else {
        const verified={token:result.token,expiresAt:result.expiresAt,scope:requestScope,email:email.trim().toLowerCase(),appointmentId}
        setProof(verified);onVerification(verified);setChallenge(null);setCode('');setMessage('E-Mail-Adresse bestätigt.')
      }
    } catch(error){if(scopeRef.current===requestScope) setMessage(error.message)}finally{setBusy(false)}
  }
  return <div className="membership-tariff">
    <p>Den Mitgliedertarif können Sie über Ihre bestätigte E-Mail-Adresse erkennen lassen. Alternativ bleibt der Mitgliedercode gültig.</p>
    {!appointmentId && <p>Bitte zuerst einen Impftermin auswählen.</p>}
    <button type="button" className="ghost" disabled={busy||!appointmentId||!email.trim()} onClick={()=>verify('membership-challenge')}>{busy?'Wird geprüft …':currentProof?'E-Mail erneut bestätigen':'E-Mail für Mitgliederprüfung bestätigen'}</button>
    {challenge?.scope===scope && <div>
      <label>Bestätigungscode aus Ihrer E-Mail<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(code.length===8&&!busy)verify('membership-verify')}}} /></label>
      <button type="button" className="ghost" disabled={busy||code.length!==8} onClick={()=>verify('membership-verify')}>Code bestätigen</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </div>
}
