import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../models/User.js';
import { AppError } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { getJwtSecret, JWT_EXPIRES_IN } from '../config.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(['passenger', 'owner']).default('passenger'),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, status: u.status, ownerVerified: u.ownerVerified,
});
const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, try again later')),
});

const router = Router();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { password, ...rest } = req.body;
    if (await User.exists({ email: rest.email })) throw new AppError(409, 'EMAIL_IN_USE', 'Email is already registered');
    const user = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
    res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) }, message: 'Registered' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok || user.status !== 'active') throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    res.json({ success: true, data: { token: signToken(user), user: publicUser(user) }, message: 'Logged in' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: publicUser(req.user), message: 'Current user' });
});

export default router;
