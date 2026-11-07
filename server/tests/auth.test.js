import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { useTestDb } from './helpers/db.js';
import { createApp } from '../src/app.js';
import { authenticate, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errors.js';
import User from '../src/models/User.js';

useTestDb();
const app = createApp();
const creds = { name: 'Nimal Perera', email: 'Nimal@Example.lk', password: 'password123' };

describe('POST /auth/register', () => {
  it('registers a passenger, hashes the password and never returns it', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'nimal@example.lk', role: 'passenger' });
    expect(res.body.data.token).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const stored = await User.findOne({ email: 'nimal@example.lk' }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe(creds.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('allows owner registration but refuses privileged roles', async () => {
    const owner = await request(app).post('/api/v1/auth/register').send({ ...creds, role: 'owner' });
    expect(owner.status).toBe(201);
    expect(owner.body.data.user.ownerVerified).toBe(false);
    const admin = await request(app).post('/api/v1/auth/register').send({ ...creds, email: 'a@x.lk', role: 'admin' });
    expect(admin.status).toBe(400);
    expect(admin.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails and weak input', async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
    const dup = await request(app).post('/api/v1/auth/register').send(creds);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_IN_USE');
    const weak = await request(app).post('/api/v1/auth/register').send({ ...creds, email: 'b@x.lk', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details[0].field).toBe('password');
  });
});

describe('POST /auth/login and GET /auth/me', () => {
  it('logs in and returns the current user for the token', async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'nimal@example.lk', password: creds.password });
    expect(login.status).toBe(200);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('nimal@example.lk');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'nimal@example.lk', password: 'nope-nope' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@example.lk', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('blocks suspended users from logging in', async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
    await User.updateOne({ email: 'nimal@example.lk' }, { status: 'suspended' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nimal@example.lk', password: creds.password });
    expect(res.status).toBe(401);
  });

  it('rejects missing and garbage tokens', async () => {
    expect((await request(app).get('/api/v1/auth/me')).body.error.code).toBe('AUTH_REQUIRED');
    const bad = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(bad.status).toBe(401);
  });
});

describe('requireRole', () => {
  const guarded = express();
  guarded.get('/owner-only', authenticate, requireRole('owner'), (_req, res) => res.json({ ok: true }));
  guarded.use(errorHandler);

  it('allows the right role and returns 403 for others', async () => {
    const pass = await request(app).post('/api/v1/auth/register').send(creds);
    const own = await request(app).post('/api/v1/auth/register').send({ ...creds, email: 'o@x.lk', role: 'owner' });
    const denied = await request(guarded).get('/owner-only').set('Authorization', `Bearer ${pass.body.data.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN_ROLE');
    const ok = await request(guarded).get('/owner-only').set('Authorization', `Bearer ${own.body.data.token}`);
    expect(ok.status).toBe(200);
  });
});
