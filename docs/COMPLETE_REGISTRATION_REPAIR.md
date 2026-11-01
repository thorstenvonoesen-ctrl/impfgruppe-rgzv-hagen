# Vollständige Reparatur der öffentlichen Anmeldung

## Status und belegte Ursachen

Der Anwendungscode und das vollständige SQL-Paket sind lokal integriert getestet.
**Produktiv wurden weder SQL noch ein Vercel-Deployment ausgeführt.** Der verbundene
Vercel-Zugang liefert für Runtime-Logs `403 Forbidden` und für die Projektkonfiguration
`404 Project not found`. Lokal stehen keine produktiven Supabase-/SMTP-Zugangsdaten
zur Verfügung. Deshalb sind produktives Schema, Deployment und Zustellung unbestätigt.

Im Code reproduziert wurden zwei verbleibende Blockaden:

* Die Registrierungs-RPC und der INSERT-Trigger legten den E-Mail-Auftrag innerhalb
  derselben Transaktion an. Eine fehlerhafte Versandtabelle ließ die gesamte Anmeldung
  zurückrollen. Ein späteres Abfangen von SMTP-Fehlern konnte das nicht verhindern.
* Fehler beim Nachschlagen einer verifizierten Mitgliedschaft beziehungsweise ein
  abgelaufener Nachweis brachen auch die eigentliche Anmeldung ab.

Die Reparatur speichert mit der Anmeldung einen dauerhaften Bestätigungsbedarf.
Versandtabellenfehler werden in einer Datenbank-Untertransaktion isoliert; die
Anmeldung bleibt gespeichert. Nach der Reparatur legen Cron oder die bestehende
Adminaktion fehlende Aufträge idempotent an. SMTP läuft anschließend über die
bestehende Warteschlange. Datenbankausfall, geschlossene Termine und ungültige
Pflichtangaben bleiben echte Anmeldefehler; sie werden nicht als Erfolg ausgegeben.

Gültiger Mitgliedercode und konfigurierte Preise bleiben erhalten. Verifizierte
aktive Mitglieder erhalten weiterhin den Mitgliedertarif. Bei einer technischen
Prüfstörung/abgelaufenem Nachweis wird sicherheitshalber der reguläre Betrag mit
`tariff_review_required=true` gespeichert und ausdrücklich als vorläufig angezeigt,
auch in der Bestätigung. Eine fremde E-Mail-Adresse allein gewährt keinen Rabatt.
Bestehende Beträge werden nicht nachträglich angepasst; die Klärung erfolgt durch
den Verein. OTP-Begrenzungen bleiben unabhängig von der normalen Anmeldung.

## Bereitstellung in dieser Reihenfolge

1. In Vercel das tatsächlich zur öffentlichen Domain gehörende Projekt ermitteln.
   Frontend-URL und serverseitige Supabase-URL müssen dasselbe Supabase-Projekt
   verwenden. Für direkte Ausführung benötige ich einen berechtigten Vercel-Zugang
   zu diesem Projekt sowie Supabase-SQL-Zugriff als Datenbankadministrator.
   Geheimnisse ausschließlich in den vorgesehenen Einstellungen hinterlegen.
2. Im SQL Editor **dieses Supabase-Projekts** als `postgres` die vollständige Datei
   `supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql` ausführen. Keine anderen alten
   Migrationen auf Verdacht nachziehen. Diese Datei enthält die notwendigen Teile
   in Reihenfolge 01 (Terminfelder), 03 (Mail), 04 (bestehende Mitgliedergrundlage),
   05 (Bestätigungen), 06 (verifizierte Tarife), 08 (Entkopplung). Abschließend lädt
   `NOTIFY pgrst, 'reload schema'` den API-Cache neu.
3. Die unten stehenden Schema-/Rechteprüfungen ausführen. Erst danach den aktuellen
   Code dieses Arbeitsstands als **Production** auf Vercel bereitstellen. Ein lokaler
   Build ändert die produktive Anwendung nicht. In Deployment Details Commit und
   Domain-Zuordnung kontrollieren.
4. Vercel-Variablen für **Production** prüfen und nach Änderungen neu bereitstellen:

   | Variable | Verwendung |
   | --- | --- |
   | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend, öffentlich zulässiger Anon-Schlüssel |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server, passendes Projekt; Service-Schlüssel niemals als `VITE_*` |
   | `APP_URL` | Tatsächliche öffentliche HTTPS-Adresse für Verwaltungslinks |
   | `SMTP_HOST`, `SMTP_PORT` | Bestehender STRATO-Server; 465 mit TLS oder 587 mit STARTTLS |
   | `SMTP_USER`, `SMTP_PASS` | Vollständiges Postfach und zugehöriges Geheimnis, nur serverseitig |
   | `CRON_SECRET` | Autorisierung des Versand-Crons |

   `MAIL_TEST_RECIPIENT` wird nur von der ausdrücklich ausgelösten Testmailfunktion
   benötigt. Automatisierte Regressionstests verwenden ausschließlich injiziertes
   Fake-SMTP und lesen keine produktiven `.env`-Dateien.
5. Vercel Cron aktivieren/kontrollieren. Die bestehende `vercel.json` plant den Lauf
   täglich um **09:00 UTC**. Die Anmeldung versucht die Bestätigung sofort; der Cron
   holt offene Aufträge später nach. Für sofortiges Nachholen gibt es im Adminbereich
   „Offene Zustellungen fortsetzen“. Ein häufigerer automatischer Lauf erfordert
   einen zum Vercel-Tarif passenden Zeitplan; der vorhandene tägliche Lauf wurde nicht
   verändert. Runtime-Logs müssen den erfolgreichen GET-Lauf belegen, nicht 401.

Das Paket ist wiederholt ausführbar und läuft als eine Transaktion. Es enthält
keine Löschung, keine historischen Versand-Backfills und keine Neuberechnung von
Bestandsbeträgen. Es setzt die vorhandenen Grundtabellen und Vereinsadmin-Grundlage
voraus. Unbekannte, inkompatible Bestandsstrukturen führen zum Abbruch mit Rollback;
dann den konkreten SQL-Fehler prüfen. Keine Tabellen zurücksetzen. Die funktionierende
Lösch-RPC wird weder ersetzt noch entfernt; Migration 07 ist bewusst nicht enthalten.
Die gemeinsame Schemareparatur gilt projektweit, bearbeitet aber keine Vereinsdatensätze.

## Schema und Rechte prüfen (ohne Kontaktdaten)

```sql
select to_regprocedure('public.register_with_tariff_confirmation(jsonb)') as registration_rpc,
       to_regprocedure('public.reconcile_registration_confirmations(uuid,uuid,integer)') as recovery_rpc,
       to_regclass('public.mail_deliveries') as outbox,
       to_regclass('public.membership_email_challenges') as otp;

select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='participants'
  and column_name in ('confirmation_job_state','confirmation_error_code',
                      'tariff_review_required','tariff_source','checkin_token');

select has_function_privilege('service_role',
         'public.register_with_tariff_confirmation(jsonb)','execute') as server_allowed,
       has_function_privilege('anon',
         'public.register_with_tariff_confirmation(jsonb)','execute') as public_denied,
       has_function_privilege('authenticated',
         'public.reconcile_registration_confirmations(uuid,uuid,integer)','execute') as client_denied;
-- Erwartet: true, false, false.

select pg_get_functiondef('public.register_with_tariff_confirmation(jsonb)'::regprocedure)
       like '%ensure_registration_job%' as resilient_rpc_installed;
-- Erwartet: true. Nur im privaten SQL Editor ansehen.
```

## Anmeldung und Versand eindeutig nachweisen

Für eine bereits bekannte Anmeldung nur ihre UUID und Vereins-UUID einsetzen:

```sql
select p.id,p.vaccination_date_id,p.registration_status,p.payment_amount,
       p.tariff_source,p.tariff_review_required,p.confirmation_job_state,
       p.confirmation_error_code,m.id as delivery_id,m.status,m.attempts,
       m.error_code,m.sent_at
from public.participants p
left join public.mail_deliveries m on m.participant_id=p.id
  and m.club_id=p.club_id and m.event_key='registration:'||p.id
where p.id='<ANMELDUNGS-UUID>'::uuid and p.club_id='<VEREINS-UUID>'::uuid;
```

* Keine Teilnehmerzeile: Speicherung wurde nicht bestätigt. Den Vercel-Eintrag
  `REGISTRATION_FAILED` anhand der Referenz mit Phase/Code prüfen. Keine neue
  Anmeldung erzeugen, bevor ein unbekannter Commit-Ausgang abgeklärt wurde.
* `confirmation_job_state=pending`: Anmeldung gespeichert, Auftrag noch nicht
  angelegt; SQLSTATE steht in `confirmation_error_code`. Nach Datenbankreparatur
  „Offene Zustellungen fortsetzen“ verwenden. Diese Aktion gilt nur dem autorisierten
  Verein. Der Versandstatus zeigt wartende Bestätigungen zusätzlich an.
* `failed`: Konfigurationsursache im Versandstatus beheben, dann die betroffene
  Nachricht erneut versuchen. `sent` wird nicht nochmals versendet.
* `uncertain`/`sending`: Nicht blind erneut versenden. Nach SMTP-Unterbrechung kann
  die Nachricht bereits angenommen worden sein. SMTP-Protokoll/Zustellung klären;
  die automatische Wiederholung bleibt gesperrt, um Dubletten zu vermeiden.
* Eine ältere Anmeldung ohne Vormerkung/Auftrag wird nicht ungefragt nachgetragen.
  Die bestehende Aktion „Bestätigung nachholen“ nutzt die einzelne Anmeldung.

Ein öffentlicher HTTP-201 und eine gespeicherte Zeile belegen die Anmeldung.
`sent`/`sent_at` belegen die Annahme durch SMTP, nicht den Eingang im Postfach.
Der letzte Produktivnachweis erfordert eine beabsichtigte Anmeldung mit kontrollierter
Adresse, anschließend obige Abfrage, erneutes Öffnen des Verwaltungslinks sowie
Kontrolle von Posteingang/Spam und gegebenenfalls STRATO-Protokoll. Nicht mehrfach
anmelden, nicht zum Test löschen. Dieser Produktivnachweis ist noch offen.

## Reproduzierbare lokale Prüfung

Bei fehlender Test-Abhängigkeit einmal:

```powershell
npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite@0.5.14
```

Danach separat ausführen:

```powershell
node scripts/build-registration-repair.mjs
npm test
node tests/registration-confirmation.integration.mjs
node tests/membership-tariff.integration.mjs
node tests/participant-delete.integration.mjs
node tests/mail-campaign.integration.mjs
npm run build
```

Der Registrierungstest installiert das vollständige SQL-Paket mehrfach in isoliertem
PostgreSQL, prüft API → Speicherung → Tarif → Auftrag → simulierte Bestätigung →
erneutes Laden über die Verwaltungs-API. Fehlerfälle umfassen fehlende RPC/Spalte,
Versand-Constraint, Mitgliederabfrage, SMTP/URL-Konfiguration und parallele Wiederholung.
Er prüft außerdem echte `service_role`-Rechte, Vereinsgrenzen, Bestandsdaten und die
unveränderte Definition der Löschfunktion. Der separate Löschtest prüft weiterhin
vier Datenbankvarianten. Mitgliedertests prüfen aktive/inaktive/fremde Mitglieder,
Gast/Code, Nachweisbindung, Rate-Limits und unveränderte Bestandsbeträge.
