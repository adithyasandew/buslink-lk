// Centralized errors following docs/api/ERROR_FORMAT.md
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const known = err instanceof AppError;
  const status = known ? err.status : 500;
  const body = {
    success: false,
    error: {
      code: known ? err.code : 'INTERNAL_ERROR',
      message: known ? err.message : 'Something went wrong',
    },
  };
  if (known && err.details) body.error.details = err.details;
  res.status(status).json(body);
}
