import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { registerUser, bearer } from './helpers/users.js';
import { buildWorld } from './helpers/world.js';
import { createApp } from '../src/app.js';
import Payment from '../src/models/Payment.js';

useTestDb();
const app = createApp();

async function booked(seats = [1]) {
  const w = await buildWorld(app);
  const pax = await registerUser(app);
  const b = (await request(app).post('/api/v1/bookings').set(bearer(pax)).send({
    tripId: w.tripId, pickupStopId: w.pickup._id, dropoffStopId: w.dropoff._id, seats,
  })).body.data;
  return { w, pax, b };
}
const pay = (pax, bookingId, extra = {}) =>
  request(app).post('/api/v1/payments').set(bearer(pax)).send({ bookingId, method: 'mock_card', ...extra });

describe('payments (mock)', () => {
  it('a successful payment uses the server fare, confirms the booking and issues a ticket', async () => {
    const { pax, b } = await booked([1, 2]);
    const res = await pay(pax, b._id);
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({ amount: 800, status: 'success', mock: true });
    expect(res.body.data.payment.transactionId).toMatch(/^MOCK-/);
    expect(res.body.data.ticketId).toBeTruthy();
    const booking = await request(app).get(`/api/v1/bookings/${b._id}`).set(bearer(pax));
    expect(booking.body.data.status).toBe('confirmed');
    const ticket = await request(app).get(`/api/v1/tickets/${res.body.data.ticketId}`).set(bearer(pax));
    expect(ticket.status).toBe(200);
  });

  it('rejects any client-supplied amount or card data', async () => {
    const { pax, b } = await booked();
    for (const extra of [{ amount: 1 }, { cardNumber: '4111111111111111' }, { cvv: '123' }]) {
      const res = await pay(pax, b._id, extra);
      expect(res.status).toBe(400);
    }
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('a failed payment leaves the booking pending and allows a retry', async () => {
    const { pax, b } = await booked();
    const failed = await pay(pax, b._id, { simulate: 'fail' });
    expect(failed.body.data.payment.status).toBe('failed');
    expect(failed.body.data.ticketId).toBeUndefined();
    expect((await request(app).get(`/api/v1/bookings/${b._id}`).set(bearer(pax))).body.data.status).toBe('pending');
    expect((await pay(pax, b._id)).body.data.payment.status).toBe('success');
  });

  it('blocks double payment, paying cancelled bookings, and other passengers', async () => {
    const { pax, b } = await booked();
    const other = await registerUser(app);
    expect((await pay(other, b._id)).status).toBe(404);
    expect((await pay(pax, b._id, { simulate: 'pending' })).body.data.payment.status).toBe('pending');
    const dup = await pay(pax, b._id);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PAYMENT_EXISTS');
    const c = await booked();
    await request(app).post(`/api/v1/bookings/${c.b._id}/cancel`).set(bearer(c.pax));
    expect((await pay(c.pax, c.b._id)).body.error.code).toBe('BOOKING_NOT_PAYABLE');
  });

  it('shows payment details only to the payer and the bus owner', async () => {
    const { w, pax, b } = await booked();
    const id = (await pay(pax, b._id)).body.data.payment._id;
    expect((await request(app).get(`/api/v1/payments/${id}`).set(bearer(pax))).status).toBe(200);
    expect((await request(app).get(`/api/v1/payments/${id}`).set(bearer(w.owner))).status).toBe(200);
    expect((await request(app).get(`/api/v1/payments/${id}`).set(bearer(await registerUser(app, 'owner')))).status).toBe(404);
    expect((await request(app).get(`/api/v1/payments/${id}`).set(bearer(await registerUser(app)))).status).toBe(404);
  });
});

describe('owner payments and revenue', () => {
  it('sums only successful payments for the owner’s own buses', async () => {
    const a = await booked([1, 2]);
    const b = await booked([1]);
    await pay(a.pax, a.b._id);
    await pay(b.pax, b.b._id, { simulate: 'fail' });
    const rev = await request(app).get('/api/v1/owner/revenue').set(bearer(a.w.owner));
    expect(rev.status).toBe(200);
    expect(rev.body.data).toMatchObject({ total: 800, count: 1 });
    expect(rev.body.data.byDay).toHaveLength(1);
    const list = await request(app).get('/api/v1/owner/payments').set(bearer(a.w.owner));
    expect(list.body.data).toHaveLength(1);
    const other = await request(app).get('/api/v1/owner/revenue').set(bearer(b.w.owner));
    expect(other.body.data).toMatchObject({ total: 0, count: 0 });
  });

  it('filters by bus and date, and denies passengers and foreign buses', async () => {
    const a = await booked();
    await pay(a.pax, a.b._id);
    const ok = await request(app).get('/api/v1/owner/revenue').query({ busId: a.w.bus._id, from: '2000-01-01', to: '2099-12-31' }).set(bearer(a.w.owner));
    expect(ok.body.data.total).toBe(400);
    const none = await request(app).get('/api/v1/owner/revenue').query({ from: '2000-01-01', to: '2000-01-02' }).set(bearer(a.w.owner));
    expect(none.body.data.total).toBe(0);
    const other = await registerUser(app, 'owner');
    expect((await request(app).get('/api/v1/owner/revenue').query({ busId: a.w.bus._id }).set(bearer(other))).status).toBe(404);
    expect((await request(app).get('/api/v1/owner/revenue').set(bearer(a.pax))).status).toBe(403);
  });
});
