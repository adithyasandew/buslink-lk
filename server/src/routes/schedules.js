import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Schedule from '../models/Schedule.js';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';
import BusStaffAssignment from '../models/BusStaffAssignment.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const scheduleBody = z.object({
  busId: z.string(),
  routeId: z.string(),
  departureTime: time,
  arrivalTime: time,
  operatingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});
const generateBody = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const MAX_DAYS = 31;

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const ownerOnly = [authenticate, requireRole('owner')];

/** Bus and route must both belong to the owner, and the bus must be assigned to the route. */
async function checkOwnership(ownerId, { busId, routeId }) {
  if (!mongoose.isValidObjectId(busId) || !mongoose.isValidObjectId(routeId)) throw new AppError(404, 'NOT_FOUND', 'Bus or route not found');
  const [bus, route] = await Promise.all([
    Bus.findOne({ _id: busId, ownerId }),
    Route.findOne({ _id: routeId, ownerId }),
  ]);
  if (!bus || !route) throw new AppError(404, 'NOT_FOUND', 'Bus or route not found');
  if (!route.assignedBusIds.some((b) => String(b) === String(bus.id))) {
    throw new AppError(422, 'BUS_NOT_ON_ROUTE', 'Assign the bus to the route first');
  }
}

async function ownSchedule(req) {
  const s = await Schedule.findById(req.params.id).populate('busId', 'ownerId');
  if (!s || String(s.busId?.ownerId) !== String(req.user.id)) throw new AppError(404, 'NOT_FOUND', 'Schedule not found');
  return s;
}

const router = Router();

router.post('/', ownerOnly, validate(scheduleBody), wrap(async (req, res) => {
  await checkOwnership(req.user.id, req.body);
  ok(res, await Schedule.create(req.body), 'Schedule created', 201);
}));

router.get('/', ownerOnly, wrap(async (req, res) => {
  const busIds = await Bus.find({ ownerId: req.user.id }).distinct('_id');
  ok(res, await Schedule.find({ busId: { $in: busIds } }).sort({ departureTime: 1 }), 'Schedules');
}));

router.patch('/:id', ownerOnly, validIdParams('id'), validate(scheduleBody.partial()), wrap(async (req, res) => {
  const s = await ownSchedule(req);
  const next = { busId: String(s.busId._id), routeId: String(s.routeId), ...req.body };
  await checkOwnership(req.user.id, next);
  s.set(req.body);
  await s.save();
  ok(res, await Schedule.findById(s.id), 'Schedule updated');
}));

router.delete('/:id', ownerOnly, validIdParams('id'), wrap(async (req, res) => {
  const s = await ownSchedule(req);
  s.active = false;
  await s.save();
  ok(res, { id: s.id, active: false }, 'Schedule deactivated');
}));

// Generate dated trips for operating days in [from, to]; idempotent.
router.post('/:id/trips', ownerOnly, validIdParams('id'), validate(generateBody), wrap(async (req, res) => {
  const s = await ownSchedule(req);
  if (!s.active) throw new AppError(422, 'SCHEDULE_INACTIVE', 'Schedule is not active');
  const start = new Date(`${req.body.from}T00:00:00Z`);
  const end = new Date(`${req.body.to}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  if (Number.isNaN(days) || days < 1 || days > MAX_DAYS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'to', message: `Range must be 1 to ${MAX_DAYS} days` }]);
  }
  const staffIds = await BusStaffAssignment.find({ busId: s.busId._id, status: 'active' }).distinct('staffUserId');
  const created = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getTime() + i * 86400000);
    if (!s.operatingDays.includes(date.getUTCDay())) continue;
    const r = await Trip.updateOne(
      { scheduleId: s.id, date },
      { $setOnInsert: { scheduleId: s.id, busId: s.busId._id, routeId: s.routeId, staffIds, date, departureTime: s.departureTime } },
      { upsert: true },
    );
    if (r.upsertedCount) created.push(date.toISOString().slice(0, 10));
  }
  ok(res, { created }, `${created.length} trip(s) generated`, 201);
}));

export default router;
