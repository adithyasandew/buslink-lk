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

/** Create an administrator directly (admins cannot self-register) and log in; returns { token, user }. */
export async function makeAdmin(app) {
  const { default: bcrypt } = await import('bcrypt');
  const { default: User } = await import('../../src/models/User.js');
  n += 1;
  const email = `admin${n}@example.lk`;
  await User.create({ name: 'Admin', email, role: 'admin', passwordHash: await bcrypt.hash('password123', 4) });
  return (await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' })).body.data;
}
