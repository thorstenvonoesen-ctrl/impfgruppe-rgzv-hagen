# Bestätigung nach Anmeldung: Befund und Bereitstellung

> Historischer Reparaturstand. Für die aktuelle Bereitstellung ausschließlich die
> [vollständige Reparaturlösung](COMPLETE_REGISTRATION_REPAIR.md) verwenden.

## Nachgewiesener Fehlerpfad

Der bisherige Registrierungsendpunkt speicherte den Teilnehmer direkt und rief
danach `drainMail` auf. Dieser Worker verschickt nur **vorhandene** Versandaufträge;
er erzeugt keine. Das Anlegen eines Auftrags erfolgte ausschließlich durch den
AFTER-INSERT-Trigger `participants_queue_registration_mail` aus
`20260906_reliable_email_workflows.sql`.

Die späteren Tabellen-/Rundversandreparaturen vom 02.11. und 03.11. richten diesen
Trigger ausdrücklich nicht ein. Eine Installation mit diesen Reparaturen, aber
ohne die ursprüngliche vollständige Mailmigration, kann daher Teilnehmer speichern,
ohne eine Bestätigung vorzumerken. Das erklärt das gemeldete Verhalten und wurde
in isoliertem PostgreSQL reproduziert. Ein weiterer nachgewiesener Fehler:
Fehlt `queue_due_reminders`, brach der Cron vor dem Abarbeiten bereits vorhandener
Bestätigungen ab.

**Der konkrete produktive Datensatz konnte nicht geprüft werden.** Die Vercel-
Verbindung verweigert den Zugriff auf das lokal verknüpfte Projekt: Variablenabfrage
`404 Project not found`, Runtime-Logs `403 Forbidden`. Lokal fehlen Supabase- und
SMTP-Zugangsdaten. Weder produktive Fehlercodes noch Posteingang/Spamordner sind
geprüft; ein tatsächlicher STRATO-Anmeldefehler ist nicht nachgewiesen.

## Implementierte Reparatur

- Der Registrierungsendpunkt verwendet den ausschließlich serverseitig aufrufbaren
  RPC `register_with_confirmation`. Teilnehmer und eindeutiger Bestätigungsauftrag
  werden in **einer Transaktion** gespeichert. Scheitert das Vormerken, wird auch
  der neue Teilnehmer nicht gespeichert. Bestehende Teilnehmer werden nicht geändert.
- Der RPC verwendet eine explizite Feldliste und bestehende Check-in-Defaults/Trigger.
  Er übernimmt die unveränderte serverseitige Tarif-/Mitgliedercodeentscheidung.
  Neue IDs, QR-Tokens, Zahlungs-/Bescheinigungsmarker lassen sich nicht einschleusen.
- Die neue Migration stellt den ursprünglichen Registrierungstrigger und den
  Schutz gegen parallele Doppelanmeldungen wieder her. Auch bei später fehlendem
  Trigger garantiert der neue RPC selbst den Auftrag. Der Ereignisschlüssel
  `registration:<Teilnehmer-ID>` verhindert doppelte Bestätigungsaufträge.
- Nach Commit erfolgt ein unmittelbarer Versandversuch ausschließlich für diese
  Bestätigung. SMTP-Probleme lassen die erfolgreiche Anmeldung und den Auftrag
  erhalten; der Status wird als `failed` oder `uncertain` dokumentiert.
- Der Cron verarbeitet bestehende Aufträge jetzt auch bei fehlender Erinnerungs-
  funktion. Deren Fehler erscheint separat im Ergebnis und als sicherer Logcode.
- Die Adminstatusliste zeigt den Empfänger und konkrete, bereinigte Fehlermeldungen.
  „Erneut versuchen“ ist nur für `failed` verfügbar, setzt die Wartefrist zurück
  und erlaubt einen neuen Versuchszyklus auch nach ausgeschöpften fünf Versuchen.
  Vorherige Versuchszahl/Fehlercode bleiben in `mail_delivery_retries` erhalten.
- `sent`, `sending`, `uncertain` und `skipped` werden nicht manuell reaktiviert.
  Atomare Claims verhindern parallelen Versand desselben Auftrags.
- Eine bestehende Anmeldung ohne Versandauftrag kann gezielt über den neuen
  Teilnehmerbutton „Bestätigung nachholen“ bearbeitet werden. Das ändert keine
  Teilnehmerdaten und erzeugt keinen Sammelversand an historische Teilnehmer.
- Die Erfolgsmeldung unterscheidet SMTP-Annahme und noch nicht bestätigten Versand.
  SMTP-Annahme ist kein Nachweis der Zustellung im Empfängerpostfach.

## In Supabase auszuführen

1. Das richtige Projekt anhand der produktiven Supabase-URL bestimmen.
2. Falls nicht vorhanden, die Warteschlange zuerst mit
   `supabase/migrations/20261103_complete_mail_queue_repair.sql` einrichten.
   Die vorhandene Teilnehmer-/Check-in-Grundlage einschließlich QR-Tokens muss
   vorhanden sein. Keine Mitgliedermigration ist hierfür notwendig.
3. Vollständig ausführen:
   `supabase/migrations/20261105_registration_confirmation_outbox.sql`.
   Sie ist wiederholbar, lädt den PostgREST-Schemacache neu und versendet nichts.
   Keine existierenden Teilnehmer werden geändert; keine historischen Aufträge
   werden automatisch nachgetragen oder zurückgesetzt.
4. Die Anwendung **nach** erfolgreicher Migration neu bereitstellen. Die neue
   API benötigt den RPC; fehlt er, gibt sie einen Einrichtungsfehler zurück,
   statt eine weitere Anmeldung ohne Bestätigungsauftrag zu speichern.

Nur zur Diagnose, ohne Versand/Änderungen:
`supabase/diagnostics/registration_confirmation.sql`. Die erste Abfrage prüft
Warteschlange, Registrierungstrigger und Funktionen. Die zweite zählt für den
Termin „ND Impfung Winter“, 10.01.2027, fehlende/fehlgeschlagene/versendete
Bestätigungen. Sie setzt vorhandene Versandtabellen voraus und zeigt keine
E-Mail-Adressen an. Vereinskennung ggf. an die tatsächlich verwendete anpassen.

## In Vercel zu prüfen

- `SUPABASE_URL` bzw. `VITE_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` müssen
  zum selben produktiven Supabase-Projekt gehören. Service-Key niemals öffentlich
  als `VITE_`-Variable bereitstellen.
- `SMTP_HOST=smtp.strato.de`, `SMTP_PORT=465` mit SSL/TLS für STRATO-Postfächer;
  `SMTP_USER` als vollständige Postfachadresse, `SMTP_PASS` als Postfachpasswort.
  Der Transport prüft fehlende Werte und verwendet keine unverschlüsselte Verbindung.
- Gültige HTTPS-`APP_URL` oder unterstützte Produktions-URL für Verwaltungslinks.
- `CRON_SECRET` für den bestehenden automatischen Worker. Der vorhandene Zeitplan
  ist täglich um 09:00 UTC; direkte Bestätigungen werden bereits unmittelbar nach
  der Anmeldung versucht. Automatische Wiederholungen erfolgen erst beim nächsten
  Worker-Lauf, manuelle Fehlversuche können sofort gezielt wiederholt werden.

Variablenänderungen erfordern eine neue Bereitstellung. Die Werte wurden hier
nicht eingesehen oder geändert. STRATO-Referenz:
https://www.strato.de/faq/mail/e-mailserver-adressen-ports-ssl-tls/

## Bereits betroffene Anmeldung

Nach Einrichtung und Bereitstellung zuerst die Diagnose bzw. den Admin-
Versandstatus ansehen. Wenn kein Auftrag vorhanden ist, beim **betroffenen**
Teilnehmer „Bestätigung nachholen“ verwenden. Bei `failed` nach Behebung des
angezeigten Fehlers „Erneut versuchen“ im Versandstatus anklicken. Bei `sent`
Posteingang/Spam und Providerzustellung prüfen. Bei `uncertain` vor einem weiteren
Versand das SMTP-Protokoll prüfen; die Anwendung versendet nicht blind erneut.
Die Nachholfunktion erlaubt keine neue Bestätigung für vergangene/archivierte
oder inaktive Anmeldungen ohne vorhandenen Auftrag.

## Prüfnachweis

- `npm test`: 28 bestehende Tests erfolgreich.
- `node tests/registration-confirmation.integration.mjs`: Registrierungs- und
  Admin-API gegen isoliertes echtes PostgreSQL mit injiziertem Fake-SMTP;
  fehlender Trigger reproduziert; fehlender RPC verhindert unvollständiges
  Speichern; Anmeldung + QR-Bestätigung erfolgreich; Mitgliedercodepreise 5/10
  unverändert; Wiederholanfragen; SMTP-Anmeldefehler und Retry mit Audit;
  gezieltes einmaliges Nachholen; Cron ohne Reminder-RPC; unklare Zustellung;
  atomarer Rollback bei Queuefehlern; Berechtigungen und wiederholte Migration.
- `node tests/mail-campaign.integration.mjs`: bestehender Rundversand weiterhin
  erfolgreich mit Fake-SMTP geprüft.
- `npm run build`: erfolgreich.

Keine echten E-Mails, keine produktiven Datenbankänderungen, keine Veränderungen
an Mitgliederverwaltung, Mitgliedercode oder Tarifberechnung. **Produktiver
Versand ist nicht bestätigt; Migration und Bereitstellung stehen aus.**
