import QRCode from 'qrcode'
import { emailSignatureHtml } from './_email-signature.js'
import { appointmentAddress, appointmentTime, canEditRegistration, escapeHtml as e, formatDate, managementUrl, money, publicBaseUrl } from './mail-rules.js'

export const mailSubjects = {
  registration: 'Ihre Anmeldung zum Impftermin ist erfolgreich eingegangen',
  changed: 'Ihre Anmeldung wurde geändert',
  cancelled: 'Ihre Anmeldung wurde storniert',
  'reminder-7d': 'Erinnerung: Ihr Impftermin ist in einer Woche',
  'reminder-24h': 'Erinnerung: Ihr Impftermin ist morgen',
  'appointment-change': 'Wichtige Änderung zu Ihrem Impftermin',
  'new-appointment': 'Neuer Impftermin verfügbar'
}

export async function buildParticipantMail(kind, p, a, { test = false, clubSlug, changes = [] } = {}) {
  if (!mailSubjects[kind]) throw new Error('Unbekannter Mailtyp.')
  const appointment = `<p><strong>Impftermin:</strong> ${e(a.title || 'Impftermin')}<br><strong>Datum:</strong> ${e(formatDate(a.date))}<br><strong>Uhrzeit:</strong> ${e(appointmentTime(a) || 'Noch nicht angegeben')}${appointmentAddress(a) ? `<br><strong>Treffpunkt:</strong> ${e(appointmentAddress(a))}` : ''}</p>`
  const intro = {
    registration: 'Ihre Anmeldung wurde erfolgreich erfasst.', changed: 'Ihre Änderungen wurden erfolgreich gespeichert. Hier finden Sie Ihre vollständigen aktuellen Anmeldedaten.',
    cancelled: 'Ihre Anmeldung wurde erfolgreich storniert. Für diesen Impftermin besteht keine aktive Anmeldung mehr.',
    'reminder-7d': 'Ihr Impftermin findet in einer Woche statt.', 'reminder-24h': 'Ihr Impftermin findet morgen statt.',
    'appointment-change': `Ihr Impftermin wurde geändert.${changes.length ? ` Geändert: ${changes.map(e).join(', ')}.` : ''} Bitte beachten Sie die aktuellen Angaben.`,
    'new-appointment': 'Ein neuer Impftermin steht zur Anmeldung zur Verfügung.'
  }[kind]
  let html = `<h2>${e(mailSubjects[kind])}</h2><p>${p.firstname || p.lastname ? `Hallo ${e(p.firstname)} ${e(p.lastname)},` : 'Guten Tag,'}</p><p>${intro}</p>${appointment}`
  const attachments = []
  if (kind === 'new-appointment') {
    const deadline = a.registration_closes_at || a.registration_deadline
    if (deadline) html += `<p><strong>Anmeldeschluss:</strong> ${e(/^\d{4}-\d{2}-\d{2}$/.test(deadline) ? formatDate(deadline) : new Date(deadline).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))}</p>`
    const url = test ? 'https://example.invalid/test-anmeldung' : `${publicBaseUrl()}/${encodeURIComponent(clubSlug || '')}?vaccinationDateId=${encodeURIComponent(a.id)}#signup`
    html += `<p><a style="display:inline-block;padding:14px 20px;background:#123c2b;color:white;border-radius:6px" href="${e(url)}">Zum neuen Impftermin anmelden</a></p>`
  } else {
    const counts = [['chicken_count', 'Hühner'], ['bantam_count', 'Zwerghühner'], ['turkey_count', 'Puten']]
    const animals = counts.some(([key]) => p[key] != null) ? counts.filter(([key]) => Number(p[key]) > 0).map(([key, label]) => `${label}: ${Number(p[key])}`).join('<br>') : `${e(p.animal_type)}: ${Number(p.animal_count || 0)}`
    html += `<p><strong>Angemeldete Tiere:</strong><br>${animals}<br><strong>Gesamtzahl:</strong> ${Number(p.animal_count || 0)}<br><strong>Impfstoff:</strong> ${e(p.vaccine || 'Newcastle')}</p>`
    if (kind !== 'cancelled') {
      html += `<p>${p.payment_status === 'bezahlt' ? '<strong>Bezahlt</strong>' : `<strong>Offener Betrag:</strong> ${e(money(p.payment_amount))}<br>Zahlung: vor Ort in bar`}</p>`
      if (kind === 'changed') html += `<p><strong>Kontaktdaten:</strong><br>${e(p.firstname)} ${e(p.lastname)}<br>${e(p.street)} ${e(p.housenumber)}<br>${e(p.zipcode)} ${e(p.city)}<br>${e(p.email)}<br>${e(p.phone)}<br>TSK-Betriebsnummer: ${e(p.tsk_number)}</p>`
      const url = test ? 'https://example.invalid/test-verwaltung' : managementUrl(p.id)
      if (['registration', 'changed'].includes(kind) || canEditRegistration(a, p)) html += `<p><a style="display:inline-block;padding:14px 20px;background:#123c2b;color:white;border-radius:6px" href="${e(url)}">Meine Anmeldung verwalten</a></p>`
      if (!p.checkin_token && !test) throw new Error('Check-in-Token fehlt.')
      attachments.push({ filename: 'check-in-qr-code.png', content: await QRCode.toBuffer(test ? 'TEST-KEIN-ECHTER-CHECKIN' : p.checkin_token, { width: 320, margin: 2, errorCorrectionLevel: 'M' }), cid: 'participant-checkin-qr' })
      html += '<p><img src="cid:participant-checkin-qr" width="320" height="320" alt="Persönlicher Check-in-QR-Code"></p><p>Bitte bringen Sie diesen QR-Code am Impftag mit. Er dient dem Check-in und ist kein Verwaltungslink.</p>'
    }
  }
  html += `${emailSignatureHtml()}<hr><p>Diese E-Mail wurde automatisch über das Anmeldesystem des RGZV Hagen erstellt.</p>`
  return { to: p.email, subject: `${test ? '[TEST] ' : ''}${mailSubjects[kind]}`, html, attachments }
}
