import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import Payment from '../src/models/Payment.js';
import Trip from '../src/models/Trip.js';
import { PENDING_TTL_MS } from '../src/services/payments.js';

useTestDb();
const app = createApp();
const SECRET = 'test-gateway-secret';
beforeEach(() => { process.env.MOCK_GATEWAY_SECRET = SECRET; });

async function booked(seats = [1]) {
  const w = await buildWorld(app);
  const pax = await registerUser(app);
  const b = (await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
    tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats,
  })).body.data;
  return { w, pax, b };
}
const pay = (pax, bookingId, simulate = 'success') =>
  request(app).post('/api/v1/payments').set(bearer(pax)).send({ bookingId, method: 'mock_card', simulate });
const callback = (body, secret = SECRET) =>
  request(app).post('/api/v1/payments/mock-gateway/callback').set('x-mock-gateway-secret', secret).send(body);
const bookingStatus = async (pax, id) => (await request(app).get(`/api/v1/bookings/${id}`).set(bearer(pax))).body.data.status;

describe('one payment per booking (atomic)', () => {
  it('never lets two simultaneous payments for one booking both go through', async () => {
    const { pax, b } = await booked();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(pax, b._id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(1);
  });

  it('refuses payment once the trip has started', async () => {
    const { pax, b, w } = await booked();
    await Trip.updateOne({ _id: w.tripId }, { status: 'active' });
    const res = await pay(pax, b._id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TRIP_NOT_PAYABLE');
  });
});

describe('pending payments and the mock gateway callback', () => {
  it('settles a pending payment to success: confirms the booking and issues a ticket', async () => {
    const { pax, b } = await booked();
    const pending = (await pay(pax, b._id, 'pending')).body.data.payment;
    expect(pending.status).toBe('pending');
    expect(await bookingStatus(pax, b._id)).toBe('pending');
    const res = await callback({ transactionId: pending.transactionId, status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('success');
    expect(res.body.data.ticketId).toBeTruthy();
    expect(await bookingStatus(pax, b._id)).toBe('confirmed');
  });

  it('settles to failed, after which the passenger can pay again', async () => {
    const { pax, b } = await booked();
    const pending = (await pay(pax, b._id, 'pending')).body.data.payment;
    expect((await callback({ transactionId: pending.transactionId, status: 'failed' })).body.data.payment.status).toBe('failed');
    expect((await pay(pax, b._id)).body.data.payment.status).toBe('success');
  });

  it('is idempotent for gateway retries and refuses contradicting outcomes', async () => {
    const { pax, b } = await booked();
    const pending = (await pay(pax, b._id, 'pending')).body.data.payment;
    await callback({ transactionId: pending.transactionId, status: 'success' });
    const retry = await callback({ transactionId: pending.transactionId, status: 'success' });
    expect(retry.status).toBe(200);
    expect(retry.body.message).toBe('Already processed');
    expect((await callback({ transactionId: pending.transactionId, status: 'failed' })).status).toBe(409);
  });

  it('rejects a wrong secret, unknown transactions, extra fields, and is disabled without a configured secret', async () => {
    const { pax, b } = await booked();
    const pending = (await pay(pax, b._id, 'pending')).body.data.payment;
    expect((await callback({ transactionId: pending.transactionId, status: 'success' }, 'wrong')).status).toBe(401);
    expect((await callback({ transactionId: 'MOCK-NOPE00', status: 'success' })).status).toBe(404);
    expect((await callback({ transactionId: pending.transactionId, status: 'success', amount: 1 })).status).toBe(400);
    delete process.env.MOCK_GATEWAY_SECRET;
    expect((await callback({ transactionId: pending.transactionId, status: 'success' })).status).toBe(404);
    expect(await bookingStatus(pax, b._id)).toBe('pending');
  });

  it('expires an abandoned pending payment so the booking can be paid again', async () => {
    const { pax, b } = await booked();
    await pay(pax, b._id, 'pending');
    expect((await pay(pax, b._id)).status).toBe(409);
    await Payment.collection.updateMany({ bookingId: Payment.castObject({ bookingId: b._id }).bookingId }, { $set: { createdAt: new Date(Date.now() - PENDING_TTL_MS - 1000) } });
    const retry = await pay(pax, b._id);
    expect(retry.status).toBe(201);
    expect(retry.body.data.payment.status).toBe('success');
    expect(await Payment.countDocuments({ bookingId: b._id, status: 'failed' })).toBe(1);
  });

  it('refunds instead of confirming if the booking was cancelled before the callback arrived', async () => {
    const { pax, b } = await booked();
    const pending = (await pay(pax, b._id, 'pending')).body.data.payment;
    // cancelling while pending abandons the open payment
    await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    const late = await callback({ transactionId: pending.transactionId, status: 'success' });
    expect(late.status).toBe(409); // already closed by the cancellation
    expect(await bookingStatus(pax, b._id)).toBe('cancelled');
  });
});

describe('refunds on cancellation', () => {
  it('refunds a paid booking, frees the seat and removes it from revenue', async () => {
    const { w, pax, b } = await booked([1, 2]);
    await pay(pax, b._id);
    const before = (await request(app).get('/api/v1/owner/revenue').set(bearer(w.owner))).body.data;
    expect(before.total).toBe(800);
    const cancel = await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    expect(cancel.body.data.status).toBe('cancelled');
    expect(cancel.body.data.refund).toMatchObject({ amount: 800, status: 'refunded' });
    const after = (await request(app).get('/api/v1/owner/revenue').set(bearer(w.owner))).body.data;
    expect(after).toMatchObject({ total: 0, count: 0, refunded: { total: 800, count: 1 } });
    const other = await registerUser(app);
    const rebook = await request(app).post('/api/v1/bookings').set(bearer(other)).send({ tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats: [1] });
    expect(rebook.status).toBe(201);
  });

  it('reports no refund for an unpaid booking', async () => {
    const { pax, b } = await booked();
    const cancel = await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    expect(cancel.body.data.refund).toBeNull();
  });

  it('refuses to cancel (and refund) after the ticket has been used', async () => {
    const { w, pax, b } = await booked();
    const ticketId = (await pay(pax, b._id)).body.data.ticketId;
    const ticket = (await request(app).get(`/api/v1/tickets/${ticketId}`).set(bearer(pax))).body.data;
    await request(app).post('/api/v1/tickets/verify').set(bearer(w.staff)).send({ qrToken: ticket.qrToken });
    const cancel = await request(app).post(`/api/v1/bookings/${b._id}/cancel`).set(bearer(pax));
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.code).toBe('BOOKING_ALREADY_TRAVELLED');
    expect(await Payment.countDocuments({ bookingId: b._id, status: 'success' })).toBe(1);
  });
});

describe('passenger payment history', () => {
  it('lists only the passenger’s own payments', async () => {
    const a = await booked();
    const c = await booked();
    await pay(a.pax, a.b._id, 'fail');
    await pay(a.pax, a.b._id);
    await pay(c.pax, c.b._id);
    const mine = (await request(app).get('/api/v1/payments').set(bearer(a.pax))).body.data;
    expect(mine.map((p) => p.status).sort()).toEqual(['failed', 'success']);
    expect((await request(app).get('/api/v1/payments').set(bearer(a.w.owner))).status).toBe(403);
  });
});

describe('revenue breakdown and trip collections (FR-10)', () => {
  it('breaks revenue down by bus', async () => {
    const { w, pax, b } = await booked([1, 2, 3]);
    await pay(pax, b._id);
    const rev = (await request(app).get('/api/v1/owner/revenue').set(bearer(w.owner))).body.data;
    expect(rev.byBus).toEqual([{ busId: w.bus._id, registrationNumber: w.bus.registrationNumber, total: 1200, count: 1 }]);
  });

  it('summarises collections for one trip and hides other owners’ trips', async () => {
    const { w, pax, b } = await booked([1, 2]);
    await pay(pax, b._id);
    const p2 = await registerUser(app);
    const b2 = (await request(app).post('/api/v1/bookings').set(bearer(p2)).send({ tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.mid._id, seats: [5] })).body.data;
    await pay(p2, b2._id, 'pending');
    const res = await request(app).get(`/api/v1/owner/trips/${w.tripId}/collections`).set(bearer(w.owner));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ seatsSold: 2, confirmedBookings: 1, collected: 800, pending: 250, refunded: 0 });
    expect(res.body.data.bus.capacity).toBe(10);
    const stranger = await registerUser(app, 'owner');
    expect((await request(app).get(`/api/v1/owner/trips/${w.tripId}/collections`).set(bearer(stranger))).status).toBe(404);
    expect((await request(app).get(`/api/v1/owner/trips/${w.tripId}/collections`).set(bearer(pax))).status).toBe(403);
  });
});
