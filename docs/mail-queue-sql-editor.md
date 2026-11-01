# Vollständige SQL-Reparatur der Mail-Warteschlange

## Datei und Ausführung

Die vollständige, eigenständig ausführbare Datei ist:

`supabase/migrations/20261103_complete_mail_queue_repair.sql`

Im Supabase SQL Editor des **von Vercel Production tatsächlich verwendeten
Projekts** als Datenbankadministrator (`postgres`) den gesamten Dateiinhalt in
einem Durchgang ausführen. Es ist nicht nötig, die alte Reparatur vom 02.11.
vorher auszuführen. Am Ende müssen die vier `*_ready`-Ergebnisse `true` sein.
`NOTIFY pgrst, 'reload schema'` wird mit dem erfolgreichen Commit ausgelöst.
Danach die Anwendung neu laden und zunächst nur „Empfänger prüfen“ verwenden.
Diese Vorschau versendet keine Mail.

Die ursprüngliche Systemmigration ist
`20260906_reliable_email_workflows.sql`. Die bisherige Reparatur
`20261102_repair_mail_campaign_queue.sql` deckt fehlende Tabellen ab, aber keine
teilweise vorhandenen Tabellendefinitionen. Die neue Datei ergänzt diesen Fall.

## Umfang und Erhalt bestehender Daten

Die Datei enthält eine Transaktion mit kurzen Lock-Wartezeiten. Sie führt kein
`DELETE`, `TRUNCATE`, `DROP TABLE` oder `UPDATE` auf Bestandsdaten aus, erzeugt
keine historischen Versandaufträge und ruft keinen Versand auf.

- **`mail_batches`:** `id`, `club_id`, `appointment_id`, `kind`, `created_at`.
- **`mail_deliveries`:** `id`, `event_key`, `club_id`, `appointment_id`,
  `participant_id`, `kind`, `recipient`, `payload`, `status`, `attempts`,
  `next_attempt_at`, `claimed_at`, `sent_at`, `error_code`, `created_at`.
- Eindeutige Schlüssel für Batch-ID, Auftrags-ID und `event_key` verhindern
  doppelte Vormerkung. Gleichwertige vorhandene eindeutige Indizes werden genutzt.
- Indizes unterstützen vereinsbezogenen Statusabruf, Termin-/Versandtypfilter
  und die Suche nach fälligen Aufträgen.
- Fehlende Fremdschlüssel und Prüfungen werden ergänzend eingerichtet. Neue
  Vereins-/Termin-/Teilnehmerzuordnungen werden durch Trigger geprüft.
- RLS ist auf beiden Warteschlangentabellen aktiv. `PUBLIC`, `anon` und
  `authenticated` erhalten weder Tabellen- noch Spaltenrechte. Nur die
  Serverrolle erhält die benötigten Schreib-/Leserechte. Die vorhandene API
  prüft zusätzlich die aktive Administratorberechtigung für den jeweiligen Verein.
- Enthaltene RPCs: `mail_appointment_open`, `create_mail_batch`,
  `claim_mail_delivery`. Direkte Ausführung durch Browserrollen bleibt gesperrt.
  Alle Empfänger-Payloads werden mit dem aktuellen Zieltermin verglichen;
  doppelte Empfänger innerhalb eines Auftrags werden zurückgewiesen.

Vorhandene Spaltenwerte einschließlich Versandstatus, Fehlerprotokoll, Payload
und Anzahl der Versuche bleiben unverändert. Fehlen technische Spalten, werden
sie ergänzt. **Fehlt die Statusspalte in einer befüllten Tabelle**, erhalten die
alten Zeilen `uncertain`; neue Aufträge erhalten anschließend standardmäßig
`pending`. So werden historische Zustellungen nicht versehentlich erneut gesendet.
Fehlende technische Zeitstempel erhalten den Zeitpunkt der Reparatur; sie sind
kein nachträglicher Nachweis des ursprünglichen Versandzeitpunkts.

Fehlende historische IDs, Vereinszuordnungen, Empfänger oder Payloads können nicht
verlässlich rekonstruiert werden. Bei solchen Lücken, inkompatiblen Spaltentypen
oder doppelten historischen Schlüsseln **bricht die gesamte Migration ab**.
Keine Datensätze werden gelöscht oder zusammengeführt. Eine solche Abweichung
muss anhand der Meldung gezielt geprüft werden. Nicht versuchen, sie durch
Zurücksetzen der Tabellen zu umgehen. Falls der Editor danach eine offene
abgebrochene Transaktion meldet, mit `ROLLBACK;` beenden.

Die bestehenden Tabellen `clubs`, `vaccination_dates`, `participants` und
`club_admin_memberships` einschließlich der von der Empfänger-/Adminprüfung
benötigten Spalten müssen vorhanden sein. Die Migration prüft diese Voraussetzung
und verändert deren Daten, Regeln oder Rechte nicht. Insbesondere wird ein
fehlender historischer Teilnahme-/Check-in-Status nicht geraten oder nachgetragen.

## Weitere Konfiguration

Die SQL-Reparatur behebt die Warteschlange für „Frühere Teilnehmer informieren“,
Terminänderungs-Rundschreiben und die vorhandene manuelle Status-/Fortsetzenfunktion.
Sie installiert nicht die zusätzlichen Teilnehmer-Trigger oder die Erinnerungs-
Cron-Funktion aus der ursprünglichen Systemmigration. Für automatische Erinnerungen
und Registrierungsnachrichten ist deren vollständiger Stand separat erforderlich.

In Vercel Production müssen weiterhin eingerichtet sein:

- `SUPABASE_URL` (alternativ `VITE_SUPABASE_URL`) und
  `SUPABASE_SERVICE_ROLE_KEY` desselben Projekts; der Service-Key bleibt serverseitig.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- Eine gültige öffentliche HTTPS-`APP_URL` oder die unterstützte Produktions-URL.
- Optional `MAIL_TEST_RECIPIENT` für bewusst ausgelöste echte Testmails; diese
  Funktion wurde bei der Reparatur nicht aufgerufen.
- `CRON_SECRET` sowie die ursprüngliche Cron-/Reminder-Einrichtung, falls automatische
  Verarbeitung gewünscht ist. Manuelles Fortsetzen funktioniert unabhängig davon.

Nach Änderungen an Vercel-Variablen die Anwendung neu bereitstellen. Die SQL-
Migration allein benötigt keine neue Bereitstellung, sofern der aktuelle reparierte
Anwendungscode bereits produktiv läuft. Die Anmeldung des Zieltermins muss für
Einladungen geöffnet sein. Bereits vorgemerkte Rundschreiben nicht neu anlegen;
stattdessen den vorhandenen Status prüfen. `uncertain` wird nicht automatisch
erneut zugestellt.

## Testnachweis und produktiver Status

Alle Prüfungen laufen gegen isoliertes PostgreSQL mit Musterdaten:

1. `node tests/mail-queue-repair.integration.mjs`: vorhandene Installation zweimal
   repariert; alle sechs Statuswerte, Protokolle, Termine und Teilnehmer erhalten;
   Teilinstallation ergänzt; unbekannter Altstatus nicht erneut zustellbar;
   widersprüchliche Typen/Schlüssel führen zum vollständigen Rollback;
   Fremdvereinszuordnungen und Browserzugriffe abgewiesen.
2. `node tests/mail-campaign.integration.mjs`: API-Empfängerprüfung, Auftrag,
   simuliertes SMTP, Statusanzeige, Deduplizierung und Vereinsgrenzen mit der neuen
   Migration geprüft. Keine echten E-Mails oder produktiven Datenbankverbindungen.
3. `npm test`: vorhandene Unit-Tests und Konfigurationstests.

Falls nötig vorher:
`npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite`.

Die Migration wurde **nicht in der produktiven Supabase-Datenbank ausgeführt**.
Hier besteht weiterhin kein direkter Datenbankzugriff. Der produktive Schema-
zustand und die Aktualisierung des echten PostgREST-Caches sind nicht bestätigt.
Die Datei muss deshalb vom Projektadministrator im richtigen SQL Editor ausgeführt
werden. Eine wiederholte Ausführung nach erfolgreicher Reparatur ist getestet.
