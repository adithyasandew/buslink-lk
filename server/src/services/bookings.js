import crypto from 'node:crypto';
import Booking from '../models/Booking.js';
import SeatReservation from '../models/SeatReservation.js';
import Ticket from '../models/Ticket.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { AppError } from '../middleware/errors.js';
import { notify } from './notifications.js';

/** Fare is always computed on the server from stop fares. */
export const computeFare = (pickup, dropoff, seatCount) => (dropoff.fareFromStart - pickup.fareFromStart) * seatCount;

/**
 * Claim seats atomically via the unique (tripId, seatNumber) index.
 * On any conflict everything created here is rolled back.
 */
export async function createBookingWithSeats({ passengerId, trip, pickup, dropoff, seats }) {
  const booking = await Booking.create({
    passengerId, tripId: trip.id, pickupStopId: pickup.id, dropoffStopId: dropoff.id,
    seats, fare: computeFare(pickup, dropoff, seats.length), status: 'pending',
  });
  try {
    await SeatReservation.insertMany(
      seats.map((seatNumber) => ({ tripId: trip.id, seatNumber, bookingId: booking.id })),
      { ordered: true },
    );
  } catch (err) {
    await SeatReservation.deleteMany({ bookingId: booking.id });
    await booking.deleteOne();
    if (err.code === 11000 || err.writeErrors?.some((e) => e.code === 11000) || err.name === 'MongoBulkWriteError') {
      throw new AppError(409, 'BOOKING_SEAT_TAKEN', 'One or more selected seats are no longer available');
    }
    throw err;
  }
  await notify(passengerId, 'booking_created', `Booking created for ${seats.length} seat(s). Complete payment to confirm.`, booking.id);
  return booking;
}

const newTicketRef = () => `BL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

/** Called when a booking becomes confirmed (after payment). Idempotent. */
export async function confirmBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    throw new AppError(422, 'BOOKING_NOT_CONFIRMABLE', 'Booking can no longer be confirmed');
  }
  const newlyConfirmed = booking.status !== 'confirmed';
  booking.status = 'confirmed';
  await booking.save();
  let ticket = await Ticket.findOne({ bookingId });
  if (!ticket) {
    ticket = await Ticket.create({
      bookingId, ticketRef: newTicketRef(), qrToken: crypto.randomBytes(24).toString('hex'), fare: booking.fare,
    });
  }
  if (newlyConfirmed) {
    await notify(booking.passengerId, 'booking_confirmed', `Booking confirmed. Ticket ${ticket.ticketRef} is ready.`, booking.id);
    const trip = await Trip.findById(booking.tripId);
    const bus = trip && (await Bus.findById(trip.busId));
    if (bus) await notify(bus.ownerId, 'booking_confirmed', `New confirmed booking (${booking.seats.length} seat(s)) on ${bus.registrationNumber}.`, booking.id);
  }
  return { booking, ticket };
}

export async function cancelBooking(booking) {
  booking.status = 'cancelled';
  await booking.save();
  await SeatReservation.deleteMany({ bookingId: booking.id });
  await Ticket.updateMany({ bookingId: booking.id, status: 'valid' }, { status: 'cancelled' });
  await notify(booking.passengerId, 'booking_cancelled', 'Your booking was cancelled and the seats were released.', booking.id);
  return booking;
}
