# SchulAdmin

> Datenschutzkonformes Schulverwaltungssystem für IT Bénédict Zürich

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-purple)](https://www.prisma.io/)
[![nDSG](https://img.shields.io/badge/nDSG-konform-red)](https://www.fedlex.admin.ch/eli/cc/2022/491/de)

## Überblick

SchulAdmin verwaltet sensible Personendaten von Schülerinnen und Schülern (teils Minderjährige) einer Schweizer Berufsfachschule. Das System ist vollständig konform mit dem **revidierten Schweizer Datenschutzgesetz (nDSG)**, in Kraft seit 01.09.2023.

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui |
| Backend | Node.js 20 LTS, Express 4, TypeScript 5, Prisma 5 |
| Datenbank | MySQL 8 |
| Auth | JWT (Access + Refresh Token), TOTP 2FA |
| Validierung | Zod (Frontend + Backend geteilt) |
| Logging | Winston (strukturiert + Audit-Log) |

## Projektstruktur

```
schuladmin/
├── apps/
│   ├── frontend/          # React-App
│   └── backend/           # Express-API
├── packages/
│   └── shared/            # Geteilte Types & Zod-Schemas
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Schnellstart (Entwicklung)

```bash
# 1. Repository klonen
git clone https://github.com/Nerminnnnn/SchulToolKienast.git
cd SchulToolKienast

# 2. Umgebungsvariablen setzen
cp .env.example .env
# .env mit echten Werten befüllen!

# 3. Docker starten (MySQL + Backend + Frontend)
docker-compose up -d

# 4. Datenbank-Migration ausführen
docker-compose exec backend npx prisma migrate dev

# 5. Seed-Daten laden
docker-compose exec backend npx prisma db seed
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001/api/v1  

**Produktion (Railway + Vercel):** siehe [DEPLOYMENT.md](./DEPLOYMENT.md)

## Rollen

| Rolle | Bezeichnung | Berechtigungen |
|-------|-------------|----------------|
| `LEHRPERSON` | Lehrer | Anwesenheit erfassen (Anwesend/Abwesend) für zugewiesene Klasse, Schülerliste |
| `ABTEILUNGSLEITUNG` | Leiter | Klassen/Schüler verwalten, Lehrer zuweisen, Absenzen entschuldigen, Noten, Export |

## Sicherheit & nDSG

- 🔐 JWT-Auth mit TOTP 2FA (Pflicht für alle Benutzer)
- 🔒 Soft Delete – Daten von Schülern werden nie hart gelöscht
- 📋 Unveränderliches Audit-Log für alle kritischen Aktionen
- 🛡️ Rate Limiting, Helmet HTTP-Security-Header
- ✅ Zod-Validierung aller Eingaben
- 🗑️ Beachte Aufbewahrungsfristen gemäss nDSG Art. 6

## Lizenz

Proprietary – IT Bénédict Zürich. Alle Rechte vorbehalten.
