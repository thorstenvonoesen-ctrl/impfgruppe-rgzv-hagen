# Rundversand an frühere Teilnehmer: Reparatur und Bereitstellung

Aktuelle vollständige Reparatur auch für Teilinstallationen:
`supabase/migrations/20261103_complete_mail_queue_repair.sql`.
Ausführung und Erhalt historischer Daten: siehe `docs/mail-queue-sql-editor.md`.
Die nachfolgend beschriebene Datei vom 02.11. ist die frühere Grundreparatur.

## Befund und produktiver Zugriff

Die bisherige Meldung stammt aus dem pauschalen Catch in
`api/send-reminder-emails.js`. Sie unterscheidet fehlende Versandtabellen,
fehlende RPCs, fehlende Serverkonfiguration und andere Datenbankfehler nicht.
Ein SMTP-Fehler wird dagegen normalerweise bereits am einzelnen Versandauftrag
gespeichert. Aus der bisherigen Meldung lässt sich daher kein konkreter
produktiver SMTP-Fehler ableiten.

Der erneute Zugriff auf das in `.vercel/project.json` verknüpfte Projekt scheitert
über die Vercel-Verbindung mit `404 Project not found`. Lokal fehlen Supabase-
und SMTP-Zugangsdaten. Die produktiven Variablen, Tabellen und Funktionen konnten
nicht eingesehen werden. Keine produktive Migration, Konfigurationsänderung oder
Bereitstellung wurde ausgeführt. Es wurden keine echten E-Mails versendet.

## Nachgewiesene und behobene Codeprobleme

- Fehlende Versandtabellen werden im isolierten PostgreSQL-Test reproduziert und
  nach Reparatur erfolgreich verwendet. API-Antworten unterscheiden jetzt
  fehlende Tabellen/Spalten/RPCs, Berechtigungen und SMTP-Fehler. Keine rohen SQL-
  oder SMTP-Meldungen mit möglichen Zugangsdaten/Empfängern werden ausgegeben.
- Die Vorschau prüft statisch SMTP-Konfiguration und öffentliche App-Adresse,
  bevor neue Aufträge angelegt werden. Dies testet noch keine SMTP-Anmeldung.
- Der SMTP-Transport verwendet auf Port 465 SSL/TLS, auf Port 587 erforderliches
  STARTTLS. Die zuvor fest eingestellte Option `secure: true` war für Port 587
  ungeeignet. Ob produktiv dieser Port konfiguriert ist, ist unbekannt.
- Versand eines neuen Rundschreibens verarbeitet nur dessen Termin, Versandtyp
  und Verein. Das Markieren unterbrochener Aufträge beachtet jetzt dieselben
  Grenzen; bisher wurden dabei auch andere Vereine verändert.
- Vorschau versendet keine Mail. Gezählt werden ausschließlich eingecheckte
  Teilnehmer mit Status `completed` oder `bar_registered` an früheren regulären
  Terminen desselben Vereins. E-Mail-Adressen werden normalisiert und dedupliziert.
  Frühere archivierte Termine bleiben als Teilnahmehistorie berücksichtigt.
- Der neue Termin muss für Anmeldungen geöffnet sein, darf weder Testtermin noch
  archiviert sein. Ein geschlossener Termin wird mit ausdrücklicher Meldung
  abgewiesen; eine Einladung zur Anmeldung wäre hier nicht sinnvoll.
- Ein stabiler Batchschlüssel pro neuem Termin, eindeutige Ereignisschlüssel und
  atomare Claims verhindern doppelte Aufträge bzw. parallele Zustellung desselben
  Auftrags. Erfolgreiche und unklare Zustellungen werden nicht erneut gesendet.
  Eine SMTP-Annahme bestätigt nicht die spätere Zustellung im Empfängerpostfach.
- Fehlgeschlagene SMTP-Anmeldungen und unklare Zustellungen erscheinen im Status.
  Ein bereits angelegter Batch wird auch bei anschließendem Verarbeitungsfehler
  als vorgemerkt gemeldet. Fortsetzen erfolgt über die vorhandene Statusfunktion.
- Der vorhandene Testversand verwendet konsistent die explizite eigene Adresse
  `MAIL_TEST_RECIPIENT`; kein impliziter Testversand an das produktive SMTP-Postfach.

## In Supabase erforderlich

1. Das Projekt anhand der in Vercel Production verwendeten Supabase-URL bestimmen.
2. Falls noch nicht erfolgt, `20261101_repair_vaccination_date_save_fields.sql`
   anwenden. Teilnehmerstatus und Check-in-Grundlage müssen vorhanden sein
   (`20260724_secure_qr_checkin_foundation.sql`, `20260731_add_registration_status.sql`).
3. `20261102_repair_mail_campaign_queue.sql` ausführen. Sie richtet nur
   `mail_batches`, `mail_deliveries`, `mail_appointment_open`, `create_mail_batch`
   und `claim_mail_delivery` einschließlich Rechte und Cache-Neuladen ein.
   Zweimaliges Ausführen wurde getestet. Keine historischen Versandaufträge
   werden erzeugt; keine Teilnehmer/Termine geändert; kein Versand ausgelöst.
4. Für automatische Erinnerungen/Registrierungsnachrichten zusätzlich den Stand
   von `20260906_reliable_email_workflows.sql` und dessen Voraussetzungen prüfen.
   Die eigenständige Reparatur ersetzt diese Funktionen/Trigger nicht.

Die Reparatur lässt vorhandene Aufträge, Teilnehmer, Termine und deren Rechte
unverändert; Warteschlangentabellen bleiben ausschließlich serverseitig zugänglich.
Bei abweichenden bestehenden Tabellendefinitionen genügt `CREATE TABLE IF NOT EXISTS`
nicht zur Typkorrektur: den konkreten Schemafehler prüfen, statt Daten zurückzusetzen.

## In Vercel erforderlich

Im richtigen Projekt und für Production prüfen, anschließend neu bereitstellen:

| Variable | Bedeutung |
| --- | --- |
| `SUPABASE_URL` (oder `VITE_SUPABASE_URL`) | URL der tatsächlich verwendeten Datenbank |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverzugriff auf geschützte Versandwarteschlange und Vorschautokens; niemals `VITE_` voranstellen |
| `SMTP_HOST` | Für STRATO-Postfächer `smtp.strato.de` |
| `SMTP_PORT` | Für STRATO-Postfächer `465`, SSL/TLS |
| `SMTP_USER` | Vollständige Postfachadresse |
| `SMTP_PASS` | Postfachpasswort, kein Kundenkonto-Passwort |
| `APP_URL` | Öffentliche HTTPS-Adresse; alternativ die im Code unterstützte Produktions-URL |
| `MAIL_TEST_RECIPIENT` | Nur für bewusst ausgelöste Testmails an die eigene Testadresse |
| `CRON_SECRET` | Absicherung des automatischen Workers; für manuelles Fortsetzen nicht erforderlich |

STRATO-Dokumentation: https://www.strato.de/faq/mail/e-mailserver-adressen-ports-ssl-tls/
Port 587 ist laut STRATO für besondere Relay-Szenarien vorgesehen.

## Verifikation ohne echten Versand

- `npm test`: Unit- und SMTP-Konfigurationstests, alle mit Musterdaten/Fake-Transport.
- `node tests/mail-campaign.integration.mjs`: vollständiger API-Ablauf mit
  isoliertem PostgreSQL und injiziertem Fake-SMTP. Konkreter Termin 10.01.2027,
  Vorschau, Empfängerausschlüsse, Bestätigung, Status, fehlende Konfiguration,
  SMTP-Anmeldefehler, verweigerter Fremdzugriff und Wiederholversuche geprüft.
  Teilnehmer und bestehende Termine werden vor/nach dem Test verglichen.
- `node tests/mail-database.integration.mjs tmp/vaccination-db-deps/node_modules/@electric-sql/pglite/dist/index.js`:
  ursprüngliche Mailmigration, atomare Claims und Batch-Deduplizierung geprüft.
- `npm run build`: Produktionsbuild.

Für beide PostgreSQL-Tests ggf. zuvor:
`npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite`.
Die Integrationstests laden keine lokalen `.env`-Dateien und verwenden keine
externen Datenbank-/SMTP-Verbindungen. Ein produktiver Versandtest steht aus.
