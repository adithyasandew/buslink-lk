import { Router } from 'express';
import { z } from 'zod';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import Booking from '../models/Booking.js';
import BusLocation from '../models/BusLocation.js';
import Notification from '../models/Notification.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { notifyTripStatus, recordLocation, STALE_AFTER_MS } from '../services/tracking.js';
import { isStale } from '../services/geo.js';

const locationBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
}).strict();
const pickupBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  approachDistanceMeters: z.number().int().min(100).max(5000).optional(),
}).strict();

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notFound = (m = 'Resource not found') => new AppError(404, 'NOT_FOUND', m);

const assigned = (trip, user) => trip.staffIds.some((s) => String(s) === String(user.id));

async function assignedTrip(req) {
  const trip = await Trip.findById(req.params.id);
  // Same 404 for missing and unassigned trips so staff cannot probe other trips.
  if (!trip || !assigned(trip, req.user)) throw notFound('Trip not found');
  return trip;
}

export const tripTrackingRouter = Router();
// Auth is applied per route: this router shares the /trips prefix with public search endpoints.

tripTrackingRouter.post('/:id/start', authenticate, requireRole('staff'), validIdParams('id'), wrap(async (req, res) => {
  const trip = await assignedTrip(req);
  if (trip.status !== 'scheduled') throw new AppError(422, 'TRIP_INVALID_STATE', `Trip is ${trip.status}`);
  trip.status = 'active';
  await trip.save();
  await notifyTripStatus(trip, 'active');
  ok(res, trip, 'Trip started');
}));

tripTrackingRouter.post('/:id/end', authenticate, requireRole('staff'), validIdParams('id'), wrap(async (req, res) => {
  const trip = await assignedTrip(req);
  if (trip.status !== 'active') throw new AppError(422, 'TRIP_INVALID_STATE', `Trip is ${trip.status}`);
  trip.status = 'completed';
  await trip.save();
  await notifyTripStatus(trip, 'completed');
  ok(res, trip, 'Trip ended');
}));

tripTrackingRouter.post('/:id/location', authenticate, requireRole('staff'), validIdParams('id'), validate(locationBody), wrap(async (req, res) => {
  const trip = await assignedTrip(req);
  const { loc, notified } = await recordLocation(trip, req.body);
  ok(res, { recordedAt: loc.recordedAt, notified: notified.length }, 'Location recorded', 201);
}));

/** Latest location: assigned staff, the bus owner, or a passenger with a confirmed booking on the trip. */
tripTrackingRouter.get('/:id/location', authenticate, validIdParams('id'), wrap(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip not found');
  let allowed = false;
  if (req.user.role === 'staff') allowed = assigned(trip, req.user);
  else if (req.user.role === 'owner') allowed = String((await Bus.findById(trip.busId))?.ownerId) === String(req.user.id);
  else if (req.user.role === 'passenger') {
    allowed = Boolean(await Booking.exists({ tripId: trip.id, passengerId: req.user.id, status: 'confirmed' }));
  }
  if (!allowed) throw notFound('Trip not found');
  const loc = await BusLocation.findOne({ tripId: trip.id }).sort({ recordedAt: -1 });
  ok(res, {
    tripStatus: trip.status,
    location: loc && {
      lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, recordedAt: loc.recordedAt,
      stale: isStale(loc.recordedAt, STALE_AFTER_MS),
    },
  }, 'Latest location');
}));

export const pickupRouter = Router();
pickupRouter.post('/:id/pickup-point', authenticate, requireRole('passenger'), validIdParams('id'), validate(pickupBody), wrap(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || String(booking.passengerId) !== String(req.user.id)) throw notFound('Booking not found');
  if (!['pending', 'confirmed'].includes(booking.status)) throw new AppError(409, 'BOOKING_NOT_ACTIVE', 'Booking is not active');
  const { lat, lng, approachDistanceMeters } = req.body;
  booking.pickupPoint = { lat, lng };
  if (approachDistanceMeters) booking.approachDistanceMeters = approachDistanceMeters;
  booking.approachNotified = false;
  await booking.save();
  ok(res, { pickupPoint: booking.pickupPoint, approachDistanceMeters: booking.approachDistanceMeters }, 'Pickup point saved');
}));

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', wrap(async (req, res) => {
  ok(res, await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100), 'Notifications');
}));
notificationRouter.patch('/:id/read', validIdParams('id'), wrap(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { status: 'read' }, { new: true });
  if (!n) throw notFound('Notification not found');
  ok(res, n, 'Marked as read');
}));
