# Mitgliederverwaltung – Bereitstellung und Bedienung

Die neue Mitgliederverwaltung ist ein eigenständiges Verzeichnis. Mitgliedercode,
Anmeldeformular, Tarifberechnung und Teilnehmer-/Impfdaten werden nicht geändert.
Es findet **keine automatische Mitgliedererkennung oder Tarifzuordnung** statt.
Es werden keine Daten aus Teilnehmerlisten übernommen und keine E-Mails versendet.

## Bereitstellung

1. Im tatsächlich von der Anwendung verwendeten Supabase-Projekt die vollständige
   Datei `supabase/migrations/20261104_add_club_members.sql` im SQL Editor als
   Datenbankadministrator ausführen. Sie setzt `clubs`, `club_admin_memberships`
   und Supabase Auth voraus. Eine zusätzliche Mail-Migration ist nicht erforderlich.
2. Den Anwendungscode bereitstellen. Es werden keine neuen Umgebungsvariablen
   benötigt; verwendet werden die vorhandenen öffentlichen Supabase-Verbindungswerte
   und die bestehende angemeldete Adminsitzung.
3. Mit einem aktiven Vereinsadmin oder Superadmin anmelden und im Admin-Menü
   „Mitgliederverwaltung“ öffnen.

Die Migration wurde lokal gegen PostgreSQL getestet, **nicht produktiv ausgeführt**.
Hier ist weiterhin kein produktiver Supabase-Datenbankzugriff vorhanden.
Die neue Migration ist wiederholbar und ändert bei erneuter Ausführung keine
Mitgliederdaten. Sie löscht keine Tabellen oder Datensätze. Im SQL enthaltene
`DROP POLICY`/`DROP TRIGGER` betreffen ausschließlich die eigenen Regeln der
neuen Tabelle und werden in derselben Transaktion neu eingerichtet.

## Bedienung

- „Mitglied hinzufügen“: Vorname, Nachname und gültige E-Mail-Adresse sind Pflicht.
  Mitgliedsnummer und Bemerkungen sind optional. Neue Einträge sind zunächst aktiv.
- „Bearbeiten“: Stammdaten und Bemerkungen ändern. Gleichzeitige Änderungen werden
  anhand des Änderungszeitpunkts erkannt; bei Konflikt Liste aktualisieren.
- „Deaktivieren“ und „Reaktivieren“ ändern ausschließlich den Mitgliedschaftsstatus.
  Der Datensatz bleibt erhalten. Eine Löschfunktion ist bewusst nicht vorhanden.
- Suche nach Namen oder E-Mail; aktive und inaktive Mitglieder werden berücksichtigt.
  Die Liste ist serverseitig auf Seiten von jeweils 50 Einträgen aufgeteilt.
- E-Mail-Adressen sind nach Normalisierung innerhalb eines Vereins eindeutig.
  Optionale Mitgliedsnummern sind ebenfalls pro Verein eindeutig (Groß-/Kleinschreibung
  wird ignoriert). Ein inaktives Mitglied blockiert dieselben Dubletten weiterhin;
  bei Wiedereintritt den vorhandenen Eintrag reaktivieren. Mitglieder mit gemeinsamer
  E-Mail-Adresse benötigen für getrennte Einträge unterschiedliche Adressen.

## CSV-Import

Die Oberfläche bietet eine herunterladbare CSV-Vorlage. Unterstützt werden UTF-8
mit/ohne BOM sowie Windows-1252, Semikolon, Komma oder Tabulator als Trennzeichen,
Anführungszeichen und mehrzeilige Bemerkungen. Beispiel:

```csv
Vorname;Nachname;E-Mail;Mitgliedsnummer;Aktiv;Bemerkungen
Max;Mustermann;max@example.invalid;001;aktiv;Mustereintrag
Erika;Mustermann;erika@example.invalid;;inaktiv;
```

Vorname, Nachname und E-Mail sind notwendige Kopfspalten. Die restlichen Spalten
sind optional. Englische Feldnamen werden ebenfalls akzeptiert. Ohne Aktiv-Spalte
oder bei leerem Status wird `aktiv` angenommen. Akzeptierte Statuswerte sind
`aktiv/inaktiv`, `active/inactive`, `ja/nein`, `true/false` und `1/0`.

Maximal 1 MB und 500 Datensätze pro Datei. Die Vorschau zeigt die ersten zehn
gültigen Einträge. Ungültige Datensätze sperren den gesamten Import, bis die Datei
korrigiert ist. Dubletten innerhalb der Datei werden gezählt und übersprungen.
Nach ausdrücklichem Klick auf „Einträge importieren“ prüft die Datenbank zusätzlich
gegen bestehende Einträge. Auch bei wiederholtem Import bleiben Bestandsdaten
unverändert. Insbesondere werden inaktive Mitgliedschaften niemals durch einen
Import automatisch reaktiviert. Ein Import erfolgt atomar in einer Transaktion.

## Sicherheit und Datentrennung

`club_members` speichert ausschließlich das Mitgliederverzeichnis mit UUID,
Vereinszuordnung, Stammdaten, Status und Erstellungs-/Änderungszeitpunkt. Separate
RLS-Regeln gewähren nur aktiven `clubadmin`-Mitgliedschaften des betreffenden Vereins
und aktiven `superadmin`-Mitgliedschaften Zugriff. `checkin_admin`, inaktive
Administratoren, fremde Vereinsadmins und anonyme Clients erhalten keinen Zugriff.

Der Browser darf nur vorgesehene Stammdatenfelder anlegen/ändern, keine IDs,
Vereinszuordnungen bestehender Einträge oder Zeitstempel umschreiben und keine
Mitglieder löschen. Der CSV-RPC verwendet dieselben RLS-Regeln (`SECURITY INVOKER`).
Bestehende Rollen, RLS-Regeln und Funktionen für Impfanmeldungen bleiben unverändert.
Die Tabellennutzung ist ausschließlich im neuen Admin-Modul implementiert.

## Prüfung

- `npm test`: 28 Tests erfolgreich, einschließlich CSV-Parser, Eingabeprüfung und
  Erkennung konfliktbehafteter Bearbeitungen; vorhandene Tests bleiben erfolgreich.
- `node tests/club-members.integration.mjs`: isoliertes PostgreSQL, Migration
  zweimal und erneut mit vorhandenen Mitgliedern angewandt; Anlegen, Bearbeiten,
  Aktivierung/Deaktivierung, Suche, CSV und wiederholter Import, eindeutige Schlüssel,
  atomarer Rollback sowie sämtliche Rollen-/Vereinsgrenzen geprüft.
  Mitgliedercodes, Tarife, Teilnehmer und Impftermine vor/nach dem Test verglichen.
- Browserprüfung über `tests/fixtures/club-members-ui.html` mit injiziertem lokalen
  Testclient: Mitglied anlegen, bearbeiten, deaktivieren, reaktivieren, E-Mail-Suche,
  CSV-Vorschau und zwei Imports durchgeführt. Zweiter Import: null neue Einträge,
  zwei Dubletten. Keine externe Supabase-Verbindung und keine produktiven Daten.
- `npm run build`: erfolgreich. Bestehender Hinweis auf große Build-Chunks.

Für den PostgreSQL-Test ggf. vorher
`npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite`.
Die Browserprüfung ergänzt die separat ausgeführte echte PostgreSQL-/RLS-Prüfung;
sie ist kein Test der produktiven Supabase-Instanz.
