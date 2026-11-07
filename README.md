# BusLink LK

Sri Lankan private-bus management and passenger platform (SWT22022 — Practical for Internet Application Development, Group M).

Connects **Passengers**, **Bus Owners**, **Bus Staff** and **Administrators**: trip search, seat booking, QR digital tickets, live bus tracking and approaching-bus notifications.

> Status: project bootstrap only — no application code yet. See [PROJECT_STATUS.md](PROJECT_STATUS.md).

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

## Workflow

- Long-lived branches: `main` (stable) and `develop` (integration).
- Every task uses a short-lived branch from `develop`, e.g. `feature/member-3/<topic>`, and merges via reviewed PR.
- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, etc.
