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
import { confirmBooking } from '../services/bookings.js';

// Mock/sandbox payments only (decision D-004). .strict() rejects any extra field, so card data can never be sent.
const payBody = z.object({
  bookingId: z.string(),
  method: z.enum(['mock_card', 'mock_wallet']),
  simulate: z.enum(['success', 'fail', 'pending']).default('success'),
}).strict();
const revenueQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  busId: z.string().optional(),
});

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notFound = () => new AppError(404, 'NOT_FOUND', 'Resource not found');

async function ownerBusIds(ownerId) {
  return Bus.find({ ownerId }).distinct('_id');
}
/** Payments for bookings on trips run by the given buses. */
async function paymentsForBuses(busIds, extra = {}) {
  const tripIds = await Trip.find({ busId: { $in: busIds } }).distinct('_id');
  const bookingIds = await Booking.find({ tripId: { $in: tripIds } }).distinct('_id');
  return Payment.find({ bookingId: { $in: bookingIds }, ...extra }).sort({ createdAt: -1 });
}

export const paymentRouter = Router();
paymentRouter.use(authenticate);

paymentRouter.post('/', requireRole('passenger'), validate(payBody), wrap(async (req, res) => {
  const { bookingId, method, simulate } = req.body;
  if (!mongoose.isValidObjectId(bookingId)) throw notFound();
  const booking = await Booking.findById(bookingId);
  if (!booking || String(booking.passengerId) !== String(req.user.id)) throw notFound();
  if (booking.status !== 'pending') throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking cannot be paid');
  if (await Payment.exists({ bookingId, status: { $in: ['success', 'pending'] } })) {
    throw new AppError(409, 'PAYMENT_EXISTS', 'A payment for this booking already exists');
  }
  // The amount always comes from the server-computed booking fare.
  const payment = await Payment.create({
    bookingId, amount: booking.fare, method, mock: true,
    transactionId: `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    status: simulate === 'success' ? 'success' : simulate === 'fail' ? 'failed' : 'pending',
  });
  let ticket;
  if (payment.status === 'success') ({ ticket } = await confirmBooking(bookingId));
  ok(res, { payment, ticketId: ticket?.id }, `Payment ${payment.status}`, 201);
}));

paymentRouter.get('/:id', validIdParams('id'), wrap(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  const booking = payment && (await Booking.findById(payment.bookingId));
  if (!booking) throw notFound();
  let allowed = String(booking.passengerId) === String(req.user.id);
  if (!allowed && req.user.role === 'owner') {
    const trip = await Trip.findById(booking.tripId);
    const bus = trip && (await Bus.findById(trip.busId));
    allowed = Boolean(bus) && String(bus.ownerId) === String(req.user.id);
  }
  if (!allowed) throw notFound();
  ok(res, payment, 'Payment');
}));

export const ownerRevenueRouter = Router();
ownerRevenueRouter.use(authenticate, requireRole('owner'));

ownerRevenueRouter.get('/payments', wrap(async (req, res) => {
  ok(res, await paymentsForBuses(await ownerBusIds(req.user.id)), 'Payments');
}));

ownerRevenueRouter.get('/revenue', validate(revenueQuery, 'query'), wrap(async (req, res) => {
  const { from, to, busId } = req.query;
  let busIds = await ownerBusIds(req.user.id);
  if (busId) {
    if (!mongoose.isValidObjectId(busId) || !busIds.some((b) => String(b) === busId)) throw notFound();
    busIds = [busId];
  }
  const createdAt = {};
  if (from) createdAt.$gte = new Date(`${from}T00:00:00Z`);
  if (to) createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  const payments = await paymentsForBuses(busIds, { status: 'success', ...(from || to ? { createdAt } : {}) });
  const byDay = {};
  for (const p of payments) {
    const day = p.createdAt.toISOString().slice(0, 10);
    byDay[day] = byDay[day] ?? { date: day, total: 0, count: 0 };
    byDay[day].total += p.amount;
    byDay[day].count += 1;
  }
  ok(res, {
    total: payments.reduce((s, p) => s + p.amount, 0),
    count: payments.length,
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
  }, 'Revenue summary');
}));
