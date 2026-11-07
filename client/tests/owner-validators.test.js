import { describe, it, expect } from 'vitest'
import { validateBus, validateRoute, validateSchedule, validateStaff, validateStops } from '../src/features/owner/validators'

const stop = (over = {}) => ({ name: 'A', lat: '6.9', lng: '79.8', fareFromStart: '0', ...over })

describe('owner validators', () => {
  it('validates buses', () => {
    expect(validateBus({ registrationNumber: 'NB-1234', capacity: '52' })).toEqual({})
    expect(validateBus({ registrationNumber: 'N', capacity: '0' })).toHaveProperty('registrationNumber')
    expect(validateBus({ registrationNumber: 'NB-1', capacity: '101' })).toHaveProperty('capacity')
    expect(validateBus({ registrationNumber: 'NB-1', capacity: '4.5' })).toHaveProperty('capacity')
  })

  it('validates staff and routes', () => {
    expect(validateStaff({ name: 'Kamal', email: 'k@x.lk', password: 'password1' })).toEqual({})
    expect(Object.keys(validateStaff({ name: 'K', email: 'bad', password: 'short' }))).toEqual(['name', 'email', 'password'])
    expect(validateRoute({ name: 'Colombo-Kandy', startPoint: 'Colombo', destination: 'Kandy' })).toEqual({})
    expect(Object.keys(validateRoute({ name: '', startPoint: '', destination: '' }))).toHaveLength(3)
  })

  it('validates stops: count, coordinates and non-decreasing fares', () => {
    expect(validateStops([stop(), stop({ name: 'B', fareFromStart: '100' })])).toEqual({})
    expect(validateStops([stop()])._form).toMatch(/two stops/)
    const bad = validateStops([stop({ lat: '95' }), stop({ name: '', lng: '200', fareFromStart: 'x' })])
    expect(bad[0].lat).toBeDefined()
    expect(bad[1]).toMatchObject({ name: expect.any(String), lng: expect.any(String), fareFromStart: expect.any(String) })
    expect(validateStops([stop({ fareFromStart: '200' }), stop({ name: 'B', fareFromStart: '100' })])[1].fareFromStart).toMatch(/lower/)
  })

  it('validates schedules', () => {
    const ok = { busId: 'b', routeId: 'r', departureTime: '06:30', arrivalTime: '10:00', operatingDays: [1] }
    expect(validateSchedule(ok)).toEqual({})
    expect(Object.keys(validateSchedule({ busId: '', routeId: '', departureTime: '', arrivalTime: '', operatingDays: [] }))).toHaveLength(5)
  })
})
