import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import { busRouter, staffRouter } from './routes/buses.js';
import routeRoutes from './routes/routes.js';
import scheduleRoutes from './routes/schedules.js';
import tripRoutes, { staffTripsRouter } from './routes/trips.js';
import bookingRoutes from './routes/bookings.js';
import ticketRoutes from './routes/tickets.js';
import { paymentRouter, ownerRevenueRouter, mockGatewayRouter } from './routes/payments.js';
import { tripTrackingRouter, pickupRouter, notificationRouter } from './routes/tracking.js';

export function createApp({ clientOrigin = 'http://localhost:5173' } = {}) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ success: true, data: { status: 'ok', db: dbState }, message: 'BusLink LK API is running' });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/buses', busRouter);
  app.use('/api/v1/staff', staffTripsRouter);
  app.use('/api/v1/staff', staffRouter);
  app.use('/api/v1/trips', tripTrackingRouter);
  app.use('/api/v1/trips', tripRoutes);
  app.use('/api/v1/bookings', pickupRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/payments/mock-gateway', mockGatewayRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use('/api/v1/owner', ownerRevenueRouter);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/tickets', ticketRoutes);
  app.use('/api/v1/routes', routeRoutes);
  app.use('/api/v1/schedules', scheduleRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
