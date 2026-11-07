import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';

useTestDb();
const app = createApp();

async function setup() {
  const w = await buildWorld(app);
  const pax = await registerUser(app);
  const b = (await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
    tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1, 2],
  })).body.data;
  return { w, pax, b };
}
const types = async (user) =>
  (await request(app).get('/api/v1/notifications').set(bearer(user))).body.data.map((n) => n.type).reverse();
const pay = (pax, bookingId, simulate) =>
  request(app).post('/api/v1/payments').set(bearer(pax)).send({ bookingId, method: 'mock_card', simulate });

describe('booking and payment notifications (FR-17)', () => {
  it('notifies the passenger when a booking is created', async () => {
    const { pax } = await setup();
    expect(await types(pax)).toEqual(['booking_created']);
  });

  it('notifies the passenger of payment success and confirmation, and the bus owner of the booking', async () => {
    const { w, pax, b } = await setup();
    await pay(pax, b._id, 'success');
    expect(await types(pax)).toEqual(['booking_created', 'payment_success', 'booking_confirmed']);
    const ownerNotes = (await request(app).get('/api/v1/notifications').set(bearer(w.owner))).body.data;
    expect(ownerNotes.map((n) => n.type)).toEqual(['booking_confirmed']);
    expect(ownerNotes[0].message).toMatch(/2 seat/);
  });

  it('notifies a failed payment and does not confirm', async () => {
    const { w, pax, b } = await setup();
    await pay(pax, b._id, 'fail');
    expect(await types(pax)).toEqual(['booking_created', 'payment_failed']);
    expect(await types(w.owner)).toEqual([]);
  });

  it('notifies cancellation of an unpaid booking without a refund notice', async () => {
    const { pax, b } = await setup();
    await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    expect(await types(pax)).toEqual(['booking_created', 'booking_cancelled']);
  });

  it('notifies the refund when a paid booking is cancelled', async () => {
    const { pax, b } = await setup();
    await pay(pax, b._id, 'success');
    await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    const notes = (await request(app).get('/api/v1/notifications').set(bearer(pax))).body.data;
    expect(notes.map((n) => n.type).reverse()).toEqual(['booking_created', 'payment_success', 'booking_confirmed', 'booking_cancelled', 'payment_refunded']);
    expect(notes[0].message).toMatch(/Rs\. 800 has been refunded/);
  });

  it('confirms only once even if confirmation is triggered again', async () => {
    const { pax, b } = await setup();
    const { confirmBooking } = await import('../src/services/bookings.js');
    await confirmBooking(b._id);
    await confirmBooking(b._id);
    expect((await types(pax)).filter((t) => t === 'booking_confirmed')).toHaveLength(1);
  });

  it('notifies the outcome of a pending payment settled by the gateway callback', async () => {
    process.env.MOCK_GATEWAY_SECRET = 's3cret';
    const { pax, b } = await setup();
    const p = (await pay(pax, b._id, 'pending')).body.data.payment;
    await request(app).post('/api/v1/payments/mock-gateway/callback').set('x-mock-gateway-secret', 's3cret').send({ transactionId: p.transactionId, status: 'failed' });
    expect(await types(pax)).toEqual(['booking_created', 'payment_failed']);
  });

  it('does not notify anyone when a booking attempt fails on a taken seat', async () => {
    const { w } = await setup();
    const other = await registerUser(app);
    const res = await request(app).post('/api/v1/bookings').set(bearer(other)).send({
      tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1],
    });
    expect(res.status).toBe(409);
    expect(await types(other)).toEqual([]);
  });

  it('keeps notifications private to their recipient', async () => {
    const { pax } = await setup();
    const other = await registerUser(app);
    expect(await types(other)).toEqual([]);
    expect((await types(pax)).length).toBeGreaterThan(0);
  });
});
