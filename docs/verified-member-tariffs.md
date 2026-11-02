# Automatische Mitgliederzuordnung zusätzlich zum Mitgliedercode

## Aktuelle Regel: automatische Zuordnung ohne Einmalcode

Auf ausdrücklichen Wunsch genügt für neue Anmeldungen eine normalisierte
E-Mail-Übereinstimmung mit einem aktiven Mitglied desselben Vereins. Der Server
und die Tarif-RPC prüfen den Eintrag; Mitgliedercode und konfigurierte Vereinstarife
bleiben erhalten. Einmalcodes bleiben für Änderungen/Korrekturen bestehender
Anmeldungen verfügbar. Eine fehlgeschlagene Mitgliederprüfung speichert keinen
ungeprüften Gasttarif. Bestehende Zahlungsdaten werden nicht neu berechnet.

Bereitstellung: Migration `20261113_automatic_member_tariff.sql` nach Stand 08/11
oder das aktualisierte vollständige Reparaturpaket ausführen, danach den Code
bereitstellen. Die alten internen Bezeichnungen `verified_member` und
`tariff_verified_email` bleiben kompatibel, belegen für neue Anmeldungen aber keine
E-Mail-Inhaberschaft. Die folgende Beschreibung des verpflichtenden OTP-Nachweises
ist historisch. Lokal geprüft: 5/10 Euro ohne OTP, Speicherung, Bestätigungsinhalt,
inaktive/fremde Mitglieder, Code, wiederholte Migration und unveränderte Altbeträge.
Produktive Migration und Abnahme stehen aus.

## Verhalten

Die neue Anmeldung berücksichtigt die **in `clubs.member_price` und
`clubs.guest_price` gespeicherten Tarife**, statt serverseitig feste 5/10 Euro zu
berechnen. Bei nicht gesetzten Preisen gelten weiterhin 5/10 Euro als Fallback.
Eine ausdrücklich konfigurierte Null ist ebenfalls ein gültiger Preis.

Es gibt zwei gleichberechtigte Wege zum Mitgliedertarif:

1. Der bisherige Mitgliedercode bleibt vollständig erhalten und wird unverändert
   ohne zusätzliche E-Mail-Prüfung akzeptiert. Seine bisherige Wirkung wird nicht
   eingeschränkt. Er bleibt eine alternative Berechtigung durch Kenntnis des Codes.
2. Ohne Code wird die E-Mail-Adresse per Einmalcode bestätigt. Erst danach prüft
   der Server die aktive Mitgliedschaft **im Verein des gewählten Impftermins**.
   Bei einem Treffer wird der Mitgliedertarif automatisch angezeigt und berechnet.

Ein Name oder eine unbestätigte E-Mail-Adresse allein gewährt keinen Rabatt.
Inaktive Mitglieder, Mitglieder anderer Vereine und bestätigte Nichtmitglieder
zahlen den regulären Tarif. Ohne Nachweis wird kein Mitgliedsstatus offengelegt.
Das Mitgliederverzeichnis bleibt unverändert und jederzeit erweiterbar; neue oder
geänderte aktive Einträge werden bei folgenden Anmeldungen berücksichtigt.

## Anmeldung und Preisberechnung

Im Formular zuerst den Impftermin auswählen und die E-Mail-Adresse eingeben.
„E-Mail für Mitgliederprüfung bestätigen“ sendet einen achtstelligen Einmalcode
an genau diese Adresse. Nach Eingabe des Codes erscheint der serverseitig
ermittelte Tarif in der Zusammenfassung. Alternativ kann jederzeit der bisherige
Mitgliedercode eingegeben werden.

Der Browser sendet keine verbindliche Preisentscheidung. Beim endgültigen
Speichern werden Code, Nachweis, aktive Mitgliedschaft und Preise erneut geprüft.
Die Datenbank ermittelt den Betrag ebenfalls aus den Vereinstarifen und speichert
ihn gemeinsam mit Anmeldung und Bestätigungsauftrag. Die bestehende
Bestätigungs-E-Mail verwendet genau diesen gespeicherten Betrag.

## Sicherheit des E-Mail-Nachweises

- Der Code wird an jede syntaktisch gültige Adresse nach demselben Verfahren
  versendet. Vorher erfolgt keine Mitgliederauskunft und keine Mitgliederabfrage.
- Codegültigkeit: 10 Minuten, maximal fünf Prüfversuche pro Anforderung, nach
  erfolgreicher Prüfung kein zweites Verwenden desselben Codes.
- Mindestens 60 Sekunden zwischen Anforderungen für dieselbe Adresse im Verein,
  maximal drei pro Stunde; zusätzlich maximal 200 Anforderungen pro Verein/Stunde.
  Die Reservierung und Begrenzung erfolgen atomar in der Datenbank.
- In der privaten Challenge-Tabelle stehen nur HMAC-Digests für Adresse und Code,
  keine Klartextcodes. Die Serverrolle ist die einzige zugriffsberechtigte Rolle.
- Nach Erfolg entsteht ein signierter Nachweis für 20 Minuten, gebunden an
  E-Mail-Adresse, Verein, Termin und Verwendungszweck. Er wird nur im Arbeitsspeicher
  der Oberfläche gehalten, nicht in URLs oder Local Storage gespeichert.
- Änderungen an Adresse oder Termin verwerfen den Nachweis im Formular.
  Manipulierte oder abgelaufene Nachweise lehnt der Server ab.
- `SUPABASE_SERVICE_ROLE_KEY` bleibt ausschließlich serverseitig; die neue
  Browserkomponente importiert keine Serverlogik oder Schlüssel.

Die Zusatzprüfung setzt den bestehenden SMTP-Versand voraus. Scheitert die
E-Mail-Verifikation, kann weiterhin ein gültiger Mitgliedercode verwendet werden;
ohne Nachweis oder Code gilt der reguläre Tarif.

## Spätere Bearbeitung und Bestandsdaten

Die Migration führt **kein UPDATE vorhandener Anmeldungen, Preise oder Mitglieder**
aus. Bestehende Anmeldungen erhalten lediglich zusätzliche nullable Tarifmetadaten;
falls noch fehlend wird die technische Bearbeitungsrevision ergänzt.

Der bei einer Anmeldung festgelegte Betrag ist ein Preis-Snapshot und bleibt bei
späteren Änderungen erhalten, auch wenn sich Vereinstarife oder Mitgliedschaft
inzwischen ändern. Das gilt für Altanmeldungen, neue Anmeldungen und bezahlte
Teilnahmen. Ein späterer Bearbeitungsvorgang aktiviert keinen rückwirkenden Rabatt.

Bei einer neuen, automatisch zugeordneten Mitgliedschaft ist der Wechsel auf eine
andere Adresse nur möglich, wenn diese erneut bestätigt und einem aktiven Mitglied
desselben Vereins zugeordnet ist. So lässt sich ein Mitgliedertarif nicht durch
anschließenden Adresstausch übertragen. Die Verwaltungsseite bietet dafür dieselbe
Codeprüfung an. Für codebasierte und bisherige Anmeldungen bleibt die bestehende
Bearbeitungsweise erhalten. Clientseitig eingeschleuste Beträge werden ignoriert.

## Bereitstellung

1. Voraussetzungen im tatsächlich verwendeten Supabase-Projekt: bestehende
   Teilnehmer-/Check-in-Grundlage, Versandwarteschlange, Mitgliederverzeichnis aus
   `20261104_add_club_members.sql` sowie Bestätigungs-Outbox aus
   `20261105_registration_confirmation_outbox.sql` einschließlich ihrer Voraussetzungen.
2. **Danach** die vollständige Datei
   `supabase/migrations/20261106_verified_member_tariffs.sql` ausführen.
   Sie ergänzt private E-Mail-Challenges, zwei Prüf-RPCs, den neuen Registrierungs-
   RPC und die abgesicherte Bearbeitungsfunktion. Sie lädt den PostgREST-Cache neu,
   versendet selbst keine Mail und ist wiederholbar.
3. Den Anwendungscode bereitstellen. Keine neue Umgebungsvariable ist notwendig.
   Bestehende Supabase-Serververbindung und SMTP-Konfiguration müssen funktionieren.
   Die browserseitigen Supabase-Werte bleiben unverändert.
4. Die Mitglieds-/Gastpreise sowie aktiven Mitgliedsdatensätze prüfen. E-Mail-
   Adressen im Verzeichnis werden bereits durch die Mitgliederverwaltung normalisiert.

Die Migration wurde **nicht produktiv ausgeführt**, und die Anwendung wurde hier
nicht produktiv bereitgestellt. Der bisherige fehlende Zugriff auf die produktive
Umgebung besteht weiterhin. Echte E-Mail-Verifikation und produktive Preisberechnung
sind deshalb nicht bestätigt. Der Code und die Migration sind lokal getestet.

## Tests

- `npm test`: 30 Tests erfolgreich, darunter Zweck-/Vereins-/Termin-/Adressbindung,
  Ablauf und Manipulation von Nachweisen sowie unverändert gültige Mitgliedercodes.
- `node tests/membership-tariff.integration.mjs`: echter isolierter PostgreSQL-
  Ablauf durch die Registrierungs-API mit simuliertem SMTP: aktive, inaktive,
  fremde Mitglieder, Nichtmitglieder, gültiger/ungültiger Code; freie konfigurierte
  Tarife (6,75/12,25 Euro und Null); tatsächlich gespeicherter Mailbetrag;
  erratene/replayte Codes, Ratelimits, manipulierte Eingaben, Altbeträge,
  bezahlte Anmeldungen, erneute Verifikation bei Adresswechsel, private RPCs und
  wiederholte Migration geprüft.
- `node tests/registration-confirmation.integration.mjs`: Bestätigungs-Outbox,
  Fehler-/Retry-Verhalten und Code-/Gasttarife weiterhin erfolgreich geprüft.
- Browserfixture `tests/fixtures/membership-tariff-ui.html`: unbestätigt regulär,
  bestätigt automatisch Mitgliedertarif, Adresswechsel verwirft Nachweis,
  bestehender Mitgliedercode ohne E-Mail-Nachweis akzeptiert.
- `npm run build`: Produktionsbuild erfolgreich.

Alle automatisierten Versandtests verwenden einen injizierten Fake-Transport.
Es wurden keine echten E-Mails verschickt, keine produktiven Teilnehmer oder
Mitglieder geändert und keine bestehenden Beträge nachberechnet.
