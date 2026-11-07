import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import Bus from '../models/Bus.js';
import Booking from '../models/Booking.js';
import Trip from '../models/Trip.js';
import FeedbackComplaint from '../models/FeedbackComplaint.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validIdParams } from '../middleware/ids.js';
import { publicUser } from './auth.js';
import { notify } from '../services/notifications.js';

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const notFound = (m = 'Resource not found') => new AppError(404, 'NOT_FOUND', m);
const adminOnly = [authenticate, requireRole('admin')];

const listQuery = z.object({
  role: z.enum(['passenger', 'owner', 'staff', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const userPatch = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['passenger', 'owner', 'staff', 'admin']).optional(),
}).strict().refine((v) => v.status || v.role, 'Provide status or role');

export const userAdminRouter = Router();
userAdminRouter.use(...adminOnly);

userAdminRouter.get('/', validate(listQuery, 'query'), wrap(async (req, res) => {
  const { role, status, page, limit } = req.query;
  const filter = { ...(role && { role }), ...(status && { status }) };
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: users.map(publicUser), message: 'Users', meta: { page, limit, total } });
}));

userAdminRouter.get('/:id', validIdParams('id'), wrap(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  ok(res, publicUser(user), 'User');
}));

userAdminRouter.patch('/:id', validIdParams('id'), validate(userPatch), wrap(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  if (String(user.id) === String(req.user.id)) {
    throw new AppError(422, 'CANNOT_MODIFY_SELF', 'Admins cannot change their own role or status');
  }
  user.set(req.body);
  await user.save();
  ok(res, publicUser(user), 'User updated');
}));

export const verifyRouter = Router(); // mounted at /api/v1, so the admin guard is per route

verifyRouter.patch('/owners/:id/verify', ...adminOnly, validIdParams('id'), validate(z.object({ verified: z.boolean() }).strict()), wrap(async (req, res) => {
  const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
  if (!owner) throw notFound('Owner not found');
  owner.ownerVerified = req.body.verified;
  await owner.save();
  await notify(owner.id, 'owner_verification', req.body.verified ? 'Your owner account has been verified.' : 'Your owner verification was withdrawn.', owner.id);
  ok(res, publicUser(owner), 'Owner updated');
}));

verifyRouter.patch('/buses/:id/verify', ...adminOnly, validIdParams('id'), validate(z.object({ verified: z.boolean() }).strict()), wrap(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) throw notFound('Bus not found');
  bus.status = req.body.verified ? 'verified' : 'pending';
  await bus.save();
  await notify(bus.ownerId, 'bus_verification', `Bus ${bus.registrationNumber} is now ${bus.status}.`, bus.id);
  ok(res, bus, 'Bus updated');
}));

verifyRouter.get('/admin/overview', ...adminOnly, wrap(async (_req, res) => {
  const [users, buses, openComplaints, bookings] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Bus.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    FeedbackComplaint.countDocuments({ kind: 'complaint', status: { $in: ['open', 'in_review'] } }),
    Booking.countDocuments(),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  ok(res, { usersByRole: toMap(users), busesByStatus: toMap(buses), openComplaints, bookings }, 'Overview');
}));

// ---- complaints and feedback ----
const complaintBody = z.object({
  tripId: z.string().optional(),
  details: z.string().trim().min(10).max(2000),
}).strict();
const feedbackBody = z.object({
  tripId: z.string(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional(),
}).strict();
const NEXT = { open: ['in_review', 'rejected'], in_review: ['resolved', 'rejected'], resolved: [], rejected: [] };
const complaintPatch = z.object({ status: z.enum(['in_review', 'resolved', 'rejected']) }).strict();

export const complaintRouter = Router();
complaintRouter.use(authenticate);

complaintRouter.post('/', requireRole('passenger'), validate(complaintBody), wrap(async (req, res) => {
  if (req.body.tripId && !(mongoose.isValidObjectId(req.body.tripId) && (await Trip.exists({ _id: req.body.tripId })))) {
    throw notFound('Trip not found');
  }
  const c = await FeedbackComplaint.create({ passengerId: req.user.id, kind: 'complaint', ...req.body });
  ok(res, c, 'Complaint submitted', 201);
}));

// Passengers see only their own; admins see all.
complaintRouter.get('/', requireRole('passenger', 'admin'), wrap(async (req, res) => {
  const filter = { kind: 'complaint', ...(req.user.role === 'passenger' && { passengerId: req.user.id }) };
  if (req.query.status) filter.status = String(req.query.status);
  ok(res, await FeedbackComplaint.find(filter).sort({ createdAt: -1 }).limit(200), 'Complaints');
}));

complaintRouter.patch('/:id', requireRole('admin'), validIdParams('id'), validate(complaintPatch), wrap(async (req, res) => {
  const c = await FeedbackComplaint.findOne({ _id: req.params.id, kind: 'complaint' });
  if (!c) throw notFound('Complaint not found');
  if (!NEXT[c.status].includes(req.body.status)) {
    throw new AppError(422, 'INVALID_STATUS_TRANSITION', `Cannot move from ${c.status} to ${req.body.status}`);
  }
  c.status = req.body.status;
  await c.save();
  await notify(c.passengerId, 'complaint_update', `Your complaint is now ${c.status.replace('_', ' ')}.`, c.id);
  ok(res, c, 'Complaint updated');
}));

export const feedbackRouter = Router();

feedbackRouter.get('/', authenticate, requireRole('admin'), wrap(async (_req, res) => {
  const ratings = await FeedbackComplaint.find({ kind: 'rating' }).sort({ createdAt: -1 }).limit(200);
  const [summary] = await FeedbackComplaint.aggregate([
    { $match: { kind: 'rating' } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
  ]);
  res.json({
    success: true,
    data: ratings,
    meta: { count: summary?.count ?? 0, average: summary ? Math.round(summary.average * 10) / 10 : null },
    message: 'Ratings',
  });
}));
feedbackRouter.post('/', authenticate, requireRole('passenger'), validate(feedbackBody), wrap(async (req, res) => {
  const { tripId, rating, feedback } = req.body;
  if (!mongoose.isValidObjectId(tripId)) throw notFound('Trip not found');
  const trip = await Trip.findById(tripId);
  const booked = trip && (await Booking.exists({ tripId, passengerId: req.user.id, status: 'confirmed' }));
  if (!booked) throw notFound('Trip not found');
  if (trip.status !== 'completed') throw new AppError(422, 'TRIP_NOT_COMPLETED', 'You can rate a trip after it is completed');
  if (await FeedbackComplaint.exists({ passengerId: req.user.id, tripId, kind: 'rating' })) {
    throw new AppError(409, 'FEEDBACK_EXISTS', 'You have already rated this trip');
  }
  ok(res, await FeedbackComplaint.create({ passengerId: req.user.id, tripId, kind: 'rating', rating, feedback }), 'Thank you for your feedback', 201);
}));
