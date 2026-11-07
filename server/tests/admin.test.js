import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, makeAdmin, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import { confirmBooking } from '../src/services/bookings.js';

useTestDb();
const app = createApp();
const get = (t, path) => request(app).get(`/api/v1${path}`).set(bearer(t));
const patch = (t, path, body) => request(app).patch(`/api/v1${path}`).set(bearer(t)).send(body);
const post = (t, path, body) => request(app).post(`/api/v1${path}`).set(bearer(t)).send(body);

describe('user administration', () => {
  it('lists users with filters and pagination, for admins only', async () => {
    const admin = await makeAdmin(app);
    await registerUser(app); await registerUser(app); await registerUser(app, 'owner');
    const all = await get(admin, '/users?limit=2');
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta).toMatchObject({ page: 1, limit: 2, total: 4 });
    expect((await get(admin, '/users?role=owner')).body.data).toHaveLength(1);
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash/);
    expect((await get(await registerUser(app), '/users')).status).toBe(403);
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
    expect((await get(admin, '/users?limit=500')).status).toBe(400);
  });

  it('suspends a user (who can then no longer log in) but never lets an admin change themselves', async () => {
    const admin = await makeAdmin(app);
    const pax = await registerUser(app);
    const res = await patch(admin, `/users/${pax.user.id}`, { status: 'suspended' });
    expect(res.body.data.status).toBe('suspended');
    expect((await get(pax, '/auth/me')).status).toBe(401);
    const self = await patch(admin, `/users/${admin.user.id}`, { status: 'suspended' });
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe('CANNOT_MODIFY_SELF');
    expect((await patch(admin, `/users/${pax.user.id}`, {})).status).toBe(400);
    expect((await patch(admin, `/users/${pax.user.id}`, { passwordHash: 'x', status: 'active' })).status).toBe(400);
    expect((await get(admin, '/users/not-an-id')).status).toBe(404);
  });
});

describe('verification', () => {
  it('lets admins verify owners and buses, notifying the owner; others are refused', async () => {
    const admin = await makeAdmin(app);
    const w = await buildWorld(app);
    const ov = await patch(admin, `/owners/${w.owner.user.id}/verify`, { verified: true });
    expect(ov.body.data.ownerVerified).toBe(true);
    const bv = await patch(admin, `/buses/${w.bus._id}/verify`, { verified: true });
    expect(bv.body.data.status).toBe('verified');
    const notes = (await get(w.owner, '/notifications')).body.data.map((n) => n.type);
    expect(notes).toEqual(expect.arrayContaining(['owner_verification', 'bus_verification']));
    expect((await patch(w.owner, `/buses/${w.bus._id}/verify`, { verified: true })).status).toBe(403);
    expect((await patch(admin, `/owners/${(await registerUser(app)).user.id}/verify`, { verified: true })).status).toBe(404);
  });

  it('stops an owner activating an unverified bus', async () => {
    const admin = await makeAdmin(app);
    const w = await buildWorld(app);
    const denied = await patch(w.owner, `/buses/${w.bus._id}`, { status: 'active' });
    expect(denied.status).toBe(422);
    expect(denied.body.error.code).toBe('BUS_NOT_VERIFIED');
    await patch(admin, `/buses/${w.bus._id}/verify`, { verified: true });
    expect((await patch(w.owner, `/buses/${w.bus._id}`, { status: 'active' })).body.data.status).toBe('active');
  });

  it('shows an overview to admins only', async () => {
    const admin = await makeAdmin(app);
    await registerUser(app); await buildWorld(app);
    const res = await get(admin, '/admin/overview');
    expect(res.body.data.usersByRole).toMatchObject({ admin: 1, owner: 1, passenger: 1 });
    expect(res.body.data.busesByStatus.pending).toBe(1);
    expect((await get(await registerUser(app), '/admin/overview')).status).toBe(403);
  });
});

describe('complaints', () => {
  it('lets passengers file complaints and see only their own; admins see all and move them through the lifecycle', async () => {
    const admin = await makeAdmin(app);
    const a = await registerUser(app); const b = await registerUser(app);
    const c = (await post(a, '/complaints', { details: 'The bus was 40 minutes late and the driver was rude.' })).body.data;
    expect(c.status).toBe('open');
    await post(b, '/complaints', { details: 'Seat was broken and nobody helped me.' });
    expect((await get(a, '/complaints')).body.data).toHaveLength(1);
    expect((await get(admin, '/complaints')).body.data).toHaveLength(2);
    expect((await get(admin, '/complaints?status=resolved')).body.data).toHaveLength(0);

    expect((await patch(admin, `/complaints/${c._id}`, { status: 'resolved' })).status).toBe(422); // must be reviewed first
    expect((await patch(admin, `/complaints/${c._id}`, { status: 'in_review' })).body.data.status).toBe('in_review');
    expect((await patch(admin, `/complaints/${c._id}`, { status: 'resolved' })).body.data.status).toBe('resolved');
    expect((await patch(admin, `/complaints/${c._id}`, { status: 'rejected' })).body.error.code).toBe('INVALID_STATUS_TRANSITION');
    const notes = (await get(a, '/notifications')).body.data;
    expect(notes.filter((n) => n.type === 'complaint_update')).toHaveLength(2);
  });

  it('validates input and enforces roles', async () => {
    const admin = await makeAdmin(app);
    const a = await registerUser(app);
    expect((await post(a, '/complaints', { details: 'short' })).status).toBe(400);
    expect((await post(admin, '/complaints', { details: 'Admins cannot file complaints here.' })).status).toBe(403);
    const c = (await post(a, '/complaints', { details: 'A valid, sufficiently long complaint.' })).body.data;
    expect((await patch(a, `/complaints/${c._id}`, { status: 'in_review' })).status).toBe(403);
    expect((await get(await registerUser(app, 'owner'), '/complaints')).status).toBe(403);
  });
});

describe('feedback', () => {
  async function completedTrip() {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    const b = (await post(pax, '/bookings', { tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1] })).body.data;
    await confirmBooking(b._id);
    return { w, pax };
  }

  it('accepts one rating per completed trip from a confirmed passenger', async () => {
    const { w, pax } = await completedTrip();
    expect((await post(pax, '/feedback', { tripId: w.tripId, rating: 5 })).body.error.code).toBe('TRIP_NOT_COMPLETED');
    await post(w.staff, `/trips/${w.tripId}/start`, {});
    await post(w.staff, `/trips/${w.tripId}/end`, {});
    const ok = await post(pax, '/feedback', { tripId: w.tripId, rating: 4, feedback: 'Smooth ride' });
    expect(ok.status).toBe(201);
    expect((await post(pax, '/feedback', { tripId: w.tripId, rating: 5 })).body.error.code).toBe('FEEDBACK_EXISTS');
    expect((await post(pax, '/feedback', { tripId: w.tripId, rating: 6 })).status).toBe(400);
  });

  it('refuses passengers who did not travel', async () => {
    const { w } = await completedTrip();
    const stranger = await registerUser(app);
    expect((await post(stranger, '/feedback', { tripId: w.tripId, rating: 5 })).status).toBe(404);
  });
});

describe('ratings overview and routing safety', () => {
  async function ratedTrip(rating) {
    const w = await buildWorld(app);
    const pax = await registerUser(app);
    const b = (await post(pax, '/bookings', { tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1] })).body.data;
    await confirmBooking(b._id);
    await post(w.staff, `/trips/${w.tripId}/start`, {});
    await post(w.staff, `/trips/${w.tripId}/end`, {});
    await post(pax, '/feedback', { tripId: w.tripId, rating, feedback: 'ok' });
    return { w, pax }
  }

  it('lets admins list ratings with the average; others are refused', async () => {
    const admin = await makeAdmin(app);
    const { pax } = await ratedTrip(5);
    await ratedTrip(2);
    const res = await get(admin, '/feedback');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ count: 2, average: 3.5 });
    expect((await get(pax, '/feedback')).status).toBe(403);
  });

  it('rejects a complaint about a trip that does not exist', async () => {
    const pax = await registerUser(app);
    const res = await post(pax, '/complaints', { tripId: '64b7f0f0f0f0f0f0f0f0f0f0', details: 'The bus never arrived at my stop.' });
    expect(res.status).toBe(404);
  });

  it('keeps unknown URLs as 404 for anonymous users (admin guard is per route)', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/api/v1/admin/overview')).status).toBe(401);
  });
});
