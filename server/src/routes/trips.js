import { Router } from 'express';
import { z } from 'zod';
import Trip from '../models/Trip.js';
import Route from '../models/Route.js';
import Stop from '../models/Stop.js';
import Bus from '../models/Bus.js';
import SeatReservation from '../models/SeatReservation.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { computeFare } from '../services/bookings.js';

const searchQuery = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const ok = (res, data, message) => res.json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function takenSeats(tripId) {
  return (await SeatReservation.find({ tripId })).map((r) => r.seatNumber).sort((a, b) => a - b);
}

const router = Router();

router.get('/search', validate(searchQuery, 'query'), wrap(async (req, res) => {
  const { from, to, date } = req.query;
  const day = new Date(`${date}T00:00:00Z`);
  const exact = (s) => new RegExp(`^${escapeRe(s)}$`, 'i');
  const [fromStops, toStops] = await Promise.all([Stop.find({ name: exact(from) }), Stop.find({ name: exact(to) })]);
  const results = [];
  for (const f of fromStops) {
    const t = toStops.find((s) => String(s.routeId) === String(f.routeId) && s.order > f.order);
    if (!t) continue;
    const trips = await Trip.find({ routeId: f.routeId, date: day, status: 'scheduled' });
    const route = await Route.findById(f.routeId);
    for (const trip of trips) {
      const bus = await Bus.findById(trip.busId);
      if (!bus || bus.status === 'inactive') continue;
      const taken = await SeatReservation.countDocuments({ tripId: trip.id });
      results.push({
        tripId: trip.id, route: route.name, date: date, departureTime: trip.departureTime,
        pickupStopId: f.id, dropoffStopId: t.id, fare: computeFare(f, t, 1),
        capacity: bus.capacity, seatsAvailable: bus.capacity - taken,
      });
    }
  }
  results.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  ok(res, results, `${results.length} trip(s) found`);
}));

router.get('/:id', validIdParams('id'), wrap(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  const [bus, route, stops, taken] = await Promise.all([
    Bus.findById(trip.busId), Route.findById(trip.routeId), Stop.find({ routeId: trip.routeId }).sort({ order: 1 }), takenSeats(trip.id),
  ]);
  ok(res, {
    id: trip.id, date: trip.date, departureTime: trip.departureTime, status: trip.status,
    route: { id: route.id, name: route.name, startPoint: route.startPoint, destination: route.destination },
    stops: stops.map((s) => ({ id: s.id, name: s.name, order: s.order, fareFromStart: s.fareFromStart, location: s.location })),
    capacity: bus.capacity, takenSeats: taken,
  }, 'Trip');
}));

// Bus Staff: trips they are assigned to (dated today or later).
export const staffTripsRouter = Router();
staffTripsRouter.get('/trips', authenticate, requireRole('staff'), wrap(async (req, res) => {
  const startOfToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const trips = await Trip.find({ staffIds: req.user.id, date: { $gte: startOfToday } }).sort({ date: 1, departureTime: 1 });
  ok(res, trips, 'Assigned trips');
}));

export default router;
