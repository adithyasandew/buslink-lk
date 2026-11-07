import mongoose from 'mongoose';
import { AppError } from './errors.js';

/** Reject malformed ObjectIds in route params with a clean 404 instead of a cast error. */
export const validIdParams = (...names) => (req, _res, next) => {
  for (const n of names) {
    if (!mongoose.isValidObjectId(req.params[n])) return next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
  }
  next();
};
