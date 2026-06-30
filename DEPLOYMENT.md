# Deployment – Railway + Vercel

SchulAdmin wird so gehostet:

| Komponente | Plattform |
|------------|-----------|
| MySQL-Datenbank | Railway (MySQL Plugin) |
| Backend (Express API) | Railway |
| Frontend (React/Vite) | Vercel |

---

## 1. MySQL auf Railway

1. [railway.app](https://railway.app) → Neues Projekt
2. **Add Plugin** → **MySQL**
3. Unter **Variables** der MySQL-Instanz: `MYSQL_URL` notieren

---

## 2. Backend auf Railway

1. Im gleichen Projekt: **New Service** → **GitHub Repo** verbinden
2. **Wichtig – eine der beiden Optionen:**

### Option A (empfohlen): Root Directory setzen

**Settings** → **Root Directory**: `apps/backend` (**Pflicht**)

Builder: **Dockerfile** (`Dockerfile.prod` via `railway.toml`) – kein Railpack nötig.

Migration: `preDeployCommand` in `railway.toml` (`prisma migrate deploy`).

### Umgebungsvariablen (Backend-Service)

| Variable | Wert |
|----------|------|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (Variable Reference) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Mind. 32 Zeichen, zufällig |
| `JWT_REFRESH_SECRET` | Anderer zufälliger String, mind. 32 Zeichen |
| `FRONTEND_URL` | `https://dein-projekt.vercel.app` |
| `ALLOWED_ORIGINS` | `https://dein-projekt.vercel.app` |
| `UPLOAD_DIR` | `/app/uploads` |

`PORT` wird von Railway automatisch gesetzt.

### Volume für Arztzeugnis-Uploads (empfohlen)

Ohne Volume gehen hochgeladene Scans bei Redeploy verloren.

1. Backend-Service → **Volumes** → Add Volume
2. Mount Path: `/app/uploads`
3. `UPLOAD_DIR=/app/uploads` setzen

### Öffentliche URL

**Settings** → **Networking** → **Generate Domain** (z.B. `schuladmin-api.up.railway.app`)

### Seed-Daten (einmalig, optional)

```bash
railway link
railway run --service backend npx prisma db seed
```

### Health Check

`GET https://dein-backend.up.railway.app/health` → `{ "status": "ok", "db": "connected" }`

---

## 3. Frontend auf Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub Repo
2. **Root Directory**: `apps/frontend`
3. Framework: **Vite** (wird via `vercel.json` erkannt)

### Umgebungsvariablen (Vercel)

| Variable | Wert |
|----------|------|
| `VITE_API_URL` | `https://dein-backend.up.railway.app` |

Wichtig: **ohne** trailing slash. Nach Änderung **Redeploy** nötig (Build-Zeit-Variable).

### SPA-Routing

`vercel.json` leitet alle Routen auf `index.html` um (React Router).

---

## 4. Reihenfolge beim ersten Deploy

1. Railway MySQL erstellen
2. Railway Backend deployen (Migration läuft automatisch)
3. Vercel Frontend deployen mit `VITE_API_URL`
4. Railway `FRONTEND_URL` + `ALLOWED_ORIGINS` auf Vercel-URL setzen
5. Backend neu deployen (CORS/Cookies)
6. Optional: `railway run npx prisma db seed`

---

## 5. JWT-Secrets generieren

```bash
# PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

# Linux/macOS
openssl rand -base64 48
```

---

## 6. Lokaler Produktions-Test

```bash
docker compose -f docker-compose.prod.yml up --build
```

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| CORS-Fehler | `ALLOWED_ORIGINS` = exakte Vercel-URL (https, kein `/` am Ende) |
| Login/Refresh schlägt fehl | `FRONTEND_URL` korrekt; Cookies brauchen HTTPS (Vercel + Railway) |
| DB-Verbindung fehlgeschlagen | `DATABASE_URL` = `${{MySQL.MYSQL_URL}}`; MySQL-Service im selben Projekt |
| API 404 auf Vercel | Normal – API läuft nur auf Railway. `VITE_API_URL` prüfen |
| Uploads weg nach Deploy | Railway Volume an `/app/uploads` mounten |
