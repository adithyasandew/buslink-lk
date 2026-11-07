# Database Design (preliminary)

Project start: 2026-10-04. Based on proposal Section 11 and master plan §16. MongoDB via Mongoose. Proposed items were approved by the PM on 2026-11-07 (decision D-006 in `docs/architecture/DECISIONS.md`).
Shared models and schema changes are owned by `adithyasandew` (see TEAM_RESPONSIBILITY_MATRIX.md).

## Conventions
- All collections use `timestamps: true` (`createdAt`, `updatedAt`) and Mongoose validation.
- Passwords are stored only as bcrypt hashes in `passwordHash`; never returned by the API.
- No card numbers, CVVs, or personal data in QR payloads. Seed data is synthetic only.
- Ownership and role rules are enforced in the service layer as well as the schema.

## Collections

| Collection | Key fields | Indexes / constraints |
|---|---|---|
| `users` | name, email, passwordHash, role (`passenger`\|`owner`\|`staff`\|`admin`), phone, status (`active`\|`suspended`\|`pending`), ownerVerified (owners) | unique `email` |
| `buses` | ownerId→users, registrationNumber, model, capacity, seatLayout, status (`pending`\|`verified`\|`active`\|`inactive`) | unique `registrationNumber` (proposed); index `ownerId` |
| `busstaffassignments` | staffUserId→users, busId→buses, staffType (`driver`\|`conductor`), status | index `busId`, `staffUserId` |
| `routes` | ownerId, name, startPoint, destination, assignedBusIds[] | index `ownerId` |
| `stops` | routeId→routes, name, location {lat,lng}, order, fareFromStart | unique `(routeId, order)` |
| `schedules` | busId, routeId, departureTime, arrivalTime, operatingDays[], active | index `(routeId, departureTime)` |
| `trips` | scheduleId, busId, routeId, staffIds[], date, departureTime, status (`scheduled`\|`active`\|`completed`\|`cancelled`) | index `(routeId, date)`, `(busId, date)` |
| `seatreservations` | tripId, seatNumber, bookingId | **unique `(tripId, seatNumber)`** — atomic overbooking guard (proposed) |
| `bookings` | passengerId, tripId, pickupStopId, dropoffStopId, seats[], fare (server-computed), status (`pending`\|`confirmed`\|`cancelled`\|`rejected`) | index `(passengerId, createdAt)`, `tripId` |
| `tickets` | bookingId, ticketRef, qrToken (opaque, no personal data), fare, status (`valid`\|`used`\|`cancelled`), verifiedBy, verifiedAt | unique `ticketRef`, unique `bookingId` |
| `payments` | bookingId, amount, method, transactionId, status (`pending`\|`success`\|`failed`\|`refunded`), mock flag | unique `transactionId`; index `bookingId` |
| `buslocations` | busId, tripId, lat, lng, accuracy, recordedAt | index `(tripId, recordedAt)`; TTL index to expire history (proposed) |
| `notifications` | userId, type, message, status (`unread`\|`read`), relatedId | index `(userId, createdAt)` |
| `feedbackcomplaints` | passengerId, tripId, kind (`rating`\|`complaint`), rating, feedback, details, status (`open`\|`in_review`\|`resolved`\|`rejected`) | index `status` |

## Proposed answers to open design questions
1. **Bus Staff:** a `users` row with role `staff`, linked to buses through `busstaffassignments` (single combined role per D-005).
2. **Stops:** separate collection with explicit `order`, so ordering and fares are queryable.
3. **Seats:** a booking may hold multiple seats; each seat is claimed by inserting into `seatreservations` (unique index prevents double allocation without requiring transactions).
4. **Fare:** computed on the server from stop fares between pickup and drop-off; the client never supplies a price.
5. **Trips:** generated from schedules per operating day (by the owner or a job); one trip is one dated journey.
6. **State transitions:** booking `pending → confirmed | rejected | cancelled`; payment `pending → success | failed`, `success → refunded`; ticket `valid → used | cancelled`; trip `scheduled → active → completed`, `scheduled → cancelled`. A confirmed booking requires a successful payment (mock first, per D-004).
7. **Location:** latest position is served from `buslocations`; history is kept briefly via TTL; location accepted only for `active` trips from assigned staff (per D-003, still proposed).
8. **Notifications:** in-app first; email optional later.
9. **Complaints:** `open → in_review → resolved | rejected`, handled by admins.
10. **Verification:** admins verify owners and buses (`ownerVerified`, bus `status`).

## Module touchpoints
Module 1: buses, staff assignments, routes, stops, schedules. Module 2: trips, bookings, tickets. Module 3: trips (status), buslocations, notifications. Module 4: payments. Module 5: users, feedbackcomplaints.
