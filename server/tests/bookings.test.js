import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import { confirmBooking } from '../src/services/bookings.js';
import SeatReservation from '../src/models/SeatReservation.js';

useTestDb();
const app = createApp();
const book = (token, w, seats, extra = {}) =>
  request(app).post('/api/v1/bookings').set(bearer(token)).send({ tripId: w.tripId, pickupStopId: w.pickup.id ?? w.pickup._id, dropoffStopId: w.dropoff.id ?? w.dropoff._id, seats, ...extra });

describe('trip search and detail', () => {
  it('finds trips between ordered stops with server-computed fare and availability', async () => {
    const w = await buildWorld(app);
    const res = await request(app).get('/api/v1/trips/search').query({ from: 'colombo', to: 'KANDY', date: '2026-11-09' });
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ fare: 400, capacity: 10, seatsAvailable: 10, departureTime: '06:30' });
    const reverse = await request(app).get('/api/v1/trips/search').query({ from: 'Kandy', to: 'Colombo', date: '2026-11-09' });
    expect(reverse.body.data).toHaveLength(0);
    const detail = await request(app).get(`/api/v1/trips/${w.tripId}`);
    expect(detail.body.data.stops.map((s) => s.name)).toEqual(['Colombo', 'Kegalle', 'Kandy']);
    expect(detail.body.data.takenSeats).toEqual([]);
  });

  it('validates search input', async () => {
    expect((await request(app).get('/api/v1/trips/search').query({ from: 'A' })).status).toBe(400);
    expect((await request(app).get('/api/v1/trips/not-an-id')).status).toBe(404);
  });
});

describe('booking', () => {
  it('books seats, computes the fare on the server and reflects availability', async () => {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    const res = await book(pax, w, [1, 2], { fare: 1 }); // client-sent fare is ignored
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ fare: 800, status: 'pending', seats: [1, 2] });
    const detail = await request(app).get(`/api/v1/trips/${w.tripId}`);
    expect(detail.body.data.takenSeats).toEqual([1, 2]);
    const mid = await book(await registerUser(app), w, [3], { dropoffStopId: w.mid._id });
    expect(mid.body.data.fare).toBe(250);
  });

  it('rejects a taken seat without leaving partial reservations', async () => {
    const w = await buildWorld(app);
    await book(await registerUser(app), w, [1]);
    const other = await registerUser(app);
    const res = await book(other, w, [2, 1]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_SEAT_TAKEN');
    expect(await SeatReservation.countDocuments({ tripId: w.tripId })).toBe(1);
    expect((await request(app).get('/api/v1/bookings').set(bearer(other))).body.data).toHaveLength(0);
  });

  it('never double-books a seat under concurrent requests', async () => {
    const w = await buildWorld(app);
    const users = await Promise.all(Array.from({ length: 6 }, () => registerUser(app)));
    const results = await Promise.all(users.map((u) => book(u, w, [5])));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await SeatReservation.countDocuments({ tripId: w.tripId, seatNumber: 5 })).toBe(1);
  });

  it('validates seats, stops and roles', async () => {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    expect((await book(pax, w, [11])).status).toBe(400);
    expect((await book(pax, w, [0])).status).toBe(400);
    expect((await book(pax, w, [2, 2])).status).toBe(400);
    expect((await book(pax, w, [1], { pickupStopId: w.dropoff._id, dropoffStopId: w.pickup._id })).status).toBe(400);
    expect((await book(pax, w, [1], { tripId: 'nope' })).status).toBe(404);
    expect((await book(w.owner, w, [1])).status).toBe(403);
    expect((await request(app).post('/api/v1/bookings').send({})).status).toBe(401);
  });

  it('cancels, frees the seats and hides bookings from other users', async () => {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    const other = await registerUser(app);
    const b = (await book(pax, w, [4])).body.data;
    expect((await request(app).get(`/api/v1/bookings/${b._id}`).set(bearer(other))).status).toBe(404);
    expect((await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(other))).status).toBe(404);
    expect((await request(app).get(`/api/v1/bookings/${b._id}`).set(bearer(w.owner))).status).toBe(200);
    expect((await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax))).body.data.status).toBe('cancelled');
    expect((await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax))).status).toBe(409);
    expect((await book(other, w, [4])).status).toBe(201);
  });
});

describe('tickets', () => {
  async function confirmed() {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    const b = (await book(pax, w, [1])).body.data;
    const { ticket } = await confirmBooking(b._id);
    return { w, pax, b, ticket };
  }

  it('issues one ticket per confirmed booking, visible only to its passenger', async () => {
    const { pax, b, ticket } = await confirmed();
    expect(ticket.ticketRef).toMatch(/^BL-[0-9A-F]{10}$/);
    expect((await confirmBooking(b._id)).ticket.id).toBe(ticket.id); // idempotent
    const mine = await request(app).get(`/api/v1/tickets/${ticket.id}`).set(bearer(pax));
    expect(mine.status).toBe(200);
    expect(mine.body.data.seats).toEqual([1]);
    const other = await registerUser(app);
    expect((await request(app).get(`/api/v1/tickets/${ticket.id}`).set(bearer(other))).status).toBe(404);
  });

  it('QR token carries no personal data', async () => {
    const { ticket } = await confirmed();
    expect(ticket.qrToken).toMatch(/^[0-9a-f]{48}$/);
  });

  it('lets assigned staff verify once; replays are rejected', async () => {
    const { w, ticket } = await confirmed();
    const ok = await request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: ticket.qrToken });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('used');
    const replay = await request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: ticket.qrToken });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('TICKET_ALREADY_USED');
  });

  it('only one of many simultaneous scans succeeds', async () => {
    const { w, ticket } = await confirmed();
    const rs = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: ticket.qrToken })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('rejects unassigned staff, passengers, unknown tokens and cancelled tickets', async () => {
    const { w, pax, b, ticket } = await confirmed();
    const w2 = await buildWorld(app, { date: '2026-11-10' });
    const wrongStaff = await request(app).post('/api/v1/tickets/verify').set(bearer(w2.staff)).send({ qrToken: ticket.qrToken });
    expect(wrongStaff.status).toBe(403);
    expect((await request(app).post('/api/v1/tickets/verify').set(bearer(pax)).send({ qrToken: ticket.qrToken })).status).toBe(403);
    expect((await request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: 'f'.repeat(48) })).status).toBe(404);
    await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    const cancelled = await request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: ticket.qrToken });
    expect(cancelled.status).toBe(422);
  });

  it('shows staff their assigned trips', async () => {
    const w = await buildWorld(app, { date: '2099-01-05' });
    const res = await request(app).get('/api/v1/staff/trips').set(bearer(w.staff));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/staff/trips').set(bearer(w.owner))).status).toBe(403);
  });
});
