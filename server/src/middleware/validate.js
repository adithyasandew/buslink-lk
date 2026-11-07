import { AppError } from './errors.js';

/** Validate req[source] with a zod schema; replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  // req.query is a read-only getter in Express 5, so redefine it instead of assigning.
  Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true, enumerable: true });
  next();
};
