# Project Status

- **Project start:** 2026-10-04 (repository created 2026-11-07)
- **Phase:** 4 in progress (module implementation); last updated 2026-11-08
- **Completed and merged into `develop`:**
  - Docs: responsibility matrix, architecture overview, decisions D-001–D-009, database design, REST/error/Socket.IO contracts, CONTRIBUTING and templates, references register, README run instructions
  - Platform: Express API and React/Vite/Tailwind client; runs on a real MongoDB (index-safe startup, fails fast if the database is unreachable); idempotent demo seed (`npm run seed:demo`); GitHub Actions CI for client, server (in-memory DB) and server against a real MongoDB container
  - Module 1 (avinthanawanjana): Owner UI — dashboard with setup checklist, buses, staff, routes and stops, schedules and trip generation; mobile-first with bottom/side navigation (PRs #31, #32)
  - Module 2 backend (PM-owned): trip search, booking with atomic seat reservation, QR tickets and verification
  - Module 3 (adithyasandew): trip lifecycle, location sharing, approaching-bus notifications, notifications API, authenticated Socket.IO
  - Module 4 (randikaweerasinghe): mock payments, payment lifecycle with gateway callback and expiry, refunds on cancellation, owner revenue by day and bus, trip collections, passenger payment history (PRs #29, #34)
  - Module 5 foundation: registration, login, JWT and role guard
  - Bus/staff/route/schedule APIs (PM-owned)
- **Ready as drafts, not committed** (`~/Projects/member-drafts`): Module 5 admin, verification, complaints and feedback (Kavindu-Sathsara); booking/payment notifications FR-17 (Mr-G01)
- **Open:** Passenger UI (search, booking, payment, ticket QR, live map), Staff UI (trips, start/end, location sharing, ticket scan), Admin UI; Playwright end-to-end tests in the repo; Docker Compose; transcribe proposal references; require CI checks in branch protection
- **Known limitations:** public trip search still lists buses that are not yet admin-verified; payments are mock/sandbox only (D-004, D-009)
- **Tests:** server 89 passing (in-memory and real MongoDB), client 32 passing; CI green on `develop`
- **Next action:** commit the Module 5 and FR-17 drafts after member review, then the Passenger UI
