import request from 'supertest';
import { registerUser, bearer } from './users.js';

export const stops = [
  { name: 'Colombo', lat: 6.93, lng: 79.86, fareFromStart: 0 },
  { name: 'Kegalle', lat: 7.25, lng: 80.34, fareFromStart: 250 },
  { name: 'Kandy', lat: 7.29, lng: 80.63, fareFromStart: 400 },
];
let n = 0;

/** Owner + bus (capacity 10) + route with stops + schedule + one trip + an assigned staff member. */
export async function buildWorld(app, { date = '2026-11-09' } = {}) {
  n += 1;
  const owner = await registerUser(app, 'owner');
  const bus = (await request(app).post('/api/v1/buses').set(bearer(owner)).send({ registrationNumber: `WB-${1000 + n}`, capacity: 10 })).body.data;
  const route = (await request(app).post('/api/v1/routes').set(bearer(owner)).send({ name: 'Colombo-Kandy', startPoint: 'Colombo', destination: 'Kandy' })).body.data;
  const stopList = (await request(app).put(`/api/v1/routes/${route._id}/stops`).set(bearer(owner)).send({ stops })).body.data;
  await request(app).post(`/api/v1/routes/${route._id}/buses`).set(bearer(owner)).send({ busId: bus._id });
  const schedule = (await request(app).post('/api/v1/schedules').set(bearer(owner)).send({
    busId: bus._id, routeId: route._id, departureTime: '06:30', arrivalTime: '10:00', operatingDays: [0, 1, 2, 3, 4, 5, 6],
  })).body.data;
  const staffCreds = { name: 'Kamal Driver', email: `staff${n}@example.lk`, password: 'password123' };
  const staffUser = (await request(app).post('/api/v1/staff').set(bearer(owner)).send(staffCreds)).body.data;
  await request(app).post(`/api/v1/buses/${bus._id}/staff`).set(bearer(owner)).send({ staffUserId: staffUser.id, staffType: 'conductor' });
  await request(app).post(`/api/v1/schedules/${schedule._id}/trips`).set(bearer(owner)).send({ from: date, to: date });
  const staff = (await request(app).post('/api/v1/auth/login').send({ email: staffCreds.email, password: staffCreds.password })).body.data;
  const found = await request(app).get('/api/v1/trips/search').query({ from: 'Colombo', to: 'Kandy', date });
  return { owner, bus, route, stops: stopList, staff, tripId: found.body.data[0]?.tripId, pickup: stopList[0], dropoff: stopList[2], mid: stopList[1] };
}
