import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterAll, afterEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

/**
 * Call once at the top of a DB-backed test file.
 * Default: a throwaway in-memory MongoDB. Set TEST_MONGODB_URI (e.g. mongodb://127.0.0.1:27017)
 * to run against a real server instead; each file gets its own database, dropped afterwards.
 */
export function useTestDb() {
  let memory;
  beforeAll(async () => {
    const real = process.env.TEST_MONGODB_URI;
    if (real) {
      await mongoose.connect(real, { dbName: `buslink_test_${crypto.randomBytes(4).toString('hex')}`, serverSelectionTimeoutMS: 5000 });
    } else {
      memory = await MongoMemoryServer.create();
      await mongoose.connect(memory.getUri());
    }
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  }, 120000);
  afterEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  });
  afterAll(async () => {
    if (process.env.TEST_MONGODB_URI) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memory) await memory.stop();
  });
}
