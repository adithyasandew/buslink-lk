# Architecture Decision Log

| ID | Date | Decision | Status |
|---|---|---|---|
| D-001 | 2026-11-07 | Project start date is 2026-10-04; schedule W1–W10 counts from it. Repository created 2026-11-07. | Accepted |
| D-002 | 2026-11-07 | `adithyasandew` is project manager and reviews/approves all PRs; owns bus/route/schedule and booking/ticket backends and shared models. | Accepted |
| D-003 | — | Live location source: Bus Staff device publishes location; passenger device provides pickup point and shows the map. Proposal wording conflicts (passenger GPS vs staff device). | **Proposed — awaiting approval** |
| D-004 | — | Payments: mock/sandbox flow first; no provider, refund or settlement model chosen. Never store card numbers or CVVs. | **Proposed — awaiting approval** |
| D-005 | — | Bus Staff is a single role (drivers and conductors combined). | Accepted (per master plan) |

Open questions for DATABASE_DESIGN.md: staff as user role vs profile, embedded vs separate stops, multi-seat bookings, schedule-to-trip generation, location history retention, notification channels, complaint lifecycle, owner/bus verification.
