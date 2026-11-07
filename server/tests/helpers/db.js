import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterAll, afterEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

/** Call once at the top of a DB-backed test file. */
export function useTestDb() {
  let server;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  }, 120000);
  afterEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });
}
