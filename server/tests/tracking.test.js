import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import { confirmBooking } from '../src/services/bookings.js';
import BusLocation from '../src/models/BusLocation.js';
import Notification from '../src/models/Notification.js';

useTestDb();
const app = createApp();

async function tripWithPassenger() {
  const w = await buildWorld(app);
  const pax = await registerUser(app);
  const b = (await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
    tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1],
  })).body.data;
  await confirmBooking(b._id);
  return { w, pax, b };
}
const start = (w) => request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.staff));
const send = (w, lat, lng, extra = {}) =>
  request(app).post(`/api/v1/trips/${w.tripId}/location`).set(bearer(w.staff)).send({ lat, lng, ...extra });

describe('public trip endpoints stay public', () => {
  it('search is still reachable without a token', async () => {
    const w = await buildWorld(app);
    expect(w.tripId).toBeTruthy();
    expect((await request(app).get(`/api/v1/trips/${w.tripId}`)).status).toBe(200);
  });
});

describe('trip lifecycle', () => {
  it('assigned staff start and end a trip; passengers are notified', async () => {
    const { w, pax } = await tripWithPassenger();
    expect((await start(w)).body.data.status).toBe('active');
    expect((await start(w)).status).toBe(422);
    const end = await request(app).post(`/api/v1/trips/${w.tripId}/end`).set(bearer(w.staff));
    expect(end.body.data.status).toBe('completed');
    const notes = await request(app).get('/api/v1/notifications').set(bearer(pax));
    expect(notes.body.data.map((n) => n.type)).toEqual(['trip_status', 'trip_status']);
  });

  it('refuses unassigned staff, owners and passengers', async () => {
    const { w, pax } = await tripWithPassenger();
    const other = await buildWorld(app, { date: '2026-11-10' });
    expect((await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(other.staff))).status).toBe(404);
    expect((await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.owner))).status).toBe(403);
    expect((await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(pax))).status).toBe(403);
    expect((await request(app).post(`/api/v1/trips/${w.tripId}/start`)).status).toBe(401);
  });
});

describe('location sharing', () => {
  it('accepts locations only for an active trip from assigned staff, and validates them', async () => {
    const { w } = await tripWithPassenger();
    expect((await send(w, 7, 80)).body.error.code).toBe('TRIP_NOT_ACTIVE');
    await start(w);
    expect((await send(w, 7, 80, { accuracy: 12 })).status).toBe(201);
    expect(await BusLocation.countDocuments({ tripId: w.tripId })).toBe(1);
    expect((await send(w, 91, 80)).status).toBe(400);
    expect((await send(w, 7, 80, { driverPhone: '077' })).status).toBe(400);
    const other = await buildWorld(app, { date: '2026-11-10' });
    const foreign = await request(app).post(`/api/v1/trips/${w.tripId}/location`).set(bearer(other.staff)).send({ lat: 7, lng: 80 });
    expect(foreign.status).toBe(404);
  });

  it('shows the latest location only to authorised users, with staleness', async () => {
    const { w, pax } = await tripWithPassenger();
    await start(w);
    await send(w, 7.1, 80.1);
    await send(w, 7.2, 80.2);
    const get = (t) => request(app).get(`/api/v1/trips/${w.tripId}/location`).set(bearer(t));
    const mine = await get(pax);
    expect(mine.body.data.location).toMatchObject({ lat: 7.2, lng: 80.2, stale: false });
    expect((await get(w.owner)).status).toBe(200);
    expect((await get(w.staff)).status).toBe(200);
    expect((await get(await registerUser(app))).status).toBe(404);          // passenger without a booking
    expect((await get(await registerUser(app, 'owner'))).status).toBe(404); // other owner
    await BusLocation.updateMany({}, { recordedAt: new Date(Date.now() - 10 * 60 * 1000) });
    expect((await get(pax)).body.data.location.stale).toBe(true);
  });

  it('does not share location for an unpaid (pending) booking', async () => {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
      tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [3],
    });
    await start(w);
    await send(w, 7, 80);
    const res = await request(app).get(`/api/v1/trips/${w.tripId}/location`).set(bearer(pax));
    expect(res.status).toBe(404);
  });
});

describe('approaching-bus notification', () => {
  // Colombo stop is at 6.93, 79.86. ~0.002 deg lat is ~220 m.
  it('notifies once when the bus enters the threshold, not before and not again', async () => {
    const { w, pax, b } = await tripWithPassenger();
    await start(w);
    const far = await send(w, 7.2, 80.2);
    expect(far.body.data.notified).toBe(0);
    const near = await send(w, 6.932, 79.86);
    expect(near.body.data.notified).toBe(1);
    const again = await send(w, 6.9315, 79.86);
    expect(again.body.data.notified).toBe(0);
    const notes = (await request(app).get('/api/v1/notifications').set(bearer(pax))).body.data;
    const approaching = notes.filter((n) => n.type === 'bus_approaching');
    expect(approaching).toHaveLength(1);
    expect(String(approaching[0].relatedId)).toBe(b._id);
  });

  it('honours a custom pickup point and distance, and ignores unconfirmed bookings', async () => {
    const { w, pax, b } = await tripWithPassenger();
    const set = await request(app).post(`/api/v1/bookings/${b._id}/pickup-point`).set(bearer(pax)).send({ lat: 7.25, lng: 80.34, approachDistanceMeters: 1000 });
    expect(set.status).toBe(200);
    await start(w);
    expect((await send(w, 6.932, 79.86)).body.data.notified).toBe(0); // near the stop, not near the custom point
    expect((await send(w, 7.255, 80.34)).body.data.notified).toBe(1); // ~550 m from the custom point
  });

  it('is atomic under concurrent location updates', async () => {
    const { w, pax } = await tripWithPassenger();
    await start(w);
    await Promise.all(Array.from({ length: 5 }, () => send(w, 6.932, 79.86)));
    expect(await Notification.countDocuments({ userId: (await request(app).get('/api/v1/auth/me').set(bearer(pax))).body.data.id, type: 'bus_approaching' })).toBe(1);
  });

  it('validates and protects the pickup-point endpoint', async () => {
    const { pax, b } = await tripWithPassenger();
    const url = `/api/v1/bookings/${b._id}/pickup-point`;
    expect((await request(app).post(url).set(bearer(pax)).send({ lat: 7, lng: 80, approachDistanceMeters: 5 })).status).toBe(400);
    expect((await request(app).post(url).set(bearer(await registerUser(app))).send({ lat: 7, lng: 80 })).status).toBe(404);
  });
});

describe('notifications API', () => {
  it('lists own notifications and marks them read, but not other users’', async () => {
    const { w, pax } = await tripWithPassenger();
    await start(w);
    const [n] = (await request(app).get('/api/v1/notifications').set(bearer(pax))).body.data;
    expect(n.status).toBe('unread');
    expect((await request(app).patch(`/api/v1/notifications/${n._id}/read`).set(bearer(await registerUser(app)))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/notifications/${n._id}/read`).set(bearer(pax))).body.data.status).toBe('read');
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });
});
