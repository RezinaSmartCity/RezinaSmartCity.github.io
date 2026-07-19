# 🏙️ Rezina Smart City — Raportare Urbană

Aplicație PWA pentru cetățenii orașului Rezina, Moldova. Cetățenii pot raporta probleme urbane (drumuri deteriorate, iluminat defect, gunoi ilegal, etc.) direct de pe telefon. Sesizările apar pe o hartă interactivă și pot fi votate ca remediate.

**Autor:** Pavel Dordea

---

## Arhitectură

```
Telefon cetățean
      │
      ▼
GitHub Pages  ──────────────────────────────────────────────────
(React PWA)   ← Leaflet map, GPS, categorii, vot
      │
      ▼
Supabase (gratuit)
  ├── PostgreSQL  → stochează sesizările și voturile
  ├── Storage     → stochează fotografiile (bucket: report-images)
  └── RLS         → securitate pe baza de randuri (fără autentificare)
```

Nu există server Express. Aplicația comunică direct cu Supabase din browser.

---

## Funcționalități

- 📍 Hartă Leaflet centrată pe Rezina (47.7478, 28.9628)
- 📷 Raportare cu GPS automat + geocoding invers (strada detectată)
- 🗂️ 13 categorii de sesizări cu iconițe și autorități competente
- 📧 Link `mailto:` generat automat pentru a notifica autoritatea
- ✅ Sistem de vot (3 voturi → sesizare marcată ca remediată)
- 🔒 Panou admin protejat cu parolă (`/admin`)
- 📤 Export CSV al sesizărilor
- 📱 PWA — instalabil pe telefon, funcționează offline (UI)

---

## Setup Supabase

### 1. Creați proiect Supabase gratuit

Mergeți la [supabase.com](https://supabase.com) → New Project.

### 2. Creați tabelele

În **Supabase Dashboard → SQL Editor**, rulați conținutul fișierului:

```
supabase/migrations/001_init.sql
```

### 3. Creați bucket-ul Storage

În **Supabase Dashboard → Storage → New Bucket**:
- **Nume:** `report-images`
- **Public:** ✅ Da

Apoi adăugați policies în **Storage → Policies**:

```sql
-- Allow public uploads
create policy "public_upload" on storage.objects
  for insert with check (bucket_id = 'report-images');

-- Allow public reads  
create policy "public_read" on storage.objects
  for select using (bucket_id = 'report-images');
```

### 4. Obțineți cheile API

**Supabase Dashboard → Project Settings → API:**
- `Project URL` → `VITE_SUPABASE_URL`
- `anon / public` key → `VITE_SUPABASE_ANON_KEY`

---

## Variabile de mediu

Creați fișierul `.env.local` în `artifacts/rezina-app/` (copiați din `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ADMIN_PASSWORD=parola-ta-admin
```

---

## Deployment pe GitHub Pages

### 1. Configurați secretele GitHub

În **GitHub → Repository → Settings → Secrets and variables → Actions**, adăugați:

| Secret | Valoare |
|--------|---------|
| `VITE_SUPABASE_URL` | URL-ul proiectului Supabase |
| `VITE_SUPABASE_ANON_KEY` | Cheia anon Supabase |
| `VITE_ADMIN_PASSWORD` | Parola admin |

### 2. Actualizați BASE_PATH

În `.github/workflows/deploy.yml`, schimbați:

```yaml
BASE_PATH: /rezina-civic/
```

cu numele repository-ului vostru GitHub (ex: `/rezina-smart-city/`).

### 3. Activați GitHub Pages

**GitHub → Repository → Settings → Pages:**
- Source: **GitHub Actions**

### 4. Push pe `main`

Workflow-ul se declanșează automat la fiecare push pe `main`.

---

## Dezvoltare locală

```bash
# Instalați dependențele
pnpm install

# Rulați aplicația în mod dezvoltare
pnpm --filter @workspace/rezina-app run dev

# Build pentru producție
pnpm --filter @workspace/rezina-app run build
```

---

## Categorii de sesizări

| Categorie | Autoritate |
|-----------|-----------|
| 🚗 Parcare neregulamentară | Poliția Rezina |
| 🚨 Accident / Trafic | Poliția Rezina |
| 🪣 Canalizare astupată | Apă Canal Rezina |
| ♻️ Gunoi pe drum | Servicii Comunale |
| 🌳 Copac / Crengi căzute | Secția Ecologie |
| ⚡ Probleme electricitate | Rednord SA |
| 🕳️ Drum deteriorat | Primăria Rezina |
| 💧 Probleme apă | Apă Canal Rezina |
| 🗑️ Depozitare ilegală | Servicii Comunale |
| 💡 Iluminat defect | Primăria Rezina |
| 🔨 Vandalism | Poliția Rezina |
| 🐕 Animale vagabonde | Primăria Rezina |
| ❓ Altele | Primăria Rezina |

---

## Panou Admin

Accesibil la `/admin`. Funcționalități:
- 📊 Statistici (total, remediate, în așteptare, ultimele 30 zile)
- 📋 Vizualizare + filtrare sesizări
- ✅ Marcare ca remediat / redeschidere
- 🗑️ Ștergere sesizare
- 📤 Export CSV

---

## Licență

Proiect civic open-source pentru orașul Rezina, Moldova.
