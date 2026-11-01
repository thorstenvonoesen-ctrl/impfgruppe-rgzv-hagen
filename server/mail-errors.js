export function mailError(code, message) {
  return Object.assign(new Error(message), { code, publicMessage: message })
}

// Raw SMTP/SQL errors may contain credentials, recipients or row values.
export function mailFailure(error) {
  const code = error?.code
  if (error?.publicMessage) return { code, error: error.publicMessage }
  const messages = {
    '42P01': 'Die Versandtabellen fehlen. Bitte die Migration 20261102_repair_mail_campaign_queue.sql in Supabase ausführen.',
    PGRST205: 'Die Versandtabellen fehlen im API-Schema. Bitte die Mail-Migration ausführen und den PostgREST-Schemacache neu laden.',
    '42883': 'Eine Versandfunktion fehlt. Bitte die Mail-Migrationen in Supabase ausführen.',
    PGRST202: 'Eine Versandfunktion fehlt im API-Schema. Bitte die Mail-Migrationen ausführen und den Schemacache neu laden.',
    '42703': 'Eine benötigte Datenbankspalte fehlt. Bitte Termin-, Teilnehmerstatus- und Mail-Migrationen prüfen.',
    PGRST204: 'Eine benötigte Datenbankspalte fehlt im API-Schema. Bitte die Migrationen anwenden und den Schemacache neu laden.',
    '42501': 'Der Server darf die Versanddaten nicht lesen oder schreiben. SUPABASE_SERVICE_ROLE_KEY und Datenbankberechtigungen prüfen.',
    EAUTH: 'Die SMTP-Anmeldung wurde abgelehnt. SMTP_USER und SMTP_PASS in Vercel prüfen.',
    SMTP_CONFIG: 'Die SMTP-Konfiguration ist unvollständig oder ungültig. SMTP_HOST, SMTP_PORT, SMTP_USER und SMTP_PASS in Vercel prüfen.',
    EDNS: 'Der SMTP-Servername konnte nicht aufgelöst werden. SMTP_HOST prüfen.',
    ECONNECTION: 'Die Verbindung zum SMTP-Server ist fehlgeschlagen. Host, Port und TLS prüfen.',
    ESOCKET: 'Die sichere SMTP-Verbindung ist fehlgeschlagen. Host, Port und TLS prüfen.',
    ETIMEDOUT: 'Die SMTP-Verbindung hat das Zeitlimit überschritten. Den Versandstatus vor einem weiteren Versuch prüfen.',
    EENVELOPE: 'Der SMTP-Server hat Absender oder Empfänger abgelehnt.',
    INTERRUPTED: 'Der Versandlauf wurde unterbrochen. Zustellung anhand des SMTP-Protokolls prüfen; kein automatischer Neuversand.',
    MAIL_FAILURE: 'Die Zustellung konnte nicht bestätigt werden. Versandstatus und Serverprotokoll prüfen.'
  }
  return { code: Object.hasOwn(messages, code) ? code : 'MAIL_ERROR', error: messages[code] || 'Die E-Mail-Anfrage ist fehlgeschlagen. Versandstatus und Serverprotokoll prüfen.' }
}
