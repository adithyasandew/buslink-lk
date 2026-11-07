// Demo data for local development and demonstrations (synthetic only, never real people).
// Usage: npm run seed:demo   (reads MONGODB_URI; optional DEMO_PASSWORD, default Password123!)
// Idempotent: re-running updates the same records instead of duplicating them.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db.js';
import { User, Bus, BusStaffAssignment, Route, Stop, Schedule, Trip } from '../models/index.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

const PASSWORD = process.env.DEMO_PASSWORD || 'Password123!';
const DAYS_AHEAD = 7;

async function upsertUser(fields, passwordHash) {
  return User.findOneAndUpdate(
    { email: fields.email },
    { $set: { ...fields, status: 'active' }, $setOnInsert: { passwordHash } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDatabase(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const owner = await upsertUser({ name: 'Sunil Perera', email: 'owner@example.lk', role: 'owner', ownerVerified: true, phone: '0770000001' }, passwordHash);
  const passenger = await upsertUser({ name: 'Asha Fernando', email: 'passenger@example.lk', role: 'passenger', phone: '0770000002' }, passwordHash);
  const admin = await upsertUser({ name: 'Site Admin', email: 'admin@example.lk', role: 'admin' }, passwordHash);
  const driver = await upsertUser({ name: 'Kamal Silva', email: 'driver@example.lk', role: 'staff', ownerId: owner._id }, passwordHash);
  const conductor = await upsertUser({ name: 'Nimal Jayasuriya', email: 'conductor@example.lk', role: 'staff', ownerId: owner._id }, passwordHash);

  const bus = await Bus.findOneAndUpdate(
    { registrationNumber: 'NB-1234' },
    { $set: { ownerId: owner._id, model: 'Ashok Leyland Viking', capacity: 40, status: 'active' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  for (const [staff, staffType] of [[driver, 'driver'], [conductor, 'conductor']]) {
    await BusStaffAssignment.findOneAndUpdate(
      { staffUserId: staff._id, busId: bus._id }, { staffType, status: 'active' }, { upsert: true, setDefaultsOnInsert: true },
    );
  }

  const route = await Route.findOneAndUpdate(
    { ownerId: owner._id, name: 'Colombo – Kandy' },
    { $set: { startPoint: 'Colombo Fort', destination: 'Kandy' }, $addToSet: { assignedBusIds: bus._id } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  const stops = [
    ['Colombo Fort', 6.9344, 79.8503, 0],
    ['Kadawatha', 7.0003, 79.9532, 90],
    ['Kegalle', 7.2513, 80.3464, 260],
    ['Peradeniya', 7.2599, 80.5977, 380],
    ['Kandy', 7.2906, 80.6337, 420],
  ];
  await Stop.deleteMany({ routeId: route._id });
  await Stop.insertMany(stops.map(([name, lat, lng, fareFromStart], order) => ({ routeId: route._id, name, order, fareFromStart, location: { lat, lng } })));

  const schedules = [];
  for (const [departureTime, arrivalTime] of [['06:30', '10:00'], ['14:00', '17:30']]) {
    schedules.push(await Schedule.findOneAndUpdate(
      { busId: bus._id, routeId: route._id, departureTime },
      { $set: { arrivalTime, operatingDays: [0, 1, 2, 3, 4, 5, 6], active: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ));
  }

  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  let created = 0;
  for (const s of schedules) {
    for (let i = 0; i < DAYS_AHEAD; i += 1) {
      const date = new Date(today.getTime() + i * 86400000);
      const r = await Trip.updateOne(
        { scheduleId: s._id, date },
        { $setOnInsert: { scheduleId: s._id, busId: bus._id, routeId: route._id, staffIds: [driver._id, conductor._id], date, departureTime: s.departureTime } },
        { upsert: true },
      );
      created += r.upsertedCount;
    }
  }

  console.log(`Demo data ready in "${mongoose.connection.name}" (${created} new trip(s) for the next ${DAYS_AHEAD} days).`);
  console.log(`Accounts (password: ${process.env.DEMO_PASSWORD ? '<DEMO_PASSWORD>' : PASSWORD}):`);
  for (const u of [owner, passenger, admin, driver, conductor]) console.log(`  ${u.role.padEnd(9)} ${u.email}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(`Seeding failed: ${err.message}`);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
