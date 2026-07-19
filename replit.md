# Rezina Civic – Raportare Urbană

Aplicație web PWA full-screen pentru raportarea problemelor urbane în Rezina, Moldova. Cetățenii pot marca probleme pe hartă (parcare ilegală, copaci căzuți, probleme cu electricitatea etc.), trimite sesizări automate prin email autorităților competente și vota remedierea problemelor.

## Run & Operate

- `pnpm --filter @workspace/rezina-app run dev` — frontend (port dinamic via `$PORT`)
- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm run typecheck` — typecheck complet
- `pnpm --filter @workspace/api-spec run codegen` — regenerează hook-urile API din spec OpenAPI
- `pnpm --filter @workspace/db run push` — aplică schema DB (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Leaflet.js (hartă), Tailwind CSS, shadcn/ui, vaul (drawer)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validare: Zod (v4), drizzle-zod
- Codegen: Orval (din spec OpenAPI)
- Email: Nodemailer (configurat via env vars SMTP_*)

## Where things live

- `artifacts/rezina-app/src/pages/Home.tsx` — pagina principală (hartă + formular raportare)
- `artifacts/rezina-app/src/index.css` — temă dark navy + CSS animații GPS dot
- `artifacts/api-server/src/routes/reports/index.ts` — rutele API pentru sesizări
- `artifacts/api-server/src/routes/reports/email.ts` — trimitere email autorități
- `lib/api-spec/openapi.yaml` — contractul API (source of truth)
- `lib/db/src/schema/reports.ts` — schema tabelei reports

## Email Configuration (env vars opționale)

Dacă nu sunt setate, emailurile sunt loggate dar nu trimise (fallback silențios):
- `SMTP_HOST` — host SMTP (ex: smtp.gmail.com)
- `SMTP_PORT` — port (default: 587)
- `SMTP_USER` — utilizator SMTP
- `SMTP_PASS` — parolă SMTP
- `SMTP_FROM` — adresa expeditor
- `EMAIL_POLITIE` — email poliție (default: politie@rezina.md)
- `EMAIL_ECOLOGIE` — email ecologie (default: ecologie@rezina.md)
- `EMAIL_REDNORD` — email Rednord (default: rednord@rezina.md)
- `EMAIL_PRIMARIE` — email primărie (default: primarie@rezina.md)
- `EMAIL_APA` — email apă canal (default: apa@rezina.md)
- `EMAIL_COMUNALE` — email servicii comunale (default: comunale@rezina.md)

## Architecture decisions

- **Hartă full-screen**: `body, #root { width: 100vw; height: 100vh; overflow: hidden }` — nicio margine
- **Leaflet direct** (nu react-leaflet): mai puțin overhead, control deplin prin `useRef`
- **Vot remediere cu fingerprint localStorage**: fără auth, anti-spam prin fingerprint unic per browser
- **Email async**: trimiterea emailului nu blochează răspunsul API — eroarea de email e logată, nu propagată
- **Photo base64**: poze stocate direct în DB ca base64 — simplu pentru MVP, limita body 20MB

## Product

PWA full-screen care funcționează ca aplicație nativă la "Add to Home Screen". Harta Leaflet centrată pe Rezina [47.7478, 28.9628] cu:
- Punct albastru pulsant pentru localizare GPS în timp real
- Pinuri colorate pe hartă per categorie de problemă
- Drawer de raportare cu selector de categorie, descriere, poză, GPS auto-completat
- Email automat trimis autorității competente (poliție, ecologie, Rednord etc.)
- Sistem de vot (3+ voturi = sesizare marcată remediată)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `leaflet/dist/leaflet.css` importat în `index.css` (nu în main.tsx) — trebuie să fie după `@import url(...)` Google Fonts
- `L.DomUtil.get()` + reset `_leaflet_id` necesar în React Strict Mode pentru a evita inițializarea dublă a hărții
- `cn()` din `@/lib/utils` pentru className dinamice — nu template literals cu backtick în JSX (Babel parser error)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
