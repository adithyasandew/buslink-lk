# BusLink LK

Sri Lankan private-bus management and passenger platform (SWT22022 — Practical for Internet Application Development, Group M).

Connects **Passengers**, **Bus Owners**, **Bus Staff** and **Administrators**: trip search, seat booking, QR digital tickets, live bus tracking and approaching-bus notifications.

> Status: in development. See [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Planned stack

React + Vite + Tailwind CSS · Axios · Node.js + Express · MongoDB + Mongoose · JWT + bcrypt · Socket.IO · Leaflet + OpenStreetMap · Vitest / Supertest / Playwright · GitHub Actions · Docker Compose

## Team

| Module | Member | GitHub |
|---|---|---|
| 1 — Bus & Route Management (frontend) | M.P.S.A. Nawanjana | `avinthanawanjana` |
| 2 — Trip, Booking & Digital Ticketing (frontend) | K.L.H.G. Karandana | `Mr-G01` |
| 3 — Real-Time Tracking & Notifications (backend) | W.A.S.S. Kaluwila | `adithyasandew` |
| 4 — Payment & Revenue Management (backend) | W.M.S.R. Weerasinghe | `randikaweerasinghe` |
| 5 — User, Reports & Administration (backend) | B.V.K. Sathsara | `Kavindu-Sathsara` |

## Running locally

Requirements: Node.js 20+ and MongoDB (for example `docker run -d -p 27017:27017 -v buslink-data:/data/db mongo:latest`; the volume keeps data across container restarts).

```bash
# API
cd server
npm ci
cp .env.example .env          # set MONGODB_URI and a long random JWT_SECRET
npm run seed:demo             # optional: synthetic demo accounts, bus, route and 7 days of trips
npm run dev                   # http://localhost:5000/api/v1/health

# Web app (second terminal)
cd client
npm ci
npm run dev                   # http://localhost:5173 (proxies /api to :5000)
```

The API refuses to start if MongoDB is unreachable, and builds all indexes (including the unique seat-reservation index) before accepting requests.

Tests: `npm test` in `server/` uses an in-memory MongoDB; `npm run test:mongo` runs the same suite against a real server (`TEST_MONGODB_URI`, default `mongodb://127.0.0.1:27017`, one throwaway database per test file). `npm test` in `client/` runs the UI tests.

Create a real administrator with `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin` (password at least 12 characters; admins cannot self-register).

Demo accounts created by `seed:demo` use the password `Password123!` (override with `DEMO_PASSWORD`): `owner@example.lk`, `passenger@example.lk`, `admin@example.lk`, `driver@example.lk`, `conductor@example.lk`. Development only — the script refuses to run with `NODE_ENV=production`.

## Workflow

- Long-lived branches: `main` (stable) and `develop` (integration).
- Every task uses a short-lived branch from `develop`, e.g. `feature/member-3/<topic>`, and merges via reviewed PR.
- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, etc.
