import { AppError } from './errors.js';

/** Validate req[source] with a zod schema; replaces it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  req[source] = result.data;
  next();
};
