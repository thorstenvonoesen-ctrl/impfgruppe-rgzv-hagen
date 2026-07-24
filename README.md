# Anmeldung Impfgruppe RGZV Hagen

Saubere Vite/React-App ohne Unterordner-Probleme beim GitHub-Upload.

## Upload in GitHub
Alle Dateien aus diesem Ordner direkt in das Repository hochladen:

- index.html
- package.json
- README.md
- supabase-schema.sql
- main.jsx
- styles.css
- supabase.js

## Vercel Environment Variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PAYMENT_URL optional
- VITE_ADMIN_PIN required for Admin-Login

`VITE_SUPABASE_ANON_KEY` ist der öffentliche Supabase-Anon-Key für das Frontend und kein Service-Role-Key. Ohne `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` wird keine Supabase-Verbindung aufgebaut.
