// Distance and geofence helpers for bus-approaching notifications (FR-13).
const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

function assertPoint(p) {
  const ok =
    p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
  if (!ok) throw new TypeError('Invalid coordinates');
}

/** Great-circle distance in meters between two {lat, lng} points (haversine). */
export function distanceMeters(a, b) {
  assertPoint(a);
  assertPoint(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the bus is within thresholdMeters of the pickup point. */
export function isApproaching(bus, pickup, thresholdMeters) {
  if (!Number.isFinite(thresholdMeters) || thresholdMeters <= 0) {
    throw new RangeError('thresholdMeters must be a positive number');
  }
  return distanceMeters(bus, pickup) <= thresholdMeters;
}

/** A location is stale when recordedAt is older than maxAgeMs. */
export function isStale(recordedAt, maxAgeMs, now = Date.now()) {
  return now - new Date(recordedAt).getTime() > maxAgeMs;
}
