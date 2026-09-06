import React, { useEffect, useState } from 'react'

const fields = [['firstname','Vorname'],['lastname','Nachname'],['email','E-Mail'],['street','Straße'],['housenumber','Hausnummer'],['zipcode','PLZ'],['city','Ort'],['phone','Telefon'],['tsk_number','TSK-Betriebsnummer']]
const animals = [['chicken_count','Hühner'],['bantam_count','Zwerghühner'],['turkey_count','Puten']]

export default function ParticipantManagement({ token }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function request(operation, signal) {
    const response = await fetch('/api/create-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'manage-registration', token, operation, revision: data?.participant.mail_revision, changes: form }), signal })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Anfrage fehlgeschlagen.')
    return result
  }
  function show(result) {
    setData(result)
    const p = { ...result.participant }
    if (animals.every(([key]) => p[key] == null)) {
      const key = animals.find(([,label]) => label === p.animal_type)?.[0]
      if (key) p[key] = p.animal_count
    }
    setForm(p)
  }
  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    request('view', controller.signal).then(show).catch(e => { if (e.name !== 'AbortError') setMessage(e.message) })
    return () => controller.abort()
  }, [token])
  async function save(operation) {
    if (busy || (operation === 'cancel' && !window.confirm('Ihre Anmeldung für diesen Impftermin verbindlich stornieren?'))) return
    setBusy(true)
    setMessage('')
    try {
      const result = await request(operation)
      show(result)
      setMessage(`${operation === 'cancel' ? 'Ihre Anmeldung wurde storniert.' : 'Ihre Anmeldung wurde gespeichert.'} ${result.emailSent ? 'Die Bestätigung wurde versendet.' : 'Der E-Mail-Versand wird verarbeitet.'}`)
    } catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  const a = data?.appointment
  return <main className="page"><section className="card" style={{ maxWidth: 800, margin: '24px auto' }}>
    <h1>Meine Anmeldung verwalten</h1>
    <p role="status">{message || (!data ? 'Anmeldung wird geladen …' : '')}</p>
    {data && <>
      <h2>{a.title}</h2>
      <p>{a.date?.split('-').reverse().join('.')} · {a.time || a.title?.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || 'Uhrzeit noch nicht angegeben'}</p>
      <p>{[a.venue_name, [a.street,a.house_number].filter(Boolean).join(' '), [a.postal_code,a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
      <p>{data.participant.registration_status === 'cancelled' ? 'Storniert – für diesen Termin besteht keine aktive Anmeldung mehr.' : data.editable ? 'Sie können Ihre Angaben bearbeiten oder die Anmeldung stornieren.' : 'Die Anmeldung kann nicht mehr geändert oder storniert werden.'}</p>
      <form onSubmit={e => { e.preventDefault(); save('update') }} className="form">
        <fieldset disabled={busy || !data.editable} style={{ border: 0, padding: 0 }}>
          {fields.map(([key,label]) => <label key={key} style={{ display: 'block', marginBottom: 10 }}>{label}<input name={key} type={key === 'email' ? 'email' : 'text'} required={['firstname','lastname','email','tsk_number'].includes(key)} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}
          {animals.map(([key,label]) => <label key={key} style={{ display: 'block', marginBottom: 10 }}>{label}<input type="number" min="0" max="1000000" step="1" value={form[key] ?? 0} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}
          <p>Gesamtzahl: {animals.reduce((sum,[key]) => sum + Number(form[key] || 0),0)} · Impfstoff: {form.vaccine}</p>
          {data.editable && <button className="primary" type="submit">{busy ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>}
        </fieldset>
      </form>
      <p>{form.payment_status === 'bezahlt' ? 'Bezahlt' : `Offener Betrag: ${Number(form.payment_amount || 0).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} – Zahlung: vor Ort in bar`}</p>
      {data.editable && <button className="ghost" disabled={busy} onClick={() => save('cancel')}>Anmeldung stornieren</button>}
    </>}
  </section></main>
}
