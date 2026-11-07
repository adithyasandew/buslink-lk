import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import { busRouter, staffRouter } from './routes/buses.js';

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
  app.use('/api/v1/staff', staffRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
