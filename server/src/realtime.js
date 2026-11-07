import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getJwtSecret } from './config.js';
import User from './models/User.js';
import Trip from './models/Trip.js';
import Bus from './models/Bus.js';
import Booking from './models/Booking.js';
import { events } from './services/notifications.js';
import { recordLocation } from './services/tracking.js';

const tripRoom = (id) => `trip:${id}`;
const userRoom = (id) => `user:${id}`;
const MIN_LOCATION_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1000;

const locationSchema = z.object({
  tripId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
}).strict();

/** Same access rules as GET /trips/:id/location. A room name is never authorization. */
async function canViewTrip(user, trip) {
  if (user.role === 'staff') return trip.staffIds.some((s) => String(s) === String(user.id));
  if (user.role === 'owner') return String((await Bus.findById(trip.busId))?.ownerId) === String(user.id);
  if (user.role === 'passenger') return Boolean(await Booking.exists({ tripId: trip.id, passengerId: user.id, status: 'confirmed' }));
  return false;
}

export function attachRealtime(httpServer, { clientOrigin } = {}) {
  const io = new Server(httpServer, { cors: { origin: clientOrigin || 'http://localhost:5173' } });

  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token ?? '', getJwtSecret());
      const user = await User.findById(payload.sub);
      if (!user || user.status !== 'active') throw new Error('inactive');
      socket.data.user = user;
      next();
    } catch {
      next(Object.assign(new Error('AUTH_REQUIRED'), { data: { code: 'AUTH_REQUIRED' } }));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    let lastLocationAt = 0;

    socket.on('trip:join', async (payload, ack = () => {}) => {
      try {
        if (!mongoose.isValidObjectId(payload?.tripId)) return ack({ ok: false, error: { code: 'NOT_FOUND' } });
        const trip = await Trip.findById(payload.tripId);
        if (!trip || !(await canViewTrip(user, trip))) return ack({ ok: false, error: { code: 'NOT_FOUND' } });
        await socket.join(tripRoom(trip.id));
        ack({ ok: true });
      } catch {
        ack({ ok: false, error: { code: 'INTERNAL_ERROR' } });
      }
    });

    socket.on('trip:leave', (payload) => {
      if (mongoose.isValidObjectId(payload?.tripId)) socket.leave(tripRoom(payload.tripId));
    });

    socket.on('location:update', async (payload, ack = () => {}) => {
      try {
        if (user.role !== 'staff') return ack({ ok: false, error: { code: 'FORBIDDEN_ROLE' } });
        const parsed = locationSchema.safeParse(payload);
        if (!parsed.success) return ack({ ok: false, error: { code: 'VALIDATION_ERROR' } });
        const now = Date.now();
        if (now - lastLocationAt < MIN_LOCATION_INTERVAL_MS) return ack({ ok: false, error: { code: 'RATE_LIMITED' } });
        lastLocationAt = now;
        const { tripId, ...point } = parsed.data;
        const trip = mongoose.isValidObjectId(tripId) ? await Trip.findById(tripId) : null;
        if (!trip || !trip.staffIds.some((s) => String(s) === String(user.id))) return ack({ ok: false, error: { code: 'NOT_FOUND' } });
        await recordLocation(trip, point);
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: { code: err.code || 'INTERNAL_ERROR' } });
      }
    });
  });

  // Domain events -> sockets. Persistence has already happened by the time these fire.
  const onLocation = (e) => io.to(tripRoom(e.tripId)).emit('location:updated', { ...e, stale: false });
  const onStatus = (e) => io.to(tripRoom(e.tripId)).emit('trip:status', e);
  const onApproach = ({ userId, ...e }) => io.to(userRoom(userId)).emit('bus:approaching', e);
  const onNotification = (n) => io.to(userRoom(n.userId)).emit('notification:new', {
    id: n.id, type: n.type, message: n.message, createdAt: n.createdAt,
  });
  events.on('location', onLocation);
  events.on('trip:status', onStatus);
  events.on('bus:approaching', onApproach);
  events.on('notification', onNotification);
  const originalClose = io.close.bind(io);
  io.close = (...args) => {
    events.off('location', onLocation);
    events.off('trip:status', onStatus);
    events.off('bus:approaching', onApproach);
    events.off('notification', onNotification);
    return originalClose(...args);
  };
  return io;
}
