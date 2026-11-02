import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { emptyMember, memberService, parseMemberCsv } from './club-members.js'

export default function ClubMemberManagement({ clubId, db = supabase }) {
  const service = useMemo(() => memberService(db), [db])
  const section = useRef(null)
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [csv, setCsv] = useState(null)
  const searching = search.trim().length >= 2

  useEffect(() => { section.current?.scrollIntoView({ block: 'start' }) }, [])
  useEffect(() => {
    if (!searching) {
      setRows([]); setCount(0); setLoading(false)
      return
    }
    let cancelled = false
    setRows([])
    setLoading(true)
    const timer = setTimeout(() => {
      service.list(clubId, search, page).then(result => {
        if (!cancelled) { setRows(result.rows); setCount(result.count) }
      }).catch(e => { if (!cancelled) { setError(e.message); setRows([]); setCount(0) } })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [service, clubId, search, searching, page, revision])

  async function save(value) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = await service.save(clubId, value)
      setMessage('Mitglied wurde gespeichert.')
      setForm(current => current?.id === saved.id || !value.id ? null : current)
      setRevision(n => n + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function remove(member) {
    if (busy || !window.confirm(`Mitglied „${member.firstname} ${member.lastname}“ dauerhaft löschen? Bestehende Impfregistrierungen, Zahlungen und Check-ins bleiben erhalten.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await service.remove(clubId, member)
      setMessage('Mitglied wurde gelöscht.')
      setForm(current => current?.id === member.id ? null : current)
      setRows(current => current.filter(row => row.id !== member.id))
      setCount(current => Math.max(0, current - 1))
      if (rows.length === 1 && page > 0) setPage(current => current - 1)
      setRevision(current => current + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function readCsv(file) {
    setCsv(null); setError(''); setMessage('')
    if (!file) return
    if (file.size > 1024 * 1024) { setError('Die CSV-Datei darf höchstens 1 MB groß sein.'); return }
    setBusy(true)
    try {
      const bytes = await file.arrayBuffer()
      let text
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('windows-1252').decode(bytes) }
      setCsv(parseMemberCsv(text))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function importCsv() {
    if (busy || !csv?.rows.length || csv.errors.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await service.import(clubId, csv.rows)
      setMessage(`${result.inserted} Mitglieder importiert. ${result.skipped + csv.duplicates} Dubletten übersprungen. Bestehende Einträge wurden nicht überschrieben.`)
      setCsv(null); setPage(0); setRevision(n => n + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
  return <section id="club-member-management" ref={section} className="card club-member-management">
    <h2>Mitgliederverwaltung</h2>
    <p>Mitglieder des Vereins erfassen und pflegen.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="actions">
      <button type="button" className="primary" disabled={busy} onClick={() => { setForm(emptyMember()); setError(''); setMessage('') }}>Mitglied hinzufügen</button>
      <button type="button" className="ghost" disabled={busy || loading} onClick={() => { setError(''); setRevision(n => n + 1) }}>Liste aktualisieren</button>
    </div>
    {form && <form className="form member-editor" onSubmit={event => { event.preventDefault(); save(form) }}>
      <h3>{form.id ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</h3>
      <fieldset disabled={busy}>
        <div className="two">
          <label>Vorname<input required maxLength={100} value={form.firstname} onChange={update('firstname')} /></label>
          <label>Nachname<input required maxLength={100} value={form.lastname} onChange={update('lastname')} /></label>
        </div>
        <div className="two">
          <label>E-Mail-Adresse<input type="email" required maxLength={254} value={form.email} onChange={update('email')} /></label>
          <label>Mitgliedsnummer (optional)<input maxLength={64} value={form.member_number || ''} onChange={update('member_number')} /></label>
        </div>
        <label><input type="checkbox" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} /> Mitgliedschaft aktiv</label>
        <label>Bemerkungen (optional)<textarea maxLength={2000} rows={3} value={form.notes || ''} onChange={update('notes')} /></label>
        <div className="actions"><button type="submit" className="primary">{busy ? 'Wird gespeichert …' : 'Mitglied speichern'}</button><button type="button" className="ghost" onClick={() => setForm(null)}>Abbrechen</button></div>
      </fieldset>
    </form>}
    <label>Mitglieder suchen<input type="search" placeholder="Mindestens 2 Zeichen: Name oder E-Mail-Adresse" value={search} onChange={event => { setSearch(event.target.value); setPage(0); setRows([]); setLoading(event.target.value.trim().length >= 2) }} /></label>
    <p role="status">{!searching ? 'Bitte mindestens zwei Zeichen eines Namens oder einer E-Mail-Adresse eingeben.' : loading ? 'Mitglieder werden geladen …' : count ? `${count} Mitglieder gefunden` : 'Keine passenden Mitglieder gefunden'}</p>
    {searching && !loading && rows.length > 0 && <div className="table-scroll"><table>
      <thead><tr><th>Name</th><th>E-Mail-Adresse</th><th>Mitgliedsnummer</th><th>Status</th><th>Aktionen</th></tr></thead>
      <tbody>{rows.map(member => <tr key={member.id}>
        <td data-label="Name">{member.firstname} {member.lastname}</td>
        <td data-label="E-Mail-Adresse">{member.email}</td>
        <td data-label="Mitgliedsnummer">{member.member_number || '–'}</td>
        <td data-label="Status">{member.is_active ? 'Aktiv' : 'Inaktiv'}</td>
        <td data-label="Aktionen"><button className="small" type="button" disabled={busy} onClick={() => { setForm(member); setError(''); setMessage('') }}>Bearbeiten</button> <button className="small" type="button" disabled={busy} onClick={() => remove(member)}>Löschen</button></td>
      </tr>)}</tbody>
    </table></div>}
    {searching && count > 50 && <div className="actions">
      <button className="small" disabled={busy || loading || page === 0} onClick={() => setPage(n => n - 1)}>Zurück</button>
      <span>Seite {page + 1}</span>
      <button className="small" disabled={busy || loading || (page + 1) * 50 >= count} onClick={() => setPage(n => n + 1)}>Weiter</button>
    </div>}
    <details className="member-import">
      <summary>Mitglieder per CSV importieren</summary>
      <p>Spalten: Vorname, Nachname, E-Mail, Mitgliedsnummer, Aktiv, Bemerkungen. Die letzten drei Spalten sind optional. Ohne Statusangabe gilt die Mitgliedschaft als aktiv. Maximal 500 Datensätze pro Datei.</p>
      <p>Gleiche E-Mail-Adressen oder Mitgliedsnummern werden innerhalb eines Vereins als Dubletten behandelt. Bestehende Daten werden beim Import nicht überschrieben.</p>
      <p><a download="Mitglieder-Vorlage.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFFVorname;Nachname;E-Mail;Mitgliedsnummer;Aktiv;Bemerkungen\r\nMax;Mustermann;max@example.invalid;;aktiv;\r\n')}`}>CSV-Vorlage herunterladen</a></p>
      <label>CSV-Datei auswählen<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { readCsv(event.target.files?.[0]); event.target.value = '' }} /></label>
      {csv && <div>
        <p>{csv.total} Datensätze gelesen; {csv.rows.length} gültige Einträge; {csv.duplicates} Dubletten innerhalb der Datei.</p>
        {csv.errors.length > 0 && <div role="alert"><p>Bitte vor dem Import alle {csv.errors.length} Fehler korrigieren:</p><ul>{csv.errors.slice(0, 20).map(e => <li key={e}>{e}</li>)}</ul></div>}
        {csv.rows.length > 0 && <div className="table-scroll"><table><caption>Vorschau der ersten 10 gültigen Einträge</caption><thead><tr><th>Name</th><th>E-Mail-Adresse</th><th>Status</th></tr></thead><tbody>{csv.rows.slice(0,10).map(row => <tr key={row.email}><td>{row.firstname} {row.lastname}</td><td>{row.email}</td><td>{row.is_active ? 'Aktiv' : 'Inaktiv'}</td></tr>)}</tbody></table></div>}
        <button className="primary" type="button" disabled={busy || !csv.rows.length || csv.errors.length > 0} onClick={importCsv}>{busy ? 'Wird importiert …' : `${csv.rows.length} Einträge importieren`}</button>
        <button className="ghost" type="button" disabled={busy} onClick={() => setCsv(null)}>Import verwerfen</button>
      </div>}
    </details>
  </section>
}
