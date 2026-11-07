import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { expireStalePending, newTransactionId, settlePayment } from '../services/payments.js';

// Mock/sandbox payments only (decision D-004). .strict() rejects any extra field, so card data can never be sent.
const payBody = z.object({
  bookingId: z.string(),
  method: z.enum(['mock_card', 'mock_wallet']),
  simulate: z.enum(['success', 'fail', 'pending']).default('success'),
}).strict();
const callbackBody = z.object({ transactionId: z.string().min(5).max(64), status: z.enum(['success', 'failed']) }).strict();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const revenueQuery = z.object({ from: day.optional(), to: day.optional(), busId: z.string().optional() });

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notFound = (m = 'Resource not found') => new AppError(404, 'NOT_FOUND', m);
const sum = (list) => list.reduce((s, p) => s + p.amount, 0);

// ---------- passenger payments ----------
export const paymentRouter = Router();
paymentRouter.use(authenticate);

paymentRouter.post('/', requireRole('passenger'), validate(payBody), wrap(async (req, res) => {
  const { bookingId, method, simulate } = req.body;
  if (!mongoose.isValidObjectId(bookingId)) throw notFound('Booking not found');
  const booking = await Booking.findById(bookingId);
  if (!booking || String(booking.passengerId) !== String(req.user.id)) throw notFound('Booking not found');
  if (booking.status !== 'pending') throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking cannot be paid');
  const trip = await Trip.findById(booking.tripId);
  if (!trip || trip.status !== 'scheduled') throw new AppError(422, 'TRIP_NOT_PAYABLE', 'This trip is no longer open for payment');

  await expireStalePending(booking.id);
  let payment;
  try {
    // The amount always comes from the server-computed booking fare.
    payment = await Payment.create({ bookingId, amount: booking.fare, method, transactionId: newTransactionId(), status: 'pending' });
  } catch (err) {
    // The partial unique index allows one open (pending/successful) payment per booking, even under concurrent requests.
    if (err.code === 11000) throw new AppError(409, 'PAYMENT_EXISTS', 'A payment for this booking is already in progress or complete');
    throw err;
  }
  let ticket;
  if (simulate !== 'pending') ({ payment, ticket } = await settlePayment(payment.id, simulate === 'success' ? 'success' : 'failed'));
  ok(res, { payment, ticketId: ticket?.id }, `Payment ${payment.status}`, 201);
}));

paymentRouter.get('/', requireRole('passenger'), wrap(async (req, res) => {
  const bookingIds = await Booking.find({ passengerId: req.user.id }).distinct('_id');
  ok(res, await Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }), 'Payments');
}));

paymentRouter.get('/:id', validIdParams('id'), wrap(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  const booking = payment && (await Booking.findById(payment.bookingId));
  if (!booking) throw notFound('Payment not found');
  let allowed = String(booking.passengerId) === String(req.user.id);
  if (!allowed && req.user.role === 'owner') {
    const trip = await Trip.findById(booking.tripId);
    const bus = trip && (await Bus.findById(trip.busId));
    allowed = Boolean(bus) && String(bus.ownerId) === String(req.user.id);
  }
  if (!allowed) throw notFound('Payment not found');
  ok(res, payment, 'Payment');
}));

// ---------- mock gateway callback (sandbox stand-in for a real provider's webhook) ----------
export const mockGatewayRouter = Router();

function checkGatewaySecret(req) {
  const expected = process.env.MOCK_GATEWAY_SECRET;
  if (!expected) throw notFound(); // disabled unless explicitly configured
  const given = Buffer.from(String(req.get('x-mock-gateway-secret') ?? ''));
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Invalid gateway signature');
  }
}

mockGatewayRouter.post('/callback', validate(callbackBody), wrap(async (req, res) => {
  checkGatewaySecret(req);
  const payment = await Payment.findOne({ transactionId: req.body.transactionId });
  if (!payment) throw notFound('Unknown transaction');
  if (payment.status !== 'pending') {
    // Gateways retry callbacks: repeating the same final outcome is acknowledged, a contradicting one is refused.
    if ((req.body.status === 'success' && ['success', 'refunded'].includes(payment.status)) || (req.body.status === 'failed' && payment.status === 'failed')) {
      return ok(res, { payment }, 'Already processed');
    }
    throw new AppError(409, 'PAYMENT_NOT_PENDING', 'Payment is no longer pending');
  }
  const result = await settlePayment(payment.id, req.body.status);
  ok(res, { payment: result.payment, ticketId: result.ticket?.id }, `Payment ${result.payment.status}`);
}));

// ---------- owner payments, revenue and trip collections ----------
export const ownerRevenueRouter = Router();
ownerRevenueRouter.use(authenticate, requireRole('owner'));

/** Payments on the given buses, each tagged with its busId. */
async function paymentsForBuses(busIds, filter = {}) {
  const trips = await Trip.find({ busId: { $in: busIds } }, { busId: 1 });
  const busOfTrip = new Map(trips.map((t) => [String(t._id), String(t.busId)]));
  const bookings = await Booking.find({ tripId: { $in: trips.map((t) => t._id) } }, { tripId: 1 });
  const busOfBooking = new Map(bookings.map((b) => [String(b._id), busOfTrip.get(String(b.tripId))]));
  const payments = await Payment.find({ bookingId: { $in: bookings.map((b) => b._id) }, ...filter }).sort({ createdAt: -1 });
  return payments.map((p) => ({ payment: p, busId: busOfBooking.get(String(p.bookingId)) }));
}

ownerRevenueRouter.get('/payments', wrap(async (req, res) => {
  const buses = await Bus.find({ ownerId: req.user.id }).distinct('_id');
  ok(res, (await paymentsForBuses(buses)).map((x) => x.payment), 'Payments');
}));

ownerRevenueRouter.get('/revenue', validate(revenueQuery, 'query'), wrap(async (req, res) => {
  const { from, to, busId } = req.query;
  let buses = await Bus.find({ ownerId: req.user.id }, { registrationNumber: 1 });
  if (busId) {
    buses = buses.filter((b) => String(b._id) === busId);
    if (!buses.length) throw notFound('Bus not found');
  }
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  const inRange = (d) => (!range.$gte || d >= range.$gte) && (!range.$lte || d <= range.$lte);

  const all = await paymentsForBuses(buses.map((b) => b._id), { status: { $in: ['success', 'refunded'] } });
  const earned = all.filter((x) => x.payment.status === 'success' && inRange(x.payment.createdAt));
  const refunded = all.filter((x) => x.payment.status === 'refunded' && inRange(x.payment.refundedAt ?? x.payment.updatedAt));

  const byDay = {};
  for (const { payment: p } of earned) {
    const d = p.createdAt.toISOString().slice(0, 10);
    byDay[d] = byDay[d] ?? { date: d, total: 0, count: 0 };
    byDay[d].total += p.amount;
    byDay[d].count += 1;
  }
  const byBus = buses.map((b) => {
    const mine = earned.filter((x) => x.busId === String(b._id)).map((x) => x.payment);
    return { busId: String(b._id), registrationNumber: b.registrationNumber, total: sum(mine), count: mine.length };
  });
  ok(res, {
    total: sum(earned.map((x) => x.payment)),
    count: earned.length,
    refunded: { total: sum(refunded.map((x) => x.payment)), count: refunded.length },
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    byBus,
  }, 'Revenue summary');
}));

ownerRevenueRouter.get('/trips/:id/collections', validIdParams('id'), wrap(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  const bus = trip && (await Bus.findById(trip.busId));
  if (!bus || String(bus.ownerId) !== String(req.user.id)) throw notFound('Trip not found');
  const bookings = await Booking.find({ tripId: trip.id });
  const payments = await Payment.find({ bookingId: { $in: bookings.map((b) => b._id) } });
  const by = (s) => payments.filter((p) => p.status === s);
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  ok(res, {
    tripId: trip.id, date: trip.date, departureTime: trip.departureTime, status: trip.status,
    bus: { id: bus.id, registrationNumber: bus.registrationNumber, capacity: bus.capacity },
    seatsSold: confirmed.reduce((s, b) => s + b.seats.length, 0),
    confirmedBookings: confirmed.length,
    collected: sum(by('success')),
    pending: sum(by('pending')),
    refunded: sum(by('refunded')),
  }, 'Trip collections');
}));
