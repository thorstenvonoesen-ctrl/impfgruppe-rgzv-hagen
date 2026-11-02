# Mitgliedertarif und Smartphone-Check-in: Bereitstellung und Nachweise

## Gezielte Nachprüfung am 02.11.2026

Tarif- und QR-Reparaturen sind bereits vorhanden; keine weiteren Änderungen daran.
Fehlende Ergänzung: Die Anmeldeantwort wartete bisher auf den unmittelbaren
SMTP-Versuch. Dieser läuft nun mit `@vercel/functions` / `waitUntil` über denselben
Worker im Hintergrund. Die Antwort meldet zunächst `emailStatus=pending`, nicht
fälschlich eine erfolgreiche SMTP-Annahme. `REGISTRATION_MAIL_RESULT` protokolliert
Status und Dauer des unmittelbaren Versandversuchs. Die Ursache der produktiven
5–10 Minuten Verzögerung bleibt ohne Queue-/SMTP-Protokolle unbewiesen.

Einmalig erfolgreich geprüft: 18 relevante Unit-Tests, Registrierungsintegration
einschließlich wartendem Fake-SMTP bei bereits beantworteter Anmeldung,
Mitgliedertarifintegration, Check-in-Integration und Produktionsbuild. Keine echten
E-Mails oder produktiven Datenänderungen. Lokal läuft Node 24; vorgesehen ist Node 22.

Keine neue SQL-Migration nötig. Vorhandenes vollständiges SQL-Paket einschließlich
Migration 11 und 12 je installiertem Stand verwenden, danach aktuellen Code
bereitstellen. Produktiv bleiben Migrationen, 5/10-Euro-Vereinstarife, HTTPS-APP_URL,
SMTP-Zeiten und Smartphone-Login/Check-in zu prüfen. Bereits dokumentierte gesperrte
Zugänge wurden nicht erneut abgefragt. Erforderlich sind berechtigter Projektzugang
und Supabase-SQL-Zugriff; produktiver Erfolg wird weiterhin nicht behauptet.

## Belegte Befunde

Der aktuelle Anwendungscode enthält die normalisierte Mitgliederprüfung aus Migration
11. In isoliertem PostgreSQL wurden 5,00 € nach frischem E-Mail-Nachweis sowie 10,00 €
für Gäste durch Formularpreis/API, gespeicherten Datensatz, Bestätigungsinhalt und erneut
geladene Anmeldung nachgewiesen. Mitgliedercode und unbegrenzte Code-Anforderung bleiben
erhalten. Reine E-Mail-Eingabe gewährt keinen Mitgliedertarif. Die frühere exakte
Adressprüfung konnte ältere Einträge mit abweichender Großschreibung übersehen.

**Der konkrete produktive Tariffehler ist nicht abschließend belegt.** Die produktive
Installation von Migration 11 und die Konfiguration des verwendeten Supabase-Projekts
konnten nicht gelesen werden. Nicht einfach nochmals Code ändern, bevor die unten
genannten Nachweise vorliegen.

Beim QR wurde ein weiterer Codefehler gefunden: Die bisherigen E-Mail-Anhänge enthielten
den nackten Token. Der interne Scanner konnte ihn lesen; eine Smartphone-Kamera konnte
damit keine App-Adresse öffnen. Außerdem setzt die Check-in-API `checkin_method` voraus;
diese Spalte fehlte im bisherigen vollständigen Reparaturpaket.

## Umgesetzter QR-Ablauf

Neue QR-Anhänge und im Adminbereich erzeugte QR-Bilder enthalten die konfigurierte
HTTPS-App-Adresse mit `/#checkin=<zufälliger Token>`. Es stehen keine Namen, E-Mail-
Adressen oder Verwaltungslinks im QR. Der Fragment-Token wird nicht als Query-Parameter
an den Webserver gesendet.

Smartphone-Kamera → bestehender Admin-Login → geschützte Teilnehmer-/Terminvorschau →
bewusste Bestätigung → bestehende Check-in-API. Ein bloßes Öffnen des Links speichert
keine Anwesenheit. Ohne gültige Sitzung und aktive Vereinsrolle werden weder
Teilnehmerdaten angezeigt noch Änderungen erlaubt. Der Server ermittelt den Termin
aus der Anmeldung; eine Terminangabe im Link wird nicht vertraut.

Einzigartige Tokens identifizieren eine Anmeldung. Die Datenbank verhindert doppelte
Tokens. Gleichzeitige oder erneute Check-ins verändern den Zeitstempel nicht erneut.
Offene Zahlung erfordert eine ausdrückliche Bestätigung und wird durch Anwesenheit
nicht zu „bezahlt“. Archivierte Termine, stornierte Anmeldungen und fremde Vereine
werden abgewiesen. Scanner und API akzeptieren weiterhin vorhandene nackte Token-QRs.

**Bereits versendete QR-Bilder ändern sich nicht nachträglich.** Sie bleiben im internen
Admin-Scanner nutzbar. Für das direkte Öffnen mit einer Smartphone-Kamera ist ein neu
erzeugtes QR-Bild mit URL nötig. Es wurde kein automatischer Neuversand ausgelöst.

## Einmalige Bereitstellung

1. Im tatsächlich verwendeten Supabase-Projekt als Administrator das aktualisierte
   `supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql` ausführen. Es enthält zuletzt
   Migration 11 (normalisierte Mitgliedertarife) und 12 (Check-in-Spalte und Indizes).
   Keine Tabellen zurücksetzen. Das Paket verändert beim Installieren keine alten
   Anmeldungen, Preise, Anwesenheiten oder Tokens und lädt den PostgREST-Cache neu.
   Bei bereits vollständig installiertem Stand 11 genügt die additive Migration
   `20261112_qr_checkin_prerequisites.sql`.
2. Bei einem Fehler wegen doppelter bestehender Tokens keine Tokens auf Verdacht
   ersetzen. Die Migration bricht mit Rollback ab, statt eine mehrdeutige Zuordnung
   zu erlauben. Den konkreten Bestand dann gezielt prüfen.
3. Vercel Production: `APP_URL` auf die tatsächliche öffentliche HTTPS-App-Adresse
   setzen. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` und
   `VITE_SUPABASE_ANON_KEY` müssen zum selben Projekt gehören. Keine Service-Schlüssel
   als `VITE_*` veröffentlichen. Bestehende SMTP-Variablen bleiben erforderlich.
4. Den gesamten aktuellen Code bereitstellen, danach geöffnete Browser neu laden.
   Ein erfolgreicher GitHub/Vercel-Build führt keine Supabase-Migration aus.

Für den letzten vorhandenen Git-Commit `b9f8761d4997d920e055742969eb31aabbf09d83`
meldet GitHub einen erfolgreichen Vercel-Status. Dies belegt weder die produktive
Domain-Zuordnung noch das produktive Datenbankschema. Die Vercel-Verbindung liefert
für Projekt-/Deploymentdetails weiterhin 404. Es gibt keinen direkten Supabase-
Administrationszugang in dieser Sitzung. SQL und dieser neue Code wurden hier nicht
produktiv ausgeführt/bereitgestellt. Die produktive Abnahme bleibt offen.

## Private, lesende Schema-/Tarifprüfung

```sql
select to_regprocedure('public.active_club_member_matches(uuid,text)') as member_lookup,
       to_regprocedure('public.register_with_tariff_confirmation(jsonb)') as registration_rpc,
       to_regprocedure('public.reserve_membership_challenge_v2(uuid,uuid,uuid,text,text)') as otp_rpc;

select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='participants'
  and column_name in ('checkin_token','checked_in','checked_in_at','checked_in_by',
                      'checkin_method','tariff_source','tariff_review_required');

select has_function_privilege('service_role','public.active_club_member_matches(uuid,text)','execute') as server_allowed,
       has_function_privilege('anon','public.active_club_member_matches(uuid,text)','execute') as public_denied;
-- Erwartet: true, false.

select pg_get_functiondef('public.register_with_tariff_confirmation(jsonb)'::regprocedure)
       like '%lower(trim(m.email))=verified%' as normalized_match_installed;
-- Erwartet: true.

-- Nur die betroffene Vereins-UUID einsetzen; keine Schlüssel oder Mitgliedercodes ausgeben.
select id,member_price,guest_price from public.clubs where id='<VEREINS-UUID>'::uuid;
-- Für RGZV Hagen erwartet: 5 und 10. Diese Abfrage ändert keine Preise.
```

Für die einzelne betroffene Anmeldung, ohne Kontaktdaten oder QR-Token auszugeben:

```sql
select p.id,p.club_id,p.vaccination_date_id,p.payment_amount,p.is_member,p.tariff_source,
       p.tariff_review_required,p.payment_status,p.registration_status,p.checked_in,
       p.checked_in_at,p.checkin_method,
       exists(select 1 from public.club_members m where m.club_id=p.club_id and m.is_active
         and lower(trim(m.email))=lower(trim(p.email))) as active_directory_match
from public.participants p
where p.id='<ANMELDUNGS-UUID>'::uuid and p.club_id='<VEREINS-UUID>'::uuid;
```

`active_directory_match` allein beweist keine E-Mail-Inhaberschaft. Keine pauschale
Neuberechnung ausführen. Die vorhandene gezielte Tarifkorrektur im Verwaltungslink
verlangt einen frischen OTP-Nachweis und aktive Mitgliedschaft, ändert nur Tarifdaten
und protokolliert die Korrektur. Bereits bezahlte/archivierte Anmeldungen benötigen
manuelle Abrechnungsprüfung. Andere Kontaktdaten und frühere E-Mails werden nicht geändert.

`REGISTRATION_SAVED` protokolliert jetzt zusätzlich den angefragten Tarifweg
(`quotedTariffSource`), den tatsächlich gespeicherten Betrag und den Prüfvorbehalt.
Damit lassen sich fehlender Nachweis, Code-Nutzung und Prüfprobleme unterscheiden,
ohne Codes, E-Mail-Adressen oder Tokens zu protokollieren.

## Abnahme

Lokal erfolgreich: 37 Unit-Tests, Registrierung/Bestätigung/5-10-Euro-Tarife,
Mitgliederprüfung und unbegrenzte Code-Anfragen, Check-in-API mit isoliertem PostgreSQL,
Migration mehrfach und Produktionsbuild. Check-in-Browseransicht mit Musterdaten auch
bei 390 × 844 Pixeln geprüft. Alle SMTP-Aufrufe in Tests sind simuliert.

```powershell
node tests/checkin.integration.mjs
node tests/registration-confirmation.integration.mjs
node tests/membership-tariff.integration.mjs
node tests/membership-rate-limit.integration.mjs
npm test
npm run build
```

Produktiv noch erforderlich: tatsächliche Domain bestätigen, obige Schemaabfragen
prüfen, eine beabsichtigte Anmeldung mit kontrolliertem Mitglieds- und Gastnachweis
vergleichen, gespeicherten Betrag und E-Mail abgleichen. QR mit einem berechtigten
Mitarbeiterkonto öffnen; vor einer echten Anwesenheitsbuchung Teilnehmer und Termin
prüfen. Keine vorhandene Anmeldung zu Testzwecken einchecken oder löschen. Eine echte
Smartphone-Kamera und die produktive Zustellung sind durch die lokalen Tests nicht belegt.
