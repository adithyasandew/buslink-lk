# Socket.IO Event Contract

Owner: Module 3 (`adithyasandew`). Socket.IO delivers live updates only; REST and the database remain the source of truth. A room name is not authorization — the server checks identity and trip access before joining or broadcasting.

## Connection
Client connects with the JWT in `auth: { token }`. Invalid or expired tokens are rejected (`connect_error`, code `AUTH_REQUIRED`).

## Rooms
`trip:<tripId>` — joinable only by: a passenger with a confirmed booking on the trip, the trip's owner, or assigned staff. `user:<userId>` — joined automatically for the authenticated user (notifications).

## Client → server
| Event | Sender | Payload | Rules |
|---|---|---|---|
| `trip:join` | any authorized | `{ tripId }` | Ack `{ ok, error? }` |
| `trip:leave` | any | `{ tripId }` | |
| `location:update` | assigned staff | `{ tripId, lat, lng, accuracy, recordedAt }` | Trip must be `active`; persisted, then broadcast; rate limited |

## Server → client
| Event | Room | Payload |
|---|---|---|
| `location:updated` | `trip:<id>` | `{ tripId, lat, lng, accuracy, recordedAt, stale }` |
| `trip:status` | `trip:<id>` | `{ tripId, status, at }` |
| `bus:approaching` | `user:<id>` | `{ tripId, bookingId, distanceMeters, thresholdMeters, at }` |
| `notification:new` | `user:<id>` | `{ id, type, message, createdAt }` |

Errors are sent as `{ code, message }` using the codes in ERROR_FORMAT.md. Clients show the timestamp and treat locations older than the staleness limit as stale.
