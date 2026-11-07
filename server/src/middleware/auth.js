import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';
import { getJwtSecret } from '../config.js';
import User from '../models/User.js';

/** Verifies the bearer token and loads the current user (shared auth contract for all modules). */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Session expired');
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    }
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to the given roles. Use after authenticate. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN_ROLE', 'You do not have permission to do this'));
  }
  next();
};
