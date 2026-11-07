# API Response and Error Format

## Success
```json
{ "success": true, "data": { }, "message": "Human-readable summary" }
```
List endpoints add `meta`: `{ "page": 1, "limit": 20, "total": 134 }`. Pagination query: `?page=1&limit=20` (limit max 100).

## Error
```json
{ "success": false, "error": { "code": "BOOKING_SEAT_TAKEN", "message": "Safe message", "details": [ { "field": "seats", "message": "Seat 4 is no longer available" } ] } }
```
`details` is optional (validation errors list one entry per field). Stack traces and internals are never returned in production.

## HTTP status mapping
| Status | When | Example codes |
|---|---|---|
| 400 | Invalid input | `VALIDATION_ERROR` |
| 401 | Missing/expired/invalid token | `AUTH_REQUIRED`, `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS` |
| 403 | Role or ownership violation | `FORBIDDEN_ROLE`, `FORBIDDEN_OWNERSHIP` |
| 404 | Resource not found | `NOT_FOUND` |
| 409 | State conflict | `BOOKING_SEAT_TAKEN`, `TICKET_ALREADY_USED`, `EMAIL_IN_USE` |
| 422 | Valid shape, invalid business rule | `TRIP_NOT_ACTIVE`, `PAYMENT_NOT_CONFIRMED` |
| 429 | Rate limited | `RATE_LIMITED` |
| 500 | Unexpected | `INTERNAL_ERROR` |

Codes are stable UPPER_SNAKE_CASE strings; frontends branch on `code`, never on `message`. A single centralized Express error handler produces every error response.
