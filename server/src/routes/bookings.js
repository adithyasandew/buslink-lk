import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import Trip from '../models/Trip.js';
import Stop from '../models/Stop.js';
import Bus from '../models/Bus.js';
import Ticket from '../models/Ticket.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { createBookingWithSeats, cancelBooking } from '../services/bookings.js';
import { refundForBooking } from '../services/payments.js';

const bookingBody = z.object({
  tripId: z.string(),
  pickupStopId: z.string(),
  dropoffStopId: z.string(),
  seats: z.array(z.number().int().min(1)).min(1).max(10),
});
const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notFound = () => new AppError(404, 'NOT_FOUND', 'Resource not found');

const router = Router();
router.use(authenticate);

router.post('/', requireRole('passenger'), validate(bookingBody), wrap(async (req, res) => {
  const { tripId, pickupStopId, dropoffStopId, seats } = req.body;
  if (![tripId, pickupStopId, dropoffStopId].every((i) => mongoose.isValidObjectId(i))) throw notFound();
  if (new Set(seats).size !== seats.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'seats', message: 'Duplicate seats' }]);
  }
  const trip = await Trip.findById(tripId);
  if (!trip) throw notFound();
  if (trip.status !== 'scheduled') throw new AppError(422, 'TRIP_NOT_BOOKABLE', 'This trip is not open for booking');
  const [pickup, dropoff, bus] = await Promise.all([Stop.findById(pickupStopId), Stop.findById(dropoffStopId), Bus.findById(trip.busId)]);
  if (!pickup || !dropoff || String(pickup.routeId) !== String(trip.routeId) || String(dropoff.routeId) !== String(trip.routeId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'pickupStopId', message: 'Stops must belong to the trip route' }]);
  }
  if (pickup.order >= dropoff.order) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'dropoffStopId', message: 'Drop-off must come after pickup' }]);
  }
  if (seats.some((s) => s > bus.capacity)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'seats', message: `Seat numbers must be 1 to ${bus.capacity}` }]);
  }
  const booking = await createBookingWithSeats({ passengerId: req.user.id, trip, pickup, dropoff, seats });
  ok(res, booking, 'Booking created', 201);
}));

router.get('/', requireRole('passenger'), wrap(async (req, res) => {
  ok(res, await Booking.find({ passengerId: req.user.id }).sort({ createdAt: -1 }), 'Bookings');
}));

router.get('/:id', validIdParams('id'), wrap(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw notFound();
  let allowed = String(booking.passengerId) === String(req.user.id);
  if (!allowed && req.user.role === 'owner') {
    const trip = await Trip.findById(booking.tripId);
    const bus = trip && (await Bus.findById(trip.busId));
    allowed = Boolean(bus) && String(bus.ownerId) === String(req.user.id);
  }
  if (!allowed) throw notFound();
  const ticket = await Ticket.findOne({ bookingId: booking.id });
  ok(res, { ...booking.toObject(), ticketId: ticket?.id }, 'Booking');
}));

router.post('/:id/cancel', requireRole('passenger'), validIdParams('id'), wrap(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || String(booking.passengerId) !== String(req.user.id)) throw notFound();
  if (!['pending', 'confirmed'].includes(booking.status)) throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'Booking cannot be cancelled');
  if (await Ticket.exists({ bookingId: booking.id, status: 'used' })) {
    throw new AppError(409, 'BOOKING_ALREADY_TRAVELLED', 'This ticket has already been used and cannot be cancelled');
  }
  const cancelled = await cancelBooking(booking);
  const refund = await refundForBooking(booking.id);
  ok(res, { ...cancelled.toObject(), refund: refund ? { paymentId: refund.id, amount: refund.amount, status: refund.status } : null }, 'Booking cancelled');
}));

export default router;
