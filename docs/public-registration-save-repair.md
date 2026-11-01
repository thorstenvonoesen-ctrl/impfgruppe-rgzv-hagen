# Öffentliche Anmeldung: Speicherkorrektur und Diagnose

## Zugriff und belegte Ursache

Die produktive Vercel-Logabfrage wurde erneut mit `403 Forbidden` abgewiesen;
die Variablenabfrage mit `404 Project not found`. Hier gibt es keinen direkten
Supabase-Datenbankzugang. Deshalb ist nicht bestätigt, welche Migrationen und
Variablen produktiv vorliegen oder welcher konkrete Fehler dort auftrat.

Ein konkreter Fehlerpfad wurde vor der Änderung mit exakt der gemeldeten Antwort
reproduziert: Sind öffentliche App-Adresse und ihre Fallbacks nicht gesetzt,
antwortet der Registrierungsendpunkt mit HTTP 500 und
„Anmeldung konnte nicht gespeichert werden.“; es erfolgt **kein Schreibversuch**.
Auch eine ungültige vorrangige `APP_URL` blockierte die Anmeldung.

Ursache ist der vorgezogene Aufruf von `publicBaseUrl()` vor der Transaktion.
Diese URL wird erst zum Erstellen der E-Mail-Verwaltungslinks benötigt. Die neue
Outbox-Speicherung war dadurch unnötig von einer reinen Versandkonfiguration
abhängig. Das ist ein nachgewiesener Codefehler, **kein Nachweis der produktiven
Konfiguration**. Weitere mögliche produktive Schema-/Triggerfehler werden nicht
als bestätigt ausgegeben und nicht durch pauschale Migrationen überschrieben.

## Änderung

- Die öffentliche Mail-Link-Adresse wird erst beim Erstellen der Nachricht nach
  dem Commit geprüft. Anmeldung und Bestätigungsauftrag bleiben atomar gespeichert.
- Fehlt die URL oder ist sie ungültig, scheitert nur der Versandversuch vor SMTP,
  mit dem konkreten gespeicherten Code `APP_URL_CONFIG`. Nach Konfigurationskorrektur
  ist derselbe Auftrag über die vorhandene Admin-Retry-Funktion erneut zustellbar.
- Wiederholte Anmeldeversuche erzeugen weiterhin keine zweite aktive Anmeldung.
  Der Datenbank-Dublettenschutz und der eindeutige Bestätigungsauftrag bleiben erhalten.
- Schemafehler, fehlende RPCs, Berechtigungsfehler, Pflichtfelder, Trigger-/QR-Probleme,
  Datenbankregeln und gleichzeitige Verarbeitung erhalten verständliche Meldungen.
- Unerwartete Fehlerantworten tragen eine Referenz, die auch im Serverlog steht.
  Gespeichert werden Phase, Fehlercode, bekannte Ursache und ggf. bereinigter
  Spalten-/Constraintname, keine Datensatzwerte, Rohfehler oder E-Mail-Adressen.
- Erfolgreiche Speicherung erscheint als `REGISTRATION_SAVED` mit Referenz,
  Teilnehmer-ID und Versandstatus. SMTP-Annahme wird nicht mit Posteingang verwechselt.

Löschfunktion einschließlich ihrer SQL-Migration, Mitgliederverwaltung,
Mitgliedercodeentscheidung und Tarifberechnung wurden nicht geändert.
Es wurden keine produktiven Daten gelöscht oder verändert.

## Produktive Prüfung

1. **Richtiges Projekt und Deployment:** prüfen, ob die benutzte Domain den neuen
   Vercel-Code bedient und Frontend/Server dasselbe Supabase-Projekt verwenden.
2. **Lesende Schemaabfrage:**
   `supabase/diagnostics/public_registration_save.sql` im richtigen SQL Editor
   ausführen. Sie ruft keinen schreibenden RPC auf und versendet nichts.
   Erwartet werden insbesondere `register_with_tariff_confirmation(jsonb)` mit
   Parametername `registration`, Rückgabetyp `jsonb`, Server-Ausführungsrecht sowie
   die benötigten Teilnehmer-/Outbox-/Tarifspalten.
3. **Bei fehlenden Objekten:** gezielt die bereits vorhandene Migration bestimmen:
   - `20261103_complete_mail_queue_repair.sql`: Versandtabellen und Basis-RPCs.
   - `20261105_registration_confirmation_outbox.sql`: Registrierung/Bestätigungs-
     trigger und ursprünglicher Outbox-RPC.
   - `20261106_verified_member_tariffs.sql`: der aktuell verwendete Speicher-RPC
     und seine Tarifmetadaten; bestehende Voraussetzungen beachten.
   Die funktionierende Löschmigration `20261107_safe_participant_delete.sql`
   benötigt für diese Reparatur keinerlei Änderung.
4. **Logs:** bei erneutem Fehler die Referenz aus der Meldung im richtigen
   Production-Deployment nach `REGISTRATION_FAILED` suchen. Phase und SQL-/API-Code
   bestimmen den Fehlerort. Beispiel:
   `stage=REGISTRATION_COMMIT, code=42703, column=tariff_source` weist auf eine
   unvollständige RPC-/Tabellenbereitstellung hin; `42883` plus
   `CHECKIN_GENERATOR_MISSING` auf die QR-Grundlage. Diese Fälle werden nicht
   durch Umschalten auf einen älteren Speicherweg oder stilles Abschalten der
   E-Mail-Aufträge umgangen.
5. **Nach erfolgreicher Speicherung:** `REGISTRATION_SAVED` und den vorhandenen
   Versandstatus prüfen. Bei `APP_URL_CONFIG` eine gültige öffentliche HTTPS-
   `APP_URL` oder unterstützte Produktions-URL in Vercel hinterlegen, neu
   bereitstellen und den fehlgeschlagenen Auftrag gezielt erneut versuchen.
   Nicht die Registrierung nochmals anlegen. Bei `sent`/`uncertain` nicht blind senden.

Phasen: `SERVER_CONFIG`, `APPOINTMENT_LOOKUP`, `DUPLICATE_LOOKUP`, `TARIFF_LOOKUP`,
`REGISTRATION_COMMIT`. Fehlende `PGRST202`-Funktionen oder `PGRST204`-Spalten können
auch auf ein anderes Supabase-Projekt bzw. einen veralteten PostgREST-Cache hinweisen.
Bei vollständig vorhandenen SQL-Objekten zuerst diese Zuordnung prüfen.

## Bereitstellung und Tests

**Für die hier belegte APP-URL-Korrektur ist keine neue Supabase-Migration nötig.**
Der neue Anwendungscode muss auf Vercel bereitgestellt werden. Bereits erforderliche
Speicher-Migrationen müssen produktiv vorhanden sein; ihr Vorhandensein konnte hier
nicht bestätigt werden. Es wurde keine Migration produktiv ausgeführt.

- `npm test`: 35 Tests erfolgreich, einschließlich Fehlerklassifizierung ohne
  Rohdaten-/Zugangsdatenweitergabe.
- `node tests/registration-confirmation.integration.mjs`: echte isolierte PostgreSQL-
  Outbox und API mit Fake-SMTP. Fehlende App-URL führt zu HTTP 201 und genau einer
  Anmeldung plus fehlgeschlagenem Auftrag; kein SMTP-Aufruf. Nach URL-Reparatur
  gelingt der gezielte Retry. Fehlende RPCs/Spalten werden erkannt, Schreibfehler
  vollständig zurückgerollt und doppelte Anfragen zurückgewiesen.
- Tarif- und Löschintegration werden unverändert als Regression geprüft.
- `npm run build`: erfolgreich.

Keine echten E-Mails während der Tests und keine Löschtests an produktiven Daten.
Produktive Speicherung oder Zustellung werden erst nach erfolgreicher Bereitstellung
und Prüfung der realen Fehlermeldung als bestätigt betrachtet.
