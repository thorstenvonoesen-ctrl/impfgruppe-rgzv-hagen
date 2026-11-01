# Mitgliederprüfung: Anfragebegrenzung

## Befund

Der bisherige Code reservierte einen Datenbanksatz **vor** dem SMTP-Aufruf und
zählte anschließend sämtliche Reservierungen: 60 Sekunden Abstand, drei pro Adresse
und Stunde sowie 200 pro Verein und Stunde. Auch eine SMTP-Ablehnung blieb angerechnet.
Dadurch konnten drei technische Fehler eine Adresse für bis zu einer Stunde blockieren.
200 Reservierungen konnten alle weiteren Adressen desselben Vereins blockieren.
IP-Adressen wurden nicht verwendet. Preisabfragen/Codeprüfung verbrauchen kein Sendelimit.
Dieser Ablauf ist mit realem isoliertem PostgreSQL und simuliertem SMTP reproduziert.
Welche Zähler produktiv erreicht wurden, ist ohne produktiven Datenbank-/Logzugriff
nicht nachgewiesen.

## Korrektur

Nur neue Bestätigungscode-Aufträge erhalten einen Versandstatus. Keine Mitgliederdaten,
Tarife oder Anmeldungen werden geändert. Reservierung und Abschluss werden serverseitig
über gesicherte Funktionen ausgeführt; parallele Anfragen können kein Limit umgehen.

* Eindeutige SMTP-Fehler zählen nicht gegen die 60-Sekunden-/Drei-E-Mails-Grenze.
  Ein direkter erneuter Versuch ist möglich.
* Gegen technische Wiederholungsschleifen gelten separat sechs Versuche pro Adresse
  und Verein in zehn Minuten. Eine Datenbankablehnung vor Reservierung zählt nicht.
* Erfolgreiche, laufende und unklare SMTP-Versuche zählen weiter gegen den bisherigen
  Schutz je normalisierter E-Mail-Adresse/Verein: 60 Sekunden und drei pro Stunde,
  auch über verschiedene Impftermine hinweg. Groß-/Kleinschreibung umgeht das nicht.
* Die gemeinsame Grenze 200/Stunde entfällt. Als Notfallbremse gelten 1.000 tatsächliche
  Reservierungen pro Verein/Stunde, einschließlich technischer Fehlversuche. Erst
  diese Grenze kann andere Adressen desselben Vereins vorübergehend betreffen. Sie
  begrenzt massenhaftes Anfordern an wechselnde Adressen; andere Vereine bleiben frei.
* HTTP 429 liefert `retryAfter` sowie den Header `Retry-After`. Das Formular zeigt
  einen Countdown, sperrt nur das erneute Anfordern und erlaubt die Codeeingabe weiter.
* Die achtstelligen Codes, zehn Minuten Gültigkeit, fünf Fehlversuche und einmalige
  Verwendbarkeit bleiben erhalten. Codes definitiv fehlgeschlagener Sendungen sind ungültig.
* Normale Anmeldung und gültiger Mitgliedercode bleiben unabhängig verfügbar.

SMTP-Ergebnisse ohne eindeutigen Nachweis werden als `uncertain` behandelt, nicht als
Fehlschlag freigegeben. Scheitert das Protokollieren des SMTP-Ergebnisses, bleibt die
Reservierung konservativ `pending`; Serverlogs enthalten nur einen sicheren Fehlercode.
Bereits existierende Reservierungen haben `send_state=NULL`, bleiben gültig und zählen
weiter, da sich ihr historischer SMTP-Erfolg nicht sicher rekonstruieren lässt. Es gibt
keinen pauschalen Reset. Diese alten Grenzen laufen innerhalb einer Stunde aus.

## Supabase und Vercel

Bei vorhandener vollständiger Registrierungseinrichtung zuerst
`supabase/migrations/20261109_membership_rate_limit_repair.sql` im richtigen Supabase-
Projekt als Administrator ausführen. Die Migration ist wiederholt ausführbar und lädt
den PostgREST-Schemacache neu. Danach den aktuellen Code auf Vercel bereitstellen.
Keine neuen Umgebungsvariablen erforderlich; bestehende Supabase-/SMTP-Konfiguration
muss funktionieren. SMTP-Zugangsdaten nicht in Logs oder im Chat ausgeben.

Für noch unvollständige Installationen enthält auch das aktualisierte Gesamtpaket
`supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql` diese Migration **zuletzt**, nach
Migration 06 und 08. Keine älteren Funktionsdefinitionen anschließend darüber installieren.
Die [vollständige Bereitstellungsanleitung](COMPLETE_REGISTRATION_REPAIR.md) gilt weiterhin.

Die produktive Migration und Bereitstellung sind durch diese lokalen Änderungen
**nicht** erfolgt. Ohne berechtigten Supabase-/Vercel-Zugriff bleibt dieser Schritt offen.

Private, lesende Prüfung im SQL Editor, ohne Adressen/Codes auszugeben:

```sql
select to_regprocedure('public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text)'),
       to_regprocedure('public.finish_membership_challenge(uuid,uuid,text)');

select send_state,count(*) from public.membership_email_challenges
where club_id='<VEREINS-UUID>'::uuid and created_at>now()-interval '1 hour'
group by send_state;
```

## Tests ohne reale E-Mails

```powershell
node tests/membership-rate-limit.integration.mjs
node tests/membership-tariff.integration.mjs
node tests/registration-confirmation.integration.mjs
npm test
npm run build
```

Die Tests verwenden die vorhandene isolierte PGlite-Testinstallation (Einrichtung
siehe Gesamtanleitung) und injiziertes Fake-SMTP. Sie prüfen technische Fehler und
erneuten Erfolg, unklare Übergabe, Verifizierung/Wiederholung, Wartezeiten, gleiche IP,
andere Adressen/Vereine, parallele Anfragen, Stunden-/Notfallgrenzen, Berechtigungen,
Migration zweimal sowie weiterhin funktionierende Gast-/Code-Anmeldung.
