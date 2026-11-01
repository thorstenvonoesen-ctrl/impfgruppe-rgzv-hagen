# Produktiven Bestätigungsversand eindeutig prüfen

## Aktueller Zugriffsbefund

In dieser Prüfung wurden ausschließlich Lesezugriffe versucht. Für das lokal
verknüpfte Vercel-Projekt ergab sich:

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Production-Deployments auflisten | 403, keine Berechtigung |
| Umgebungsvariablen, ohne Entschlüsselung | 404, Projekt nicht gefunden |
| Production-Funktionslogs | 403, Zugriff verweigert |
| Projektsuche „impf“ im verknüpften Team | keine zugänglichen Treffer |
| Lokale Zugangsdaten | keine Supabase-/Datenbank-/SMTP-Werte; nur Vercel-OIDC |

Damit sind Deployment, produktives Schema, Auftragsstatus, SMTP-Anmeldung und
tatsächliche Zustellung **nicht verifiziert**. Ein 404 beweist nicht, dass das
Produktionsprojekt fehlt; es kann auch an Konto-/Teamzugriff oder einer veralteten
lokalen Projektzuordnung liegen. Es wurden keine Anwendungsänderungen, Migrationen,
Anmeldungen, Versandaufträge oder echten E-Mails ausgelöst.

## 1. Tatsächlich verwendetes Projekt und Deployment bestimmen

1. Die vom Teilnehmer verwendete Produktionsadresse im Vercel-Dashboard dem
   zugehörigen Projekt zuordnen. Projektname allein genügt nicht.
2. Die **aktuell mit dieser Domain verknüpfte Production-Bereitstellung** öffnen.
   Eine neuere Preview oder eine erfolgreiche Buildanzeige ist kein Nachweis,
   dass der neue Code die Domain bedient.
3. Git-Commit/Quellstand prüfen. Der lokal vorliegende Commit
   `591a10d7bb5397516a2ec703a44db4e18679fdb8` („Bestätigung“) enthält bereits den
   neuen Registrierungsweg. Ein identischer Commit oder ein nachweislich darauf
   aufbauender unveränderter Stand muss produktiv laufen. Bei einem späteren
   Commit den tatsächlichen Code prüfen, nicht nur dessen Datum.
4. `api/create-registration.js` muss `saveRegistrationWithConfirmation` verwenden;
   `server/registration-confirmation.js` muss den RPC `register_with_confirmation`
   aufrufen. Ein direktes Teilnehmer-INSERT mit anschließendem `drainMail` ist
   der ältere Weg.
5. Prüfen, ob `SUPABASE_URL`/`VITE_SUPABASE_URL` in dieser Bereitstellung auf das
   Supabase-Projekt des SQL Editors verweisen. Frontend und Server dürfen nicht
   unterschiedliche Supabase-Projekte verwenden. Variablenänderungen nach dem
   Deployment ändern dessen bereits laufende Konfiguration nicht automatisch.

Für die bestehende Anmeldung keine neue Registrierung erzeugen. Falls die
ursprüngliche Netzwerkantwort noch vorhanden ist: das zusätzliche Feld
`emailStatus` weist auf den neuen Handler hin; dessen Fehlen ist allein noch kein
sicherer Versionsnachweis. Keine Aufträge durch POST-Probeanfragen erzeugen.

## 2. Produktives Schema prüfen – ausschließlich lesend

Im **richtigen Supabase-Projekt** zuerst vollständig ausführen:

`supabase/diagnostics/production_confirmation_readiness.sql`

Die Abfragen funktionieren auch bei fehlenden Versandtabellen/Funktionen. Sie
lesen nur Kataloginformationen. Erwartet:

- `queue_exists`, `retry_audit_exists`, `claim_exists`: `true`.
- Alle fünf `exists` und `matches_supplied_migration`: `true`. Der zweite Wert
  vergleicht den normalisierten Funktionskörper mit der gelieferten Migration
  `20261105_registration_confirmation_outbox.sql`.
- `server_can_execute`: `true` für die RPCs. Die beiden Triggerfunktionen werden
  vom Trigger ausgeführt; ein fehlendes direktes EXECUTE-Recht der Serverrolle
  ist bei diesen beiden Funktionen normal. Browserrollen sollen für alle fünf
  Funktionen `false` anzeigen.
- `participants_queue_registration_mail` und `participants_guard_cash_registration`
  vorhanden, mit `tgenabled=O` oder `A`. `D` bedeutet deaktiviert, `R` nur Replikationsmodus.
- `server_can_select`/`server_can_update` für die Versandwarteschlange: `true`.

Das zeigt den **vorhandenen Zustand**, nicht einen historischen Ausführungsbeleg.
Eine manuell im SQL Editor ausgeführte Migration muss nicht in
`supabase_migrations.schema_migrations` eingetragen sein. Ein dort fehlender
Eintrag allein beweist daher keine fehlende Migration.

Falls Tabellen/Funktionen fehlen oder Funktionskörper abweichen: die konkrete
Abweichung festhalten und erst dann die zugehörige bereits vorbereitete Migration
anwenden. Diese Diagnose lädt keinen Schemacache und ändert keine Daten. Falls
SQL-Objekte stimmen, die Admin-API jedoch `PGRST202`/`PGRST205` meldet, zuerst
Projektzuordnung und PostgREST-Cache prüfen.

## 3. Den tatsächlichen Auftrag der betroffenen Anmeldung prüfen

Nur wenn die benötigten Tabellen und Teilnehmer-/QR-Spalten vorhanden sind:

`supabase/diagnostics/production_confirmation_case.sql`

1. Den ersten SELECT ausführen. Er liefert Verein und Termine am 10.01.2027.
   Den tatsächlichen Termin „ND Impfung Winter“ auswählen.
2. Im zweiten SELECT **drei Werte** ersetzen: Vereins-UUID, Termin-UUID und die
   tatsächlich bei der Anmeldung gespeicherte E-Mail-Adresse. Diese Eingaben
   bleiben lokal im eigenen SQL Editor; die Ausgabe enthält keine Adresse und
   keinen QR-Token.
3. Den zweiten SELECT ausführen. Alle zurückgegebenen Anmeldungen prüfen. Keine
   Treffer bedeutet zunächst falsches Projekt/Termin/Adresse oder keine passende
   Anmeldung; nicht automatisch einen fehlenden E-Mail-Auftrag.

| Ergebnis | Feststellung | Nächster Schritt |
| --- | --- | --- |
| Teilnehmer vorhanden, `delivery_id` leer | Für genau diese Anmeldung kein Standard-Bestätigungsauftrag | Code-/Triggerstand zum Anmeldezeitpunkt prüfen; nach bestätigter Einrichtung gezielt „Bestätigung nachholen“, keine neue Anmeldung |
| `pending`, keine `claimed_at` | Noch kein protokollierter Claim | Worker-/Cron-Anfragen und deren Status prüfen; `next_attempt_at` berücksichtigen |
| `sending`, `claimed_at` gesetzt | Ein Worker hat den Auftrag beansprucht | Noch kein Nachweis einer SMTP-Verbindung; zugehörigen Funktionslauf untersuchen |
| `failed` | Eindeutiger Fehler dokumentiert | `error_code` und Funktionslog auswerten; Ursache beheben, dann genau einen gezielten Retry |
| `uncertain` | Zustellung möglicherweise bereits erfolgt | Kein automatischer/manueller Neuversand; zuerst SMTP-Protokoll bzw. Providerklärung |
| `sent` und `sent_at` | Anwendung hat SMTP-Annahme protokolliert | Zustellung bei Empfänger/STRATO prüfen; nicht erneut senden |
| `skipped` | Auftrag bewusst übersprungen | Anmeldestatus, Archivstatus und Adressänderungen prüfen |

Alle drei `job_*_matches` müssen bei vorhandenem Auftrag `true` sein. Abweichungen
nicht durch Neuanlage oder Status-UPDATE übergehen. Mehrere Anmeldungen/Jobs
ebenfalls zuerst klären. `attempts` zählt den aktuellen Versuchszyklus; frühere
manuelle Zyklen werden separat in `mail_delivery_retries` protokolliert.

## 4. Vercel-Funktionslogs und tatsächlichen Start prüfen

In der unter Schritt 1 verifizierten Production-Bereitstellung die Logs auf den
**Zeitpunkt der Anmeldung** begrenzen. SQL-Zeitstempel/Zeitzonen beachten.
Anschließend nach `participant_id` bzw. `delivery_id` aus der gezielten Abfrage
sowie diesen Kennungen suchen:

- Pfad `/api/create-registration`: HTTP-Status, Timeout/Abbruch, `REGISTRATION_FAILED`
  oder `REGISTRATION_MAIL_PENDING`.
- `MAIL_DELIVERY`: `id`, `status`, `code`, `markerSaved` für genau den Auftrag.
- Pfad `/api/send-reminder-emails`: tatsächliche Funktionsaufrufe, 401/403,
  `MAIL_REQUEST_FAILED` oder `REMINDER_QUEUE_FAILED`.

`claimed_at` zeigt nur einen Datenbank-Claim; er beweist keinen SMTP-Start.
`REGISTRATION_MAIL_PENDING` kann einen Datenbankfehler vor SMTP bedeuten. Ein
fehlender Logeintrag bei begrenzter Aufbewahrung ist kein Beweis, dass der Lauf
nie stattgefunden hat. Der vorhandene Code protokolliert bei Erfolg nicht die
SMTP-Message-ID; diese lässt sich nachträglich nicht aus dieser Tabelle ablesen.

Den Cronstatus im selben Projekt prüfen. Der im Repository vorhandene Zeitplan
ist täglich `0 9 * * *` (09:00 UTC); er ist kein Versand alle 15 Minuten.
`next_attempt_at` macht eine Nachricht nur fällig – es startet keinen Worker.
`CRON_SECRET` muss in der tatsächlich bedienten Bereitstellung verfügbar sein.
Zum Diagnostizieren nicht blind den Cron-Endpunkt aufrufen: Er kann viele offene
Nachrichten versenden. Bei einem bestätigten `failed` den einzelnen Auftrag über
„Erneut versuchen“ wählen, nachdem dessen konkrete Ursache behoben wurde.

## 5. STRATO-Konfiguration ohne Offenlegen von Zugangsdaten

In den Production-Variablen der tatsächlich bedienten Bereitstellung prüfen:

| Variable | Erwartung |
| --- | --- |
| `SMTP_HOST` | `smtp.strato.de` |
| `SMTP_PORT` | `465` für STRATO-Postfächer, SSL/TLS |
| `SMTP_USER` | vollständige, vorhandene Postfachadresse |
| `SMTP_PASS` | vorhanden; zum Postfach gehörendes Passwort, nicht Kundenlogin |
| `APP_URL` oder unterstützte Produktions-URL | gültige öffentliche HTTPS-Adresse für Verwaltungslinks |
| Supabase-URL und Service-Key | dasselbe Projekt wie der SQL Editor, Schlüssel nur serverseitig |
| `CRON_SECRET` | vorhanden, wenn automatische Worker-Aufrufe verwendet werden |

Passwörter/Service-Keys nicht anzeigen, kopieren oder in diesem Chat mitteilen.
Ein angelegter Variablenname oder Secret-Eintrag bestätigt noch nicht, dass sein
Wert korrekt ist. Nach einer **nachgewiesenen** Korrektur neu bereitstellen.

STRATO-Quelle: https://www.strato.de/faq/mail/e-mailserver-adressen-ports-ssl-tls/

Typische Codes: `SMTP_CONFIG` = fehlende/ungültige Werte; `EAUTH` = Anmeldung
abgelehnt; `EDNS` = Namensauflösung; `ECONNECTION`/`ESOCKET` = Verbindung/TLS;
`ETIMEDOUT` = Zeitlimit. Letzteres kann nach SMTP-DATA unklar sein: Der gespeicherte
Status entscheidet über die Wiederholbarkeit, nicht allein der Fehlercode.

## 6. Tatsächliche Zustellung belegen

Nach genau einem zulässigen erneuten Versuch den identischen `delivery_id` erneut
lesen. `sent`/`sent_at` und gegebenenfalls SMTP-Protokoll festhalten. Dann muss der
**betroffene Empfänger** den Eingang einschließlich Spamordner prüfen. Falls SMTP
angenommen hat, aber nichts eintrifft: STRATO-/Empfängerprovider anhand der genauen
Zeit und Adressen um Klärung von Ablehnung, Quarantäne oder Bounce bitten; eventuelle
Rückläufer im Absenderpostfach prüfen. Ohne Empfangs- oder Providerbeleg bleibt
das Ziel „tatsächlich zugestellt“ offen. Nicht durch wiederholtes Senden ersetzen.

Für die weitere Diagnose reichen hier: Ergebnisse der fünf Funktionsprüfungen,
Auftragsstatus, `attempts`, Zeitstempel, `error_code`, `job_*_matches`, Deployment-
Commit und der bereinigte passende Logauszug. Keine E-Mail-Adresse, QR-Tokens,
Authorization-Header oder Passwörter übermitteln.
