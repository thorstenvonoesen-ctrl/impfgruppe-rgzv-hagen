# Einzelne Teilnehmeranmeldung löschen – Fehler und Reparatur

## Nachgewiesene Ursache

Der bisherige Button ruft vom angemeldeten Browserclient direkt
`DELETE /rest/v1/participants` mit Teilnehmer- und Vereinsfilter auf. Es gibt
hierbei keinen eigenen Vercel-Löschendpunkt. Der Code ignorierte sowohl
Supabase-Fehler als auch die Anzahl tatsächlich gelöschter Datensätze und lud
anschließend nur die Liste neu.

Zwei konkrete FK-Blockaden wurden mit den echten Migrationen in isoliertem
PostgreSQL reproduziert, selbst mit Datenbank-Administratorrechten:

1. `20261103_complete_mail_queue_repair.sql` ergänzt
   `mail_deliveries_participant_repair_fk` ohne Löschweiterleitung, somit
   `ON DELETE NO ACTION`. Vorhandene Versandaufträge verhindern einen direkten
   Teilnehmer-DELETE mit SQLSTATE `23503`.
2. Bei ursprünglich mit `ON DELETE CASCADE` angelegten Versandtabellen kann die
   Teilnehmerlöschung zwar an Versandaufträge weitergegeben werden; vorhandene
   Retry-Protokolle aus `20261105_registration_confirmation_outbox.sql` blockieren
   deren Löschung über `mail_delivery_retries_delivery_id_fkey`, ebenfalls `23503`.

Diese Fehlerpfade sind nachgewiesen; welcher davon in der konkreten produktiven
Datenbank vorliegt, konnte nicht direkt eingesehen werden. Der Vercel-Logzugriff
ergab weiterhin `403 Forbidden`. Für den alten direkten Browser-DELETE ist die
HTTP-Antwort von Supabase im Browser-Netzwerkprotokoll entscheidend, nicht ein
fehlender Vercel-Funktionslogeintrag.

Lesende Produktionsprüfung ohne Löschversuch:
`supabase/diagnostics/participant_delete.sql`. Sie zeigt alle FK-Abhängigkeiten
zu Teilnehmern und Versandaufträgen, Löschregeln, vorhandene Trigger und den
Installationsstatus der neuen Funktion. Keine personenbezogenen Werte werden gelesen.

## Reparatur

Die neue Funktion `delete_participant_registration(target_club,target_participant)`
wird über Supabase/PostgREST mit der bestehenden Adminsitzung aufgerufen. Sie ist
`SECURITY DEFINER`, da normale Browserrollen absichtlich keine Rechte zum Löschen
privater Versanddaten erhalten. Deshalb prüft sie selbst zwingend `auth.uid()`
und eine aktive Superadmin- oder passende Vereinsadminzuordnung.

In einer einzigen Transaktion:

1. Genau die angeforderte Anmeldung des angegebenen Vereins sperren.
2. Bestehenden Archivschutz beibehalten; archivierte Anmeldungen nicht löschen.
3. Zugehörige Versandaufträge sperren, falsche Vereinszuordnungen zurückweisen.
4. Bei einem Auftrag im Zustand `sending` abbrechen: kein Eingriff in einen
   laufenden SMTP-Vorgang. Der Status muss anschließend geprüft werden.
5. Ausschließlich die zu diesen Aufträgen gehörenden Retry-Protokolle und danach
   die Aufträge löschen, jeweils mit explizitem Vereins-/Teilnehmerbezug.
6. Genau eine Teilnehmeranmeldung löschen und die Löschung bestätigen.

Andere Teilnehmer oder Datensätze werden nicht anhand ihrer E-Mail-Adresse oder
des Termins mitgelöscht. Insbesondere bleiben allgemeine Kampagnen-Batchmarker
erhalten, damit ein bereits gestarteter Rundversand nicht erneut vorgemerkt wird.
Mitgliederverwaltung, Mitgliedercode, Preise und Vereinstabellen werden nicht verändert.

Bei weiteren, unbekannten FK-Abhängigkeiten oder Schutztriggern wird **die gesamte
Transaktion** einschließlich bereits erfolgter Versandbereinigung zurückgerollt.
Es werden keine bestehenden FK-/RLS-Regeln entfernt oder abgeschwächt.

Die Oberfläche bestätigt Erfolg erst nach erfolgreicher RPC-Antwort für genau die
angeforderte ID. Fehler werden sichtbar und verständlich angezeigt. Während der
Anfrage sind die Löschschaltflächen gesperrt. Nur Vereinsadmins und Superadmins
sehen den Button; Check-in-Admins, inaktive Admins und anonyme Clients dürfen die
neue Funktion nicht verwenden.

## Erforderliche Bereitstellung

**Eine Supabase-Migration ist zwingend erforderlich:**

`supabase/migrations/20261107_safe_participant_delete.sql`

Den vollständigen Inhalt im SQL Editor des tatsächlich verwendeten Projekts als
Datenbankadministrator ausführen; anschließend die neue Anwendung bereitstellen.
Die Migration ist wiederholbar, installiert ausschließlich die Funktion und ihre
Berechtigungen und lädt den PostgREST-Schemacache neu. **Die Installation löscht
keinen Teilnehmer und keinen Versandauftrag.** Erst die spätere ausdrücklich
bestätigte Benutzeraktion in der Teilnehmerverwaltung führt die Einzel-Löschung aus.

Es gibt keine neuen Umgebungsvariablen. Die vorhandene Adminsitzung wird verwendet.
Fehlt die Migration, zeigt die Oberfläche einen konkreten Einrichtungshinweis.

Diese Migration wurde hier **nicht produktiv ausgeführt**, die Anwendung nicht
produktiverseits bereitgestellt. Es wurde kein produktiver Teilnehmer gelöscht.

## Prüfung

- `node tests/participant-delete.integration.mjs`: vier Installationsvarianten
  (`new-repair`, `legacy-cascade`, `no-audit`, `no-outbox`) gegen isoliertes
  PostgreSQL; Originalfehler mit konkretem Constraint reproduziert; neue Funktion
  über eine authentifizierte Vereinsadminrolle ausgeführt.
- Bestätigungen in allen Zuständen einschließlich `sent`, `failed`, `pending`,
  `uncertain`, `skipped` und `sending`, Retry-Protokolle, bekannte und unbekannte
  FK-Abhängigkeiten, Archivschutz, Rollen-/Vereinsgrenzen, erneute Löschanfrage und
  wiederholte Migration geprüft.
- Daten vor/nach dem Löschen verglichen: nur Zielteilnehmer und direkt zugehörige
  Versand-/Retry-Datensätze entfernt; andere Teilnehmer, Vereine, Termine,
  Mitglieder, Preise und Kampagnenmarker unverändert.
- Nicht entfernbarer Zusatz-FK führt zum vollständigen Rollback. Ein entfernter
  Auftrag kann vom Worker nicht nachträglich beansprucht werden.
- `npm test`: 32 Tests erfolgreich; `npm run build`: erfolgreich.

Keine echten E-Mails; die Lösch-Integrationstests importieren keinen SMTP-Transport
und lesen keine produktiven Zugangsdaten. Für PostgreSQL-Tests ggf. zuvor:
`npm install --prefix tmp/vaccination-db-deps --no-package-lock @electric-sql/pglite`.
