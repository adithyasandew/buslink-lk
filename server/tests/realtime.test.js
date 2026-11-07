import http from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import { attachRealtime } from '../src/realtime.js';
import { confirmBooking } from '../src/services/bookings.js';

useTestDb();
const app = createApp();
let server; let io; let url; const clients = [];

beforeAll(async () => {
  server = http.createServer(app);
  io = attachRealtime(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await new Promise((r) => io.close(r));
});

const client = (token) => {
  const c = connect(url, { auth: { token }, reconnection: false, forceNew: true });
  clients.push(c);
  return c;
};
const connected = (c) => new Promise((res, rej) => { c.on('connect', () => res(c)); c.on('connect_error', rej); });
const emitAck = (c, ev, payload) => new Promise((res) => c.emit(ev, payload, res));
const next = (c, ev, ms = 3000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}`)), ms);
  c.once(ev, (d) => { clearTimeout(t); res(d); });
});
const silent = (c, ev, ms = 300) => new Promise((res, rej) => {
  c.once(ev, () => rej(new Error(`unexpected ${ev}`)));
  setTimeout(res, ms);
});

async function world() {
  const w = await buildWorld(app);
  const pax = await registerUser(app);
  const b = (await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
    tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1],
  })).body.data;
  await confirmBooking(b._id);
  return { w, pax, b };
}

describe('socket authentication', () => {
  it('rejects missing and invalid tokens', async () => {
    await expect(connected(client(undefined))).rejects.toMatchObject({ message: 'AUTH_REQUIRED' });
    await expect(connected(client('garbage'))).rejects.toMatchObject({ message: 'AUTH_REQUIRED' });
  });
});

describe('trip rooms', () => {
  it('lets a confirmed passenger, the owner and assigned staff join; refuses everyone else', async () => {
    const { w, pax } = await world();
    const stranger = await registerUser(app);
    const otherOwner = await registerUser(app, 'owner');
    for (const t of [pax, w.owner, w.staff]) {
      expect(await emitAck(await connected(client(t.token)), 'trip:join', { tripId: w.tripId })).toEqual({ ok: true });
    }
    for (const t of [stranger, otherOwner]) {
      const res = await emitAck(await connected(client(t.token)), 'trip:join', { tripId: w.tripId });
      expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    }
    expect(await emitAck(await connected(client(pax.token)), 'trip:join', { tripId: 'nope' })).toMatchObject({ ok: false });
  });
});

describe('live updates', () => {
  it('broadcasts staff location (socket and REST) and trip status to joined users only', async () => {
    const { w, pax } = await world();
    const paxSock = await connected(client(pax.token));
    const staffSock = await connected(client(w.staff.token));
    const outsider = await connected(client((await registerUser(app)).token));
    await emitAck(paxSock, 'trip:join', { tripId: w.tripId });

    const status = next(paxSock, 'trip:status');
    await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.staff));
    expect((await status).status).toBe('active');

    const viaSocket = next(paxSock, 'location:updated');
    const ack = await emitAck(staffSock, 'location:update', { tripId: w.tripId, lat: 7.2, lng: 80.2, accuracy: 10 });
    expect(ack).toEqual({ ok: true });
    expect(await viaSocket).toMatchObject({ tripId: w.tripId, lat: 7.2, lng: 80.2, stale: false });

    const viaRest = next(paxSock, 'location:updated');
    await request(app).post(`/api/v1/trips/${w.tripId}/location`).set(bearer(w.staff)).send({ lat: 7.21, lng: 80.2 });
    expect((await viaRest).lat).toBe(7.21);
    await silent(outsider, 'location:updated');
  });

  it('only assigned staff can push locations over the socket, and only for active trips', async () => {
    const { w, pax } = await world();
    const other = await buildWorld(app, { date: '2026-11-10' });
    const staffSock = await connected(client(w.staff.token));
    expect(await emitAck(staffSock, 'location:update', { tripId: w.tripId, lat: 7, lng: 80 })).toMatchObject({ ok: false, error: { code: 'TRIP_NOT_ACTIVE' } });
    await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.staff));
    const foreign = await connected(client(other.staff.token));
    expect(await emitAck(foreign, 'location:update', { tripId: w.tripId, lat: 7, lng: 80 })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const paxSock = await connected(client(pax.token));
    expect(await emitAck(paxSock, 'location:update', { tripId: w.tripId, lat: 7, lng: 80 })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN_ROLE' } });
    expect(await emitAck(staffSock, 'location:update', { tripId: w.tripId, lat: 999, lng: 80 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('delivers bus:approaching and notification:new to the passenger without joining a room', async () => {
    const { w, pax } = await world();
    const paxSock = await connected(client(pax.token));
    await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.staff));
    const approaching = next(paxSock, 'bus:approaching');
    const note = next(paxSock, 'notification:new');
    await request(app).post(`/api/v1/trips/${w.tripId}/location`).set(bearer(w.staff)).send({ lat: 6.932, lng: 79.86 });
    expect(await approaching).toMatchObject({ tripId: w.tripId, thresholdMeters: 500 });
    expect((await note).type).toBeTruthy();
  });

  it("does not leak one passenger's approach alert to another user", async () => {
    const { w } = await world();
    const bystander = await connected(client((await registerUser(app)).token));
    await request(app).post(`/api/v1/trips/${w.tripId}/start`).set(bearer(w.staff));
    const quiet = Promise.all([silent(bystander, 'bus:approaching'), silent(bystander, 'notification:new')]);
    await request(app).post(`/api/v1/trips/${w.tripId}/location`).set(bearer(w.staff)).send({ lat: 6.932, lng: 79.86 });
    await quiet;
  });
});
