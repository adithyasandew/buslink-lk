import Booking from '../models/Booking.js';
import Stop from '../models/Stop.js';
import { distanceMeters, isApproaching } from './geo.js';
import { notify, events } from './notifications.js';

export const STALE_AFTER_MS = 2 * 60 * 1000;

/** Notify each confirmed passenger once when the bus comes within their configured distance. */
export async function checkApproaching(trip, location) {
  const bookings = await Booking.find({ tripId: trip.id, status: 'confirmed', approachNotified: false });
  const notified = [];
  for (const b of bookings) {
    let point = b.pickupPoint?.lat != null ? b.pickupPoint : null;
    if (!point) {
      const stop = await Stop.findById(b.pickupStopId);
      point = stop?.location;
    }
    if (!point || !isApproaching(location, point, b.approachDistanceMeters)) continue;
    // Atomic flag flip guarantees at most one notification per booking, even with concurrent updates.
    const claimed = await Booking.findOneAndUpdate({ _id: b.id, approachNotified: false }, { approachNotified: true });
    if (!claimed) continue;
    const meters = Math.round(distanceMeters(location, point));
    await notify(b.passengerId, 'bus_approaching', `Your bus is about ${meters} m from your pickup point.`, b.id);
    events.emit('bus:approaching', {
      userId: String(b.passengerId), tripId: String(trip.id), bookingId: String(b.id),
      distanceMeters: meters, thresholdMeters: b.approachDistanceMeters, at: new Date().toISOString(),
    });
    notified.push(String(b.id));
  }
  return notified;
}

export async function notifyTripStatus(trip, status) {
  const bookings = await Booking.find({ tripId: trip.id, status: 'confirmed' });
  const label = status === 'active' ? 'has started' : 'has completed';
  await Promise.all(bookings.map((b) => notify(b.passengerId, 'trip_status', `Your trip ${label}.`, trip.id)));
  events.emit('trip:status', { tripId: String(trip.id), status, at: new Date().toISOString() });
}
