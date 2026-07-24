# Sicherheitsgrundlage für Admin und QR-Check-in

Die Migration `supabase/migrations/20260724_secure_qr_checkin_foundation.sql` ergänzt die Check-in-Felder, sichere zufällige Tokens und die Tabelle `club_admin_memberships`. Sie aktiviert vereinsgebundene RLS-Regeln für authentifizierte Administratoren und entfernt die früheren, globalen `anon`-Lese- und Schreibregeln für Teilnehmer.

## Erforderliche Umgebungsvariablen

Serverseitig (z. B. Vercel):

- `SUPABASE_URL` (alternativ wird aus Kompatibilitätsgründen `VITE_SUPABASE_URL` gelesen)
- `SUPABASE_SERVICE_ROLE_KEY`

Der Service-Role-Schlüssel darf nie in `VITE_*`-Variablen oder im Browser stehen.

## Clubadmin zuordnen

1. Den Benutzer über Supabase Auth anlegen (E-Mail/Passwort).
2. Seine UUID aus `auth.users` und die Vereins-ID aus `clubs` ermitteln.
3. Eine aktive Zuordnung einfügen, zum Beispiel:

```sql
insert into public.club_admin_memberships (user_id, club_id, role)
values ('AUTH_USER_UUID', 'CLUB_UUID', 'clubadmin');
```

`checkin_admin` hat denselben vereinsbezogenen Datenzugriff für Check-in-Aufgaben. `superadmin` darf für alle Vereine arbeiten; die Zuordnung benötigt trotzdem einen gültigen `club_id`.

## Rollout-Reihenfolge

1. Migration im Supabase SQL Editor ausführen.
2. Die benötigten Auth-Benutzer und Vereinszuordnungen erstellen.
3. Server-Umgebungsvariablen setzen und API-Endpunkte deployen.
4. Danach das Frontend deployen.

Zahlungs- und Check-in-Felder werden ausschließlich von serverseitigen Endpunkten bzw. Zahlungs-Webhooks geschrieben. QR-Tokens werden nicht geloggt und der Check-in-Endpunkt akzeptiert Tokens nur im POST-Body.
