import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import * as models from '../src/models/index.js';

const id = () => new mongoose.Types.ObjectId();
const errorsOf = (doc) => doc.validate().then(() => null, (e) => e.errors);

describe('model validation (no database needed)', () => {
  it('exports all 14 collections from the database design', () => {
    expect(Object.keys(models)).toHaveLength(14);
  });

  it('requires a valid role and a password hash on users', async () => {
    const bad = await errorsOf(new models.User({ name: 'A', email: 'a@x.lk', role: 'hacker' }));
    expect(bad.role).toBeDefined();
    expect(bad.passwordHash).toBeDefined();
    expect(await errorsOf(new models.User({ name: 'A', email: 'a@x.lk', passwordHash: 'h', role: 'staff' }))).toBeNull();
  });

  it('does not select passwordHash by default', () => {
    expect(models.User.schema.path('passwordHash').options.select).toBe(false);
  });

  it('rejects bookings without seats and negative fares', async () => {
    const b = await errorsOf(new models.Booking({
      passengerId: id(), tripId: id(), pickupStopId: id(), dropoffStopId: id(), seats: [], fare: -1,
    }));
    expect(b.seats).toBeDefined();
    expect(b.fare).toBeDefined();
  });

  it('validates schedule time format and coordinates', async () => {
    const s = await errorsOf(new models.Schedule({ busId: id(), routeId: id(), departureTime: '25:00', arrivalTime: '10:00' }));
    expect(s.departureTime).toBeDefined();
    const loc = await errorsOf(new models.BusLocation({ busId: id(), tripId: id(), lat: 95, lng: 10 }));
    expect(loc.lat).toBeDefined();
  });

  it('declares the unique indexes that guard data integrity', () => {
    const has = (m, keys) => m.schema.indexes().some(([k, o]) => o.unique && JSON.stringify(k) === JSON.stringify(keys));
    expect(has(models.SeatReservation, { tripId: 1, seatNumber: 1 })).toBe(true);
    expect(has(models.Stop, { routeId: 1, order: 1 })).toBe(true);
    expect(models.User.schema.path('email').options.unique).toBe(true);
    expect(models.Ticket.schema.path('ticketRef').options.unique).toBe(true);
    expect(models.Bus.schema.path('registrationNumber').options.unique).toBe(true);
  });
});
