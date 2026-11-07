import request from 'supertest';

let n = 0;
/** Register a user through the API; returns { token, user }. Roles: passenger | owner. */
export async function registerUser(app, role = 'passenger') {
  n += 1;
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `Test ${role} ${n}`, email: `${role}${n}@example.lk`, password: 'password123', role,
  });
  return res.body.data;
}
export const bearer = (t) => ({ Authorization: `Bearer ${t.token}` });
