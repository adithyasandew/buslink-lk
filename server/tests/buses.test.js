import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { createApp } from '../src/app.js';

useTestDb();
const app = createApp();
const bus = { registrationNumber: 'NB-1234', model: 'Ashok Leyland', capacity: 52 };

describe('bus management', () => {
  it('lets an owner register, list, update and deactivate their own bus', async () => {
    const owner = await registerUser(app, 'owner');
    const created = await request(app).post('/api/v1/buses').set(bearer(owner)).send(bus);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ registrationNumber: 'NB-1234', status: 'pending' });
    const id = created.body.data._id;
    expect((await request(app).get('/api/v1/buses').set(bearer(owner))).body.data).toHaveLength(1);
    const upd = await request(app).patch(`/api/v1/buses/${id}`).set(bearer(owner)).send({ capacity: 40 });
    expect(upd.body.data.capacity).toBe(40);
    const del = await request(app).delete(`/api/v1/buses/${id}`).set(bearer(owner));
    expect(del.body.data.status).toBe('inactive');
  });

  it('validates input and rejects duplicate registration numbers', async () => {
    const owner = await registerUser(app, 'owner');
    const bad = await request(app).post('/api/v1/buses').set(bearer(owner)).send({ ...bus, capacity: 0 });
    expect(bad.status).toBe(400);
    await request(app).post('/api/v1/buses').set(bearer(owner)).send(bus);
    const dup = await request(app).post('/api/v1/buses').set(bearer(owner)).send(bus);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('BUS_EXISTS');
  });

  it('denies passengers and anonymous users', async () => {
    const pass = await registerUser(app, 'passenger');
    expect((await request(app).post('/api/v1/buses').set(bearer(pass)).send(bus)).status).toBe(403);
    expect((await request(app).get('/api/v1/buses')).status).toBe(401);
  });

  it("isolates owners: another owner's bus looks like it does not exist", async () => {
    const a = await registerUser(app, 'owner');
    const b = await registerUser(app, 'owner');
    const id = (await request(app).post('/api/v1/buses').set(bearer(a)).send(bus)).body.data._id;
    expect((await request(app).get(`/api/v1/buses/${id}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).patch(`/api/v1/buses/${id}`).set(bearer(b)).send({ capacity: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/buses/${id}`).set(bearer(b))).status).toBe(404);
    expect((await request(app).get('/api/v1/buses').set(bearer(b))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/buses/not-an-id').set(bearer(a))).status).toBe(404);
  });
});

describe('bus staff management', () => {
  const staff = { name: 'Kamal Driver', email: 'kamal@example.lk', password: 'password123' };

  it('creates staff, assigns them to an own bus and unassigns', async () => {
    const owner = await registerUser(app, 'owner');
    const busId = (await request(app).post('/api/v1/buses').set(bearer(owner)).send(bus)).body.data._id;
    const s = await request(app).post('/api/v1/staff').set(bearer(owner)).send(staff);
    expect(s.status).toBe(201);
    expect(s.body.data.role).toBe('staff');
    expect(JSON.stringify(s.body)).not.toMatch(/passwordHash/);
    expect((await request(app).get('/api/v1/staff').set(bearer(owner))).body.data).toHaveLength(1);

    const a = await request(app).post(`/api/v1/buses/${busId}/staff`).set(bearer(owner)).send({ staffUserId: s.body.data.id, staffType: 'driver' });
    expect(a.status).toBe(201);
    expect(a.body.data.staffType).toBe('driver');
    const un = await request(app).delete(`/api/v1/buses/${busId}/staff/${s.body.data.id}`).set(bearer(owner));
    expect(un.body.data.status).toBe('inactive');
  });

  it("will not assign another owner's staff or a foreign bus", async () => {
    const a = await registerUser(app, 'owner');
    const b = await registerUser(app, 'owner');
    const aBus = (await request(app).post('/api/v1/buses').set(bearer(a)).send(bus)).body.data._id;
    const bStaff = (await request(app).post('/api/v1/staff').set(bearer(b)).send(staff)).body.data.id;
    const r1 = await request(app).post(`/api/v1/buses/${aBus}/staff`).set(bearer(a)).send({ staffUserId: bStaff, staffType: 'driver' });
    expect(r1.status).toBe(404);
    const r2 = await request(app).post(`/api/v1/buses/${aBus}/staff`).set(bearer(b)).send({ staffUserId: bStaff, staffType: 'driver' });
    expect(r2.status).toBe(404);
  });

  it('staff can log in and rejects duplicate emails', async () => {
    const owner = await registerUser(app, 'owner');
    await request(app).post('/api/v1/staff').set(bearer(owner)).send(staff);
    expect((await request(app).post('/api/v1/staff').set(bearer(owner)).send(staff)).status).toBe(409);
    const login = await request(app).post('/api/v1/auth/login').send({ email: staff.email, password: staff.password });
    expect(login.body.data.user.role).toBe('staff');
  });
});
