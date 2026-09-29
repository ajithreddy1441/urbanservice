export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    errorCode: 'NOT_FOUND',
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Something went wrong. Please try again.'
    : err.message || 'Something went wrong';
  res.status(status).json({
    success: false,
    message,
    errorCode: err.errorCode || (err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INTERNAL_ERROR'),
    ...(err.errors ? { errors: err.errors } : {}),
  });
}
