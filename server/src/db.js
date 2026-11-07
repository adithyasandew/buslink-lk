import mongoose from 'mongoose';
import './models/index.js'; // register every model so all indexes are built below

/**
 * Connect to MongoDB and make sure every index exists before the API serves traffic.
 * The unique indexes are integrity guards (e.g. one reservation per trip seat, unique ticket refs),
 * so they must not be built lazily in the background while requests are already arriving.
 */
export async function connectDatabase(uri, { timeoutMs = 10000 } = {}) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return mongoose.connection;
}

export const disconnectDatabase = () => mongoose.disconnect();
