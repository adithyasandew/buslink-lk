import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { createApp } from '../src/app.js';
import Trip from '../src/models/Trip.js';

useTestDb();
const app = createApp();
const stops = [
  { name: 'Colombo', lat: 6.93, lng: 79.86, fareFromStart: 0 },
  { name: 'Kegalle', lat: 7.25, lng: 80.34, fareFromStart: 250 },
  { name: 'Kandy', lat: 7.29, lng: 80.63, fareFromStart: 400 },
];

async function setup(owner) {
  const bus = (await request(app).post('/api/v1/buses').set(bearer(owner)).send({ registrationNumber: `NB-${Math.floor(Math.random() * 9000 + 1000)}`, capacity: 50 })).body.data;
  const route = (await request(app).post('/api/v1/routes').set(bearer(owner)).send({ name: 'Colombo-Kandy', startPoint: 'Colombo', destination: 'Kandy' })).body.data;
  return { bus, route };
}

describe('routes and stops', () => {
  it('creates a route, saves ordered stops and assigns an own bus', async () => {
    const owner = await registerUser(app, 'owner');
    const { bus, route } = await setup(owner);
    const put = await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops });
    expect(put.status).toBe(200);
    expect(put.body.data.map((s) => s.order)).toEqual([0, 1, 2]);
    const assigned = await request(app).post(`/api/v1/routes/${route._id}/buses`).set(bearer(owner)).send({ busId: bus._id });
    expect(assigned.body.data.assignedBusIds).toContain(bus._id);
    const detail = await request(app).get(`/api/v1/routes/${route._id}`).set(bearer(owner));
    expect(detail.body.data.stops.map((s) => s.name)).toEqual(['Colombo', 'Kegalle', 'Kandy']);
  });

  it('rejects decreasing fares and too few stops, and replaces stops on re-save', async () => {
    const owner = await registerUser(app, 'owner');
    const { route } = await setup(owner);
    const bad = [stops[0], { ...stops[1], fareFromStart: 500 }, stops[2]];
    const r = await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops: bad });
    expect(r.status).toBe(400);
    expect((await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops: [stops[0]] })).status).toBe(400);
    await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops });
    await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops: stops.slice(0, 2) });
    expect((await request(app).get(`/api/v1/routes/${route._id}`).set(bearer(owner))).body.data.stops).toHaveLength(2);
  });

  it("isolates owners and refuses assigning someone else's bus", async () => {
    const a = await registerUser(app, 'owner');
    const b = await registerUser(app, 'owner');
    const { bus, route } = await setup(a);
    const other = await setup(b);
    expect((await request(app).get(`/api/v1/routes/${route._id}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(b)).send({ stops })).status).toBe(404);
    expect((await request(app).post(`/api/v1/routes/${other.route._id}/buses`).set(bearer(b)).send({ busId: bus._id })).status).toBe(404);
    expect((await request(app).get('/api/v1/routes').set(bearer(b))).body.data).toHaveLength(1);
  });
});

describe('schedules and trip generation', () => {
  async function scheduled(owner, extra = {}) {
    const { bus, route } = await setup(owner);
    await request(app).post(`/api/v1/routes/${route._id}/buses`).set(bearer(owner)).send({ busId: bus._id });
    const res = await request(app).post('/api/v1/schedules').set(bearer(owner)).send({
      busId: bus._id, routeId: route._id, departureTime: '06:30', arrivalTime: '10:00', operatingDays: [1, 3, 5], ...extra,
    });
    return { bus, route, schedule: res.body.data, res };
  }

  it('requires the bus to be assigned to the route and validates times', async () => {
    const owner = await registerUser(app, 'owner');
    const { bus, route } = await setup(owner);
    const body = { busId: bus._id, routeId: route._id, departureTime: '06:30', arrivalTime: '10:00', operatingDays: [1] };
    const unassigned = await request(app).post('/api/v1/schedules').set(bearer(owner)).send(body);
    expect(unassigned.status).toBe(422);
    expect(unassigned.body.error.code).toBe('BUS_NOT_ON_ROUTE');
    const badTime = await request(app).post('/api/v1/schedules').set(bearer(owner)).send({ ...body, departureTime: '25:00' });
    expect(badTime.status).toBe(400);
  });

  it('creates, lists, updates and deactivates schedules', async () => {
    const owner = await registerUser(app, 'owner');
    const { schedule, res } = await scheduled(owner);
    expect(res.status).toBe(201);
    expect((await request(app).get('/api/v1/schedules').set(bearer(owner))).body.data).toHaveLength(1);
    const upd = await request(app).patch(`/api/v1/schedules/${schedule._id}`).set(bearer(owner)).send({ departureTime: '07:00' });
    expect(upd.body.data.departureTime).toBe('07:00');
    const del = await request(app).delete(`/api/v1/schedules/${schedule._id}`).set(bearer(owner));
    expect(del.body.data.active).toBe(false);
    expect((await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(owner)).send({ from: '2026-11-09', to: '2026-11-15' })).status).toBe(422);
  });

  it('generates trips only on operating days, with assigned staff, idempotently', async () => {
    const owner = await registerUser(app, 'owner');
    const { bus, schedule } = await scheduled(owner);
    const staff = (await request(app).post('/api/v1/staff').set(bearer(owner)).send({ name: 'Kamal D', email: 'k@example.lk', password: 'password123' })).body.data;
    await request(app).post(`/api/v1/buses/${bus._id}/staff`).set(bearer(owner)).send({ staffUserId: staff.id, staffType: 'driver' });
    // 2026-11-09 is a Monday; Mon/Wed/Fri => 9, 11, 13
    const gen = await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(owner)).send({ from: '2026-11-09', to: '2026-11-15' });
    expect(gen.body.data.created).toEqual(['2026-11-09', '2026-11-11', '2026-11-13']);
    const trips = await Trip.find({});
    expect(trips).toHaveLength(3);
    expect(String(trips[0].staffIds[0])).toBe(staff.id);
    const again = await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(owner)).send({ from: '2026-11-09', to: '2026-11-15' });
    expect(again.body.data.created).toEqual([]);
    expect(await Trip.countDocuments()).toBe(3);
  });

  it('limits the generation range and isolates owners', async () => {
    const a = await registerUser(app, 'owner');
    const b = await registerUser(app, 'owner');
    const { schedule } = await scheduled(a);
    const big = await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(a)).send({ from: '2026-11-01', to: '2026-12-31' });
    expect(big.status).toBe(400);
    expect((await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(b)).send({ from: '2026-11-09', to: '2026-11-10' })).status).toBe(404);
    expect((await request(app).patch(`/api/v1/schedules/${schedule._id}`).set(bearer(b)).send({ departureTime: '08:00' })).status).toBe(404);
    expect((await request(app).get('/api/v1/schedules').set(bearer(b))).body.data).toHaveLength(0);
  });
});
