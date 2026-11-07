# Team Responsibility Matrix

Project: BusLink LK (SWT22022, Group M). Official project start: **2026-10-04** (schedule W1–W10 counts from this date).
Project manager / lead reviewer: `adithyasandew` — reviews and monitors all work. All PRs are reviewed and approved by the PM account (`adithyasandew`). Where the PM is also the PR author, GitHub does not allow self-approval, so the PM merges as repository admin.

## 1. Proposal modules (from the submitted proposal)

| Module | Member | GitHub | Side |
|---|---|---|---|
| 1 — Bus & Route Management | M.P.S.A. Nawanjana | `avinthanawanjana` | Frontend |
| 2 — Trip, Booking & Digital Ticketing | K.L.H.G. Karandana | `Mr-G01` | Frontend |
| 3 — Real-Time Bus Tracking & Notifications | W.A.S.S. Kaluwila | `adithyasandew` | Backend |
| 4 — Payment & Revenue Management | W.M.S.R. Weerasinghe | `randikaweerasinghe` | Backend |
| 5 — User, Reports & Administration Management | B.V.K. Sathsara | `Kavindu-Sathsara` | Backend |

## 2. Backend areas not allocated by the proposal — assigned by the project manager

| Area | Accountable owner | Collaborators | Status |
|---|---|---|---|
| Bus, Bus Staff assignment, route, stop, schedule APIs (FR-02..05) | `adithyasandew` | Module 1 (`avinthanawanjana`), Module 5 (auth) | Decided by PM |
| Trip search, booking, ticket generation and verification APIs (FR-06..08) | `adithyasandew` | Module 2 (`Mr-G01`), Module 4 (payment linkage) | Decided by PM |
| Shared Mongoose models / schema changes | `adithyasandew` | All backend members | Decided by PM |

Owner recorded; work on these areas may start.

## 3. Requirement ownership (FR-01..FR-17)

| FR | Primary |
|---|---|
| FR-01 Auth, FR-14 Complaints, FR-15 Admin, FR-16 RBAC | Module 5 (`Kavindu-Sathsara`) |
| FR-02..05 Bus/staff/route/schedule | Module 1 UI + backend `adithyasandew` |
| FR-06..08 Search/booking/tickets | Module 2 UI + backend `adithyasandew` |
| FR-09, FR-10 Payment, revenue | Module 4 (`randikaweerasinghe`) |
| FR-11, FR-13 Tracking, approaching notification | Module 3 (`adithyasandew`) |
| FR-12 Map tracking | Module 2 UI + Module 3 |
| FR-17 Notifications | Modules 3, 4, 5 integration |

## 4. Other open decisions

- Live location source: Bus Staff device (recommended) vs passenger phone — to be recorded in DECISIONS.md.
- Payment: mock/sandbox first; provider not chosen.

## 5. Working rules

- One accountable owner per task; commits are authored by the member who did the work, under their own identity.
- Task branches from `develop`, PR to `develop`, review and approval by the PM (`adithyasandew`), CI must pass once configured.
