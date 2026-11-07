# REST API Contract (v1)

Base path `/api/v1`. JSON only. Response and error shapes: [ERROR_FORMAT.md](ERROR_FORMAT.md). Auth: `Authorization: Bearer <JWT>`. Roles: `passenger`, `owner`, `staff`, `admin`. "Own" means the resource belongs to the caller; the server enforces it. Frontends must not invent paths or fields; change this file first.

Owner column: **PM** = `adithyasandew` (bus/schedule and booking/ticket backends), M3/M4/M5 = module owners.

## Auth and users (FR-01, FR-14–16) — M5
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/register | public | Register passenger or owner (staff are created by owners; admins seeded) |
| POST | /auth/login | public | Returns JWT and user (rate limited) |
| GET | /auth/me | any | Current user |
| GET/PATCH | /users, /users/:id | admin | List, change status/role |
| PATCH | /owners/:id/verify | admin | Verify bus owner |
| PATCH | /buses/:id/verify | admin | Verify bus |
| POST/GET | /complaints | passenger / admin | Submit, review complaints |
| PATCH | /complaints/:id | admin | Update status |
| POST | /feedback | passenger | Rating/feedback for a completed trip |

## Buses, staff, routes, stops, schedules (FR-02–05) — PM (UI: Module 1)
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST/GET | /buses | owner | Register, list own buses |
| GET/PATCH/DELETE | /buses/:id | owner (own) | Bus detail, update, deactivate |
| POST/GET | /staff | owner | Create staff user, list own staff |
| POST | /buses/:id/staff | owner (own) | Assign staff `{ staffUserId, staffType }` |
| DELETE | /buses/:id/staff/:staffUserId | owner (own) | Unassign staff |
| POST/GET | /routes | owner | Create, list own routes |
| GET/PATCH/DELETE | /routes/:id | owner (own) | Route detail, update, delete |
| PUT | /routes/:id/stops | owner (own) | Replace ordered stop list |
| POST | /routes/:id/buses | owner (own) | Assign bus to route |
| POST/GET | /schedules | owner | Create, list own schedules |
| PATCH/DELETE | /schedules/:id | owner (own) | Update, remove |
| POST | /schedules/:id/trips | owner (own) | Generate dated trips |

## Search, trips, bookings, tickets (FR-06–08) — PM (UI: Module 2)
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | /trips/search?from=&to=&date= | any | Search trips |
| GET | /trips/:id | any | Trip detail with seat availability |
| POST | /bookings | passenger | Create booking `{ tripId, pickupStopId, dropoffStopId, seats[] }`; server computes fare and claims seats |
| GET | /bookings | passenger | Own booking history |
| GET | /bookings/:id | passenger (own) / owner | Booking detail |
| POST | /bookings/:id/cancel | passenger (own) | Cancel |
| GET | /tickets/:id | passenger (own) | Ticket with QR token and readable reference |
| POST | /tickets/verify | staff (assigned trip) | Verify `{ qrToken }`; marks used; rate limited |
| GET | /staff/trips | staff | Assigned trips |

## Payments and revenue (FR-09, FR-10) — M4
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /payments | passenger | Start (mock) payment for a booking |
| GET | /payments/:id | passenger (own) / owner | Payment status |
| GET | /owner/payments | owner | Own bus payments |
| GET | /owner/revenue?from=&to=&busId= | owner | Collections and revenue summary |

## Tracking and notifications (FR-11–13, FR-17) — M3
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /trips/:id/start, /trips/:id/end | staff (assigned) | Change trip status |
| POST | /trips/:id/location | staff (assigned, trip active) | Submit `{ lat, lng, accuracy }` |
| GET | /trips/:id/location | passenger with booking / owner / staff | Latest location with timestamp |
| POST | /bookings/:id/pickup-point | passenger (own) | Set pickup coordinates and approach distance |
| GET | /notifications | any | Own notifications |
| PATCH | /notifications/:id/read | any (own) | Mark read |
| GET | /health | public | Health check |

### Booking lifecycle (implemented)
`POST /bookings` creates a `pending` booking and holds the seats (unique `(tripId, seatNumber)` reservation; conflicts return 409 `BOOKING_SEAT_TAKEN` with nothing held). The fare is computed on the server. A booking becomes `confirmed` and its ticket is issued by the server-side `confirmBooking` step, which the payment flow (Module 4) calls after a successful payment. Cancelling frees the seats and cancels the ticket. `POST /tickets/verify` atomically marks a valid ticket `used` (replays return 409 `TICKET_ALREADY_USED`; staff not assigned to the trip get 403).

Each endpoint's request/response schemas are added here by its owner in the same PR that implements it.
