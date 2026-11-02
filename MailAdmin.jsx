import React, { useState } from 'react'
import { supabase } from './supabase.js'

async function mailRequest(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch('/api/send-reminder-emails', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({ error: 'Die E-Mail-API hat keine gültige Antwort geliefert. Bei einem Zeitlimit zuerst den Versandstatus prüfen.' }))
  if (!response.ok) throw new Error(result.error || 'Versand fehlgeschlagen.')
  return result
}

export function MailCampaign({ appointment, kind, onClose }) {
  const [changes, setChanges] = useState([])
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const isNew = kind === 'new-appointment'
  async function run(action) {
    setBusy(true)
    setMessage('')
    try {
      const result = await mailRequest({ action, vaccinationDateId: appointment.id, kind, changes, previewToken: preview?.previewToken })
      if (action === 'preview-campaign') setPreview(result)
      else { setPreview(null); setMessage(`${result.queued} Nachrichten neu vorgemerkt, ${result.sent} an den Mailserver übergeben, ${result.failed || 0} fehlgeschlagen, ${result.uncertain || 0} unklar. Versandstatus prüfen; offene Zustellungen können dort fortgesetzt werden.`) }
    } catch (e) { setMessage(e.message); setPreview(null) } finally { setBusy(false) }
  }
  return <div className="modal"><section className="card" role="dialog" aria-modal="true" aria-labelledby="mail-campaign-title">
    <h2 id="mail-campaign-title">{isNew ? 'Frühere Teilnehmer informieren' : 'Teilnehmer über Änderung informieren'}</h2>
    <p>{appointment.title} · {appointment.date?.split('-').reverse().join('.')}</p>
    <p>Es werden die aktuell gespeicherten Termindaten versendet. Das Bearbeiten eines Termins allein löst keinen Versand aus.</p>
    {!isNew && <fieldset disabled={busy}><legend>Was wurde geändert?</legend>{['Datum','Uhrzeit','Treffpunkt'].map(label => <label key={label} style={{ display: 'block' }}><input type="checkbox" checked={changes.includes(label)} onChange={e => { setChanges(e.target.checked ? [...changes,label] : changes.filter(c => c !== label)); setPreview(null) }}/>{label}</label>)}</fieldset>}
    {preview && <p role="status">{preview.alreadyQueued ? 'Dieser Rundversand wurde bereits vorgemerkt. Kein erneuter Versand.' : `${preview.count} Empfänger erhalten diese Nachricht. Bitte bestätigen Sie den Versand.`}</p>}
    <p role="status">{message}</p>
    {!preview && <button className="primary" disabled={busy || (!isNew && !changes.length)} onClick={() => run('preview-campaign')}>Empfänger prüfen</button>}
    {preview && !preview.alreadyQueued && <button className="primary" disabled={busy || !preview.count} onClick={() => run('send-campaign')}>{busy ? 'Wird verarbeitet …' : `Versand an ${preview.count} Empfänger bestätigen`}</button>}
    <button className="ghost" disabled={busy} onClick={onClose}>Schließen</button>
  </section></div>
}

const types = [['registration','Anmeldebestätigung'],['changed','Änderungsbestätigung'],['cancelled','Stornierungsbestätigung'],['reminder-7d','7-Tage-Erinnerung'],['reminder-24h','24-Stunden-Erinnerung'],['receipt','Quittung mit PDF'],['appointment-change','Terminänderung'],['vet','Tierarztmail mit PDF'],['new-appointment','Neuer Impftermin']]
export function MailTestPanel({ clubId }) {
  const [open, setOpen] = useState(false)
  const [recipient, setRecipient] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const confirmationWarning = result => [
    result.pendingConfirmations ? `${result.pendingConfirmations >= 100 ? 'Mindestens ' : ''}${result.pendingConfirmations} Bestätigungen warten auf die Erstellung eines Versandauftrags. Nach Datenbankreparatur „Offene Zustellungen fortsetzen“ verwenden.` : '',
    result.confirmationQueueWarning || '', result.reconcileError || ''
  ].filter(Boolean).join(' ')
  async function run(action, kind) {
    setBusy(true)
    try {
      const result = await mailRequest({ action, clubId, ...(action === 'retry-delivery' ? { deliveryId: kind } : { kind }) })
      if (action === 'test-config') { setRecipient(result.recipient); setOpen(true) }
      else if (action === 'mail-status') {
        setDeliveries(result.deliveries)
        setMessage([result.deliveries.length ? 'Versandstatus aktualisiert.' : 'Keine Versandaufträge für diesen Verein vorhanden.', confirmationWarning(result)].filter(Boolean).join(' '))
      }
      else {
        setMessage(action === 'test-mail' ? `Testmail versendet an ${result.recipient}.` : `${result.sent} an den Mailserver übergeben, ${result.failed || 0} fehlgeschlagen, ${result.uncertain || 0} unklar.`)
        if (action === 'retry-delivery' || action === 'retry-pending') {
          const status=await mailRequest({ action: 'mail-status', clubId })
          setDeliveries(status.deliveries)
          const warning=confirmationWarning({...status,reconcileError:result.reconcileError})
          if(warning)setMessage(message=>`${message} ${warning}`)
        }
      }
    } catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  return <details className="card mail-test-panel admin-mail-tools">
    <summary>E-Mail: Versandstatus und Tests</summary>
    <p>Zusätzliche Versandwerkzeuge. Die regulären Bestätigungen werden automatisch versendet.</p>
    <button className="small" disabled={busy || !clubId} onClick={() => open ? setOpen(false) : run('test-config')}>{open ? 'Versandwerkzeuge schließen' : 'Versandwerkzeuge öffnen'}</button>
    <p role="status">{message}</p>
    {open && <>
      <p>{recipient ? `Alle Testmails gehen ausschließlich an ${recipient}.` : 'Testversand deaktiviert: MAIL_TEST_RECIPIENT muss mit Ihrer eigenen Testadresse konfiguriert werden.'} Es werden nur Musterdaten verwendet.</p>
      <div className="mail-test-grid">{types.map(([kind,label]) => <button className="small" key={kind} disabled={busy || !recipient} onClick={() => { if (window.confirm(`Diese Testmail ausschließlich an ${recipient} senden?`)) run('test-mail', kind) }}>{label} testen</button>)}</div>
      <p className="mail-test-actions"><button className="small" disabled={busy} onClick={() => run('mail-status')}>Versandstatus laden</button> <button className="small" disabled={busy} onClick={() => run('retry-pending')}>Offene Zustellungen fortsetzen</button></p>
      <p>Unklare Zustellungen werden nicht automatisch erneut gesendet. Sie müssen zuerst anhand des SMTP-Protokolls geprüft werden.</p>
      {deliveries.length > 0 && <div className="table-wrap"><table><thead><tr><th>Mailtyp</th><th>Empfänger</th><th>Status</th><th>Versuche</th><th>Zeitpunkt</th></tr></thead><tbody>{deliveries.map(row => <tr key={row.id}><td>{types.find(([kind]) => kind === row.kind)?.[1] || row.kind}</td><td>{row.recipient}</td><td>{({ pending: 'Vorgemerkt', sending: 'Wird versendet', sent: 'An Mailserver übergeben', failed: 'Fehlgeschlagen', uncertain: 'Zustellung unklar', skipped: 'Übersprungen' })[row.status] || row.status}{row.error ? ` – ${row.error}` : ''}{row.status === 'failed' && <button className="small" disabled={busy} onClick={() => run('retry-delivery', row.id)}>Erneut versuchen</button>}</td><td>{row.attempts}</td><td>{new Date(row.sent_at || row.created_at).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div>}
    </>}
  </details>
}
