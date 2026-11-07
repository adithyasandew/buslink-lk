# Architecture Overview

Project start: 2026-10-04. Source: submitted proposal (Section 10) and master development plan (Part I).

## Style
Three-layer web application in a monorepo: `client/` (React + Vite + Tailwind CSS), `server/` (Node.js + Express), MongoDB via Mongoose.

```text
Passenger / Bus Owner / Bus Staff / Administrator
                  |
        React + Vite + Tailwind  (client/)
                  |  Axios REST        ^ Socket.IO
                  v                    |
        Node.js + Express API  (server/)
        JWT+RBAC | Business logic | Socket.IO
                  |
            MongoDB (Mongoose)

Bus Staff device --Geolocation API--> Express/Socket.IO
Frontend map <-- Leaflet + OpenStreetMap; OSRM for route/distance support
```

## Rules
- REST handles CRUD and transactional operations; Socket.IO handles live updates only and never replaces authorization or persistence.
- Backend is the source of truth for seat availability, booking state, ticket validity, roles and trip status.
- Every protected operation is validated and authorized on the server; hiding UI is not security.
- Prices, seat reservation and ticket validity are never computed or declared by the browser.
- Secrets live in environment variables; only `.env.example` is committed.
- Consistent response shape `{ success, data, message }` and a stable error shape with centralized handling (details in the API contract docs).
- Location is collected only for an active, assigned trip from an authorized Bus Staff account.

## Roles
Passenger, Bus Owner, Bus Staff (one combined driver/conductor role), Administrator.

## Module boundaries
See [TEAM_RESPONSIBILITY_MATRIX.md](../TEAM_RESPONSIBILITY_MATRIX.md). Module 5 supplies the shared auth/RBAC contract; other modules must use it rather than build their own.

## Testing and delivery
Vitest, Supertest and Playwright; GitHub Actions CI; Docker Compose for local setup.
