// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin   (reads MONGODB_URI from .env)
// Creates or promotes an administrator. Credentials come from the environment, never from source code.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../db.js';
import User from '../models/User.js';

const { ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await connectDatabase(MONGODB_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin', status: 'active', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) }, $setOnInsert: { name: 'Administrator', email } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  console.log(`Administrator ready: ${email}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(`seed:admin failed: ${err.message}`);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
