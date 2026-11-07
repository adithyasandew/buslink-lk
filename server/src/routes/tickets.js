import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Ticket from '../models/Ticket.js';
import Booking from '../models/Booking.js';
import Trip from '../models/Trip.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';

const ok = (res, data, message) => res.json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 60,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many verification attempts')),
});

const router = Router();
router.use(authenticate);

// Static path first so "verify" is never treated as an id.
router.post('/verify', requireRole('staff'), verifyLimiter, validate(z.object({ qrToken: z.string().min(10).max(200) })), wrap(async (req, res) => {
  const ticket = await Ticket.findOne({ qrToken: req.body.qrToken });
  if (!ticket) throw new AppError(404, 'TICKET_INVALID', 'Ticket not recognised');
  const booking = await Booking.findById(ticket.bookingId);
  const trip = booking && (await Trip.findById(booking.tripId));
  if (!trip || !trip.staffIds.some((s) => String(s) === String(req.user.id))) {
    // Do not reveal whether the ticket exists for a trip the staff member is not assigned to.
    throw new AppError(403, 'FORBIDDEN_TRIP', 'You are not assigned to this ticket\'s trip');
  }
  if (ticket.status === 'cancelled' || booking.status !== 'confirmed') throw new AppError(422, 'TICKET_NOT_VALID', 'Ticket is not valid');
  // Atomic valid -> used so concurrent scans cannot both succeed.
  const used = await Ticket.findOneAndUpdate(
    { _id: ticket.id, status: 'valid' }, { status: 'used', verifiedBy: req.user.id, verifiedAt: new Date() }, { new: true },
  );
  if (!used) throw new AppError(409, 'TICKET_ALREADY_USED', 'Ticket has already been used');
  ok(res, { ticketRef: used.ticketRef, seats: booking.seats, status: used.status }, 'Ticket verified');
}));

router.get('/:id', requireRole('passenger'), validIdParams('id'), wrap(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  const booking = ticket && (await Booking.findById(ticket.bookingId));
  if (!booking || String(booking.passengerId) !== String(req.user.id)) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
  ok(res, { ...ticket.toObject(), seats: booking.seats, tripId: booking.tripId }, 'Ticket');
}));

export default router;
