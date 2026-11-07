import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Route from '../models/Route.js';
import Stop from '../models/Stop.js';
import Bus from '../models/Bus.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';

const routeBody = z.object({
  name: z.string().trim().min(2).max(100),
  startPoint: z.string().trim().min(2).max(100),
  destination: z.string().trim().min(2).max(100),
});
const stopsBody = z.object({
  stops: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    fareFromStart: z.number().min(0),
  })).min(2).max(60),
});
const busBody = z.object({ busId: z.string() });

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const ownerOnly = [authenticate, requireRole('owner')];

export async function ownRoute(req) {
  const route = await Route.findById(req.params.id);
  if (!route || String(route.ownerId) !== String(req.user.id)) throw new AppError(404, 'NOT_FOUND', 'Route not found');
  return route;
}

const router = Router();

router.post('/', ownerOnly, validate(routeBody), wrap(async (req, res) => {
  ok(res, await Route.create({ ...req.body, ownerId: req.user.id }), 'Route created', 201);
}));

router.get('/', ownerOnly, wrap(async (req, res) => {
  ok(res, await Route.find({ ownerId: req.user.id }).sort({ createdAt: -1 }), 'Routes');
}));

router.get('/:id', ownerOnly, validIdParams('id'), wrap(async (req, res) => {
  const route = await ownRoute(req);
  const stops = await Stop.find({ routeId: route.id }).sort({ order: 1 });
  ok(res, { ...route.toObject(), stops }, 'Route');
}));

router.patch('/:id', ownerOnly, validIdParams('id'), validate(routeBody.partial()), wrap(async (req, res) => {
  const route = await ownRoute(req);
  route.set(req.body);
  ok(res, await route.save(), 'Route updated');
}));

router.delete('/:id', ownerOnly, validIdParams('id'), wrap(async (req, res) => {
  const route = await ownRoute(req);
  await Stop.deleteMany({ routeId: route.id });
  await route.deleteOne();
  ok(res, { id: route.id }, 'Route deleted');
}));

// Replace the ordered stop list. Fares must not decrease along the route.
router.put('/:id/stops', ownerOnly, validIdParams('id'), validate(stopsBody), wrap(async (req, res) => {
  const route = await ownRoute(req);
  const { stops } = req.body;
  for (let i = 1; i < stops.length; i += 1) {
    if (stops[i].fareFromStart < stops[i - 1].fareFromStart) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [
        { field: `stops.${i}.fareFromStart`, message: 'Fare must not decrease along the route' },
      ]);
    }
  }
  await Stop.deleteMany({ routeId: route.id });
  const created = await Stop.insertMany(stops.map((s, order) => ({
    routeId: route.id, name: s.name, order, fareFromStart: s.fareFromStart, location: { lat: s.lat, lng: s.lng },
  })));
  ok(res, created, 'Stops saved');
}));

router.post('/:id/buses', ownerOnly, validIdParams('id'), validate(busBody), wrap(async (req, res) => {
  const route = await ownRoute(req);
  if (!mongoose.isValidObjectId(req.body.busId)) throw new AppError(404, 'NOT_FOUND', 'Bus not found');
  const bus = await Bus.findOne({ _id: req.body.busId, ownerId: req.user.id });
  if (!bus) throw new AppError(404, 'NOT_FOUND', 'Bus not found');
  await Route.updateOne({ _id: route.id }, { $addToSet: { assignedBusIds: bus.id } });
  ok(res, await Route.findById(route.id), 'Bus assigned to route', 201);
}));

export default router;
