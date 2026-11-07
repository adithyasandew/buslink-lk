# Architecture Decision Log

| ID | Date | Decision | Status |
|---|---|---|---|
| D-001 | 2026-11-07 | Project start date is 2026-10-04; schedule W1–W10 counts from it. Repository created 2026-11-07. | Accepted |
| D-002 | 2026-11-07 | `adithyasandew` is project manager and reviews/approves all PRs; owns bus/route/schedule and booking/ticket backends and shared models. | Accepted |
| D-003 | 2026-11-07 | Live location source: Bus Staff device publishes location; passenger device provides pickup point and shows the map. Proposal wording conflicts (passenger GPS vs staff device). | Accepted (PM) |
| D-004 | 2026-11-07 | Payments: mock/sandbox flow first; no provider, refund or settlement model chosen. Never store card numbers or CVVs. | Accepted (PM) |
| D-006 | 2026-11-07 | Schema choices in DATABASE_DESIGN.md accepted: unique bus registration number, `seatreservations` unique `(tripId, seatNumber)` overbooking guard, `buslocations` TTL history, server-computed fares, in-app notifications first. | Accepted (PM) |
| D-005 | — | Bus Staff is a single role (drivers and conductors combined). | Accepted (per master plan) |

Previously open questions (now answered in DATABASE_DESIGN.md): staff as user role vs profile, embedded vs separate stops, multi-seat bookings, schedule-to-trip generation, location history retention, notification channels, complaint lifecycle, owner/bus verification.
