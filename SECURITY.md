# Sicherheitsgrundlage für Admin und QR-Check-in

Die Migration `supabase/migrations/20260724_secure_qr_checkin_foundation.sql` ergänzt Check-in-Felder, sichere zufällige Tokens und die Tabelle `club_admin_memberships`. Sie aktiviert vereinsgebundene RLS-Regeln für authentifizierte Administratoren und entfernt die früheren globalen `anon`-Lese- und Schreibregeln für Teilnehmer.

## Erforderliche Umgebungsvariablen

In Vercel für Production setzen:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_ADMIN_PIN` – ohne nicht leeren Wert ist ein Admin-Login absichtlich nicht möglich
- bestehende Zahlungs- und Mailvariablen: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`
- `VITE_SUPABASE_URL` muss für bereits vorhandene Zahlungs-Webhooks weiter gesetzt bleiben; der neue serverseitige Code bevorzugt `SUPABASE_URL`.

Der Service-Role-Schlüssel darf nie in `VITE_*`-Variablen oder im Browser stehen. `VITE_ADMIN_PIN` ist wegen des Vite-Präfixes nur eine zusätzliche UI-Sperre und kein Berechtigungsnachweis. Die echte Berechtigung erfolgt ausschließlich über Supabase Auth und `club_admin_memberships`. Es gibt keinen fest codierten PIN-Fallback.

## Clubadmin zuordnen

1. Den Benutzer über Supabase Auth anlegen (E-Mail/Passwort).
2. Seine UUID aus `auth.users` und die Vereins-ID aus `clubs` ermitteln.
3. Eine aktive Zuordnung anlegen:

```sql
insert into public.club_admin_memberships (user_id, club_id, role)
values ('AUTH_USER_UUID', 'CLUB_UUID', 'clubadmin');
```

`checkin_admin` ist für Check-in-Personal vorgesehen. `clubadmin` darf den eigenen Verein verwalten. `superadmin` darf serverseitig vereinsübergreifend arbeiten; die Zuordnung benötigt trotzdem einen gültigen `club_id`.

## Produktions-Rollout ohne Ausfall der öffentlichen Anmeldung

Die Migration entzieht dem alten Frontend absichtlich anonyme Teilnehmerrechte. Deshalb darf sie nicht vor dem neuen Code auf dem Produktionsprojekt ausgeführt werden.

1. Supabase-Auth-Konto für den Betreiber anlegen. Die Rollen-Zuordnung ist erst nach der Migration möglich.
2. Alle oben genannten Vercel-Umgebungsvariablen für Production setzen.
3. Neuen Code deployen. Öffentliche Anmeldung und Zahlungsbestätigung verwenden dann bereits serverseitige Endpunkte und funktionieren auch vor der Migration. Der Adminbereich zeigt bis zur Migration eine klare Einrichtungsnachricht statt abzustürzen.
4. Migration im Supabase SQL Editor ausführen.
5. Auth-Benutzer in `club_admin_memberships` dem Verein zuordnen.
6. Admin-Login, öffentliche Anmeldung, PayPal/Stripe und einen Check-in testen.
7. Erst nach erfolgreichem Test die App freigeben.

Wird die Migration zuerst ausgeführt, verliert der noch alte Code den anonymen Teilnehmerzugriff und die öffentliche Anmeldung kann ausfallen. Die oben beschriebene Reihenfolge begrenzt die Übergangszeit auf einen bewusst gesperrten Adminbereich.

Zahlungs- und Check-in-Felder werden ausschließlich von serverseitigen Endpunkten beziehungsweise Zahlungs-Webhooks geschrieben. QR-Tokens werden nicht geloggt und der Check-in-Endpunkt akzeptiert Tokens nur im POST-Body.
