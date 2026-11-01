# Impftermine speichern: Prüfung und Bereitstellung

## Befund

Anlegen und Bearbeiten verwenden den angemeldeten Supabase-Browserclient direkt
über PostgREST. `/api/admin-vaccination-date` ist ausschließlich für Archivierung
und Wiederherstellung zuständig. Der bisherige Speicherfehler wurde vollständig
durch eine allgemeine Meldung ersetzt; ein produktiver Fehlercode liegt lokal
nicht vor. Die lokale Konfiguration enthält keine Supabase-Verbindungsdaten.
Eine abschließende Aussage zur produktiven Fehlerursache ist daher nicht möglich.

Die Formularfelder `time`, `registration_closes_at` und `registration_closed`
wurden mit `20260906_reliable_email_workflows.sql` eingeführt. Fehlen diese Spalten
oder ist der PostgREST-Schemacache veraltet, scheitert der Formularpayload.
Der PostgreSQL-Test reproduziert den Fehler fehlender Spalten und prüft die Reparatur.
Das ist ein nachgewiesener Fehlerpfad, kein Nachweis des produktiven Schemazustands.

Die vorhandene RLS erlaubt Schreibzugriffe über `can_manage_club(club_id)` und
enthält keine Bedingung zum Anmeldestatus. Die Sperre geschlossener Anmeldungen
betrifft Teilnehmeranlage und Teilnehmeränderungen, nicht die Terminverwaltung.
RLS, Grants und Archivschutz bleiben unverändert.

## Änderung

- Gemeinsamer Speicherweg mit expliziter Liste bearbeitbarer Felder; keine
  Rückübertragung von Archiv-, Bescheinigungs- oder anderen Serverfeldern.
- Titel, Datum, Uhrzeit, Anmeldeschluss und Vereinszuordnung werden geprüft.
  Datum und Uhrzeit bleiben lokale Kalenderwerte; der Anmeldeschluss wird als
  UTC-Zeitstempel gespeichert. 09.01.2027 23:00 MEZ entspricht 22:00 UTC.
- INSERT und UPDATE verlangen den zurückgelesenen Datensatz. Ein durch RLS
  unsichtbares UPDATE kann nicht mehr als erfolgreicher Schreibvorgang erscheinen.
- Verständliche Fehler für Schema, Berechtigungen, Pflichtfelder, Datumswerte,
  Archivschutz und Verbindungen; keine rohen SQL-Meldungen oder Datensatzwerte.
- Ladefehler werden angezeigt, statt die Terminliste stillschweigend zu leeren.
- Die additive Reparaturmigration ergänzt fehlende Formularspalten und lädt den
  PostgREST-Schemacache neu. Kein UPDATE/DELETE bestehender Daten und keine
  Änderung an Sicherheitsregeln.

## Bereitstellung

Zuerst `supabase/migrations/20261101_repair_vaccination_date_save_fields.sql`
in der Zielumgebung anwenden, dann die Anwendung bereitstellen.
Die Migration ist wiederholbar. Sie ersetzt nicht andere ausstehende Migrationen,
insbesondere nicht die vollständige Einrichtung der Mailfunktionen.
Diese Arbeiten wurden lokal vorbereitet; keine produktive Migration oder
Bereitstellung wurde ausgeführt.

Nach Bereitstellung mit einem berechtigten Vereinskonto einen gesonderten
Testtermin offen und geschlossen anlegen, jeweils bearbeiten und nach Neuladen
Datum, Uhrzeit, Anmeldeschluss und Adresse prüfen. Keine historischen Termine
oder Teilnehmer für die Prüfung verändern. Bei erneutem Fehler die neue
Fehlermeldung verwenden, um Schema- und Berechtigungsfehler zu unterscheiden.

## Verifikation

- `node --test tests/vaccination-date-save.test.js`: 4 Tests erfolgreich.
- `node tests/vaccination-date-database.integration.mjs`: isoliertes PostgreSQL;
  fehlende Spalten reproduziert, Migration zweimal angewandt, offene/geschlossene
  Termine angelegt, bearbeitet und zurückgelesen; fremder Verein, fehlende
  Mitgliedschaft und anonyme Schreibzugriffe abgewiesen; Archivschutz erhalten;
  historische Terminwerte und Teilnehmer-Testdaten unverändert.
  Vorbereitung: `npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite`.
- `npm run build`: erfolgreich.
- `npm test`: 21 von 22 erfolgreich. Der bestehende Mail-Test erwartet
  `MAIL_TEST_RECIPIENT`, während `server/mail-test.js` bereits `SMTP_USER` nutzt.
  Dieser unabhängige Fehler wurde nicht verändert.

Ein Browser-/Produktionstest gegen Supabase wurde mangels Verbindung und
angemeldeter Adminsitzung nicht durchgeführt. Die Tests bestätigen die lokale
Reparatur, nicht die erfolgreiche Bereitstellung in der Zielumgebung.
