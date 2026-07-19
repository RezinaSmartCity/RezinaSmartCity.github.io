---
name: Supabase migration
description: Rezina Civic a migrat de la Express+PostgreSQL+Drizzle la Supabase direct în frontend
---

## Decizie

Frontend-ul (`artifacts/rezina-app`) comunică direct cu Supabase — fără Express intermediar.

## Starea curentă

- `artifacts/rezina-app` — React PWA, folosește `@supabase/supabase-js`, vorbeste direct cu Supabase
- `artifacts/api-server` — rămâne în repo (nu a fost șters), dar nu mai e conectat la frontend
- `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` — rămân în repo, neutilizate de rezina-app

## Variabile de mediu necesare (VITE_ prefix pentru Vite)

- `VITE_SUPABASE_URL` — URL proiect Supabase
- `VITE_SUPABASE_ANON_KEY` — cheia anon (publică, protejată de RLS)
- `VITE_ADMIN_PASSWORD` — parolă panou admin (validare client-side)

## Baza de date

SQL migration: `supabase/migrations/001_init.sql`
Tabele: `reports` (uuid PK), `report_votes` (unique constraint report_id+fingerprint)
RLS activat cu politici publice de citire/scriere.
Storage bucket: `report-images` (public read).

**Why:** GitHub Pages nu suportă server Node.js; Supabase oferă DB+Storage+API gratuit.

**How to apply:** La orice schimbare de schemă, actualizați `001_init.sql` și rulați în Supabase SQL Editor.
