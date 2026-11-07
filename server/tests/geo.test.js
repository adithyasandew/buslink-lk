import { describe, it, expect } from 'vitest';
import { distanceMeters, isApproaching, isStale } from '../src/services/geo.js';

const colombo = { lat: 6.9271, lng: 79.8612 };
const kandy = { lat: 7.2906, lng: 80.6337 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(colombo, colombo)).toBe(0);
  });

  it('matches the known Colombo–Kandy straight-line distance (~94 km)', () => {
    const km = distanceMeters(colombo, kandy) / 1000;
    expect(km).toBeGreaterThan(90);
    expect(km).toBeLessThan(98);
  });

  it('is symmetric', () => {
    expect(distanceMeters(colombo, kandy)).toBeCloseTo(distanceMeters(kandy, colombo), 6);
  });

  it('rejects invalid coordinates', () => {
    expect(() => distanceMeters({ lat: 91, lng: 0 }, colombo)).toThrow(TypeError);
    expect(() => distanceMeters({ lat: 'x', lng: 0 }, colombo)).toThrow(TypeError);
    expect(() => distanceMeters(null, colombo)).toThrow(TypeError);
  });
});

describe('isApproaching', () => {
  // ~111 m north of the pickup
  const near = { lat: colombo.lat + 0.001, lng: colombo.lng };

  it('is true inside the threshold and at its boundary', () => {
    expect(isApproaching(near, colombo, 500)).toBe(true);
    expect(isApproaching(colombo, colombo, 1)).toBe(true);
  });

  it('is false outside the threshold', () => {
    expect(isApproaching(near, colombo, 50)).toBe(false);
    expect(isApproaching(kandy, colombo, 1000)).toBe(false);
  });

  it('rejects a non-positive threshold', () => {
    expect(() => isApproaching(near, colombo, 0)).toThrow(RangeError);
    expect(() => isApproaching(near, colombo, NaN)).toThrow(RangeError);
  });
});

describe('isStale', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  it('flags old locations only', () => {
    expect(isStale('2026-11-07T11:59:30Z', 60_000, now)).toBe(false);
    expect(isStale('2026-11-07T11:58:00Z', 60_000, now)).toBe(true);
  });
});
