import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import Bus from '../models/Bus.js';
import User from '../models/User.js';
import BusStaffAssignment from '../models/BusStaffAssignment.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { publicUser } from './auth.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
const busBody = z.object({
  registrationNumber: z.string().trim().min(3).max(20),
  model: z.string().trim().max(60).optional(),
  capacity: z.number().int().min(1).max(100),
});
const busPatch = busBody.partial().extend({ status: z.enum(['active', 'inactive']).optional() });
const staffBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().max(20).optional(),
});
const assignBody = z.object({ staffUserId: z.string(), staffType: z.enum(['driver', 'conductor']) });

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const ownerOnly = [authenticate, requireRole('owner')];

async function ownBus(req) {
  const bus = await Bus.findById(req.params.id);
  // Same 404 for missing and foreign buses so ids cannot be probed.
  if (!bus || String(bus.ownerId) !== String(req.user.id)) throw new AppError(404, 'NOT_FOUND', 'Bus not found');
  return bus;
}
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const busRouter = Router();

busRouter.post('/', ownerOnly, validate(busBody), wrap(async (req, res) => {
  try {
    const bus = await Bus.create({ ...req.body, ownerId: req.user.id });
    ok(res, bus, 'Bus registered', 201);
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'BUS_EXISTS', 'A bus with this registration number already exists');
    throw err;
  }
}));

busRouter.get('/', ownerOnly, wrap(async (req, res) => {
  ok(res, await Bus.find({ ownerId: req.user.id }).sort({ createdAt: -1 }), 'Buses');
}));

busRouter.get('/:id', ownerOnly, validIdParams('id'), wrap(async (req, res) => ok(res, await ownBus(req), 'Bus')));

busRouter.patch('/:id', ownerOnly, validIdParams('id'), validate(busPatch), wrap(async (req, res) => {
  const bus = await ownBus(req);
  bus.set(req.body);
  try {
    await bus.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'BUS_EXISTS', 'A bus with this registration number already exists');
    throw err;
  }
  ok(res, bus, 'Bus updated');
}));

busRouter.delete('/:id', ownerOnly, validIdParams('id'), wrap(async (req, res) => {
  const bus = await ownBus(req);
  bus.status = 'inactive';
  await bus.save();
  ok(res, bus, 'Bus deactivated');
}));

busRouter.post('/:id/staff', ownerOnly, validIdParams('id'), validate(assignBody), wrap(async (req, res) => {
  const bus = await ownBus(req);
  const staff = await User.findOne({ _id: req.body.staffUserId, role: 'staff', ownerId: req.user.id });
  if (!staff) throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
  const a = await BusStaffAssignment.findOneAndUpdate(
    { staffUserId: staff.id, busId: bus.id },
    { staffType: req.body.staffType, status: 'active' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  ok(res, a, 'Staff assigned', 201);
}));

busRouter.delete('/:id/staff/:staffUserId', ownerOnly, validIdParams('id', 'staffUserId'), wrap(async (req, res) => {
  const bus = await ownBus(req);
  const a = await BusStaffAssignment.findOneAndUpdate(
    { busId: bus.id, staffUserId: req.params.staffUserId }, { status: 'inactive' }, { new: true },
  );
  if (!a) throw new AppError(404, 'NOT_FOUND', 'Assignment not found');
  ok(res, a, 'Staff unassigned');
}));

export const staffRouter = Router();

staffRouter.post('/', ownerOnly, validate(staffBody), wrap(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw new AppError(409, 'EMAIL_IN_USE', 'Email is already registered');
  const { password, ...rest } = req.body;
  const user = await User.create({ ...rest, role: 'staff', ownerId: req.user.id, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  ok(res, publicUser(user), 'Staff created', 201);
}));

staffRouter.get('/', ownerOnly, wrap(async (req, res) => {
  const staff = await User.find({ role: 'staff', ownerId: req.user.id }).sort({ createdAt: -1 });
  ok(res, staff.map(publicUser), 'Staff');
}));
