# Mitgliederprüfung ohne Anfragebegrenzung

Dieser Stand ersetzt die bisherige Anfragebegrenzung vollständig.

Frontend: kein Countdown, keine gespeicherte Wartefrist, keine zeitliche Sperre.
Der Button ist bei eingegebener E-Mail und gewähltem Termin nutzbar; während einer
laufenden Anfrage bleibt die vorhandene Vermeidung von Mehrfachklicks erhalten.
Unmittelbar nach deren Abschluss kann der nächste Code angefordert werden.

API: keine HTTP-429-Antwort und kein `Retry-After` für Mitglieder-Code-Anfragen.
Jede gültige Anfrage reserviert einen neuen Code und versucht genau dessen Versand.
Technische SMTP-Fehler werden weiterhin angezeigt und protokolliert.

Supabase: weder Adress-/Vereinszähler noch historische Zeitstempel, technische
Fehlversuche oder unklare SMTP-Ergebnisse blockieren eine neue Reservierung.
Auch die alte RPC-Signatur verwendet dieselbe unbegrenzte Implementierung.
Bestehende Datensätze bleiben erhalten; frühere Sperren werden durch das Ersetzen
der auswertenden Funktion sofort wirkungslos. Keine Mitgliederdaten, Tarife oder
Anmeldungen werden verändert.

Erhalten bleiben Eingabeprüfung, serverseitige RPC-Berechtigungen, RLS,
Vereins-/Terminbindung, kryptografische Codes, zehn Minuten Code-Gültigkeit,
Einmalverwendung und fünf Fehlversuche je Code. Ein ausgeschöpfter oder abgelaufener
Code sperrt keine neuen Code-Anfragen. Die Anmeldung und der Mitgliedercode bleiben
unabhängig verfügbar. Mengenbasierte Begrenzungen des Code-Versands bestehen in der
Anwendung entsprechend diesem Auftrag nicht mehr; die genannten Schutzmaßnahmen
verhindern Code-Missbrauch, begrenzen aber keinen automatisierten Massenversand.

## Bereitstellung

1. Auf einer Installation mit Migration 09 die Datei
   `supabase/migrations/20261110_remove_membership_request_limits.sql` als Administrator
   im richtigen Supabase SQL Editor ausführen. Sie ist wiederholt ausführbar und
   lädt den PostgREST-Schemacache neu.
2. Bei unvollständiger Einrichtung das aktualisierte
   `supabase/repair/COMPLETE_REGISTRATION_REPAIR.sql` verwenden. Es enthält sämtliche
   Voraussetzungen und Migration 10 zuletzt. Keine ältere Funktionsdefinition danach
   ausführen, da sie die Begrenzung wieder einsetzen würde.
3. Den aktuellen Anwendungscode auf Vercel bereitstellen. Bereits geöffnete Browser
   neu laden, damit der alte Countdown-Code ersetzt wird. Keine neuen Variablen nötig.

Produktive SQL-Ausführung und Deployment sind mangels produktiven Zugriffs nicht
erfolgt. Die lokalen Änderungen allein entfernen keine Sperre einer alten Bereitstellung.

## Prüfung ohne echte E-Mails

```powershell
node tests/membership-rate-limit.integration.mjs
node tests/membership-tariff.integration.mjs
node tests/registration-confirmation.integration.mjs
npm test
npm run build
```

Der bisherige Rate-Limit-Test prüft jetzt ausdrücklich die Entfernung aller Limits:
wiederholte Anfragen derselben Adresse, gleichzeitige Anfragen mit verschiedenen
Code-IDs, mehr als 1.000 historische Einträge, fehlgeschlagene/unklare SMTP-Versuche,
alte RPC, Vereinsgrenzen und Verifizierung vorhandener Codes. Alle SMTP-Aufrufe sind
simuliert. Die Testabhängigkeit wird wie in der vollständigen Reparaturanleitung eingerichtet.
