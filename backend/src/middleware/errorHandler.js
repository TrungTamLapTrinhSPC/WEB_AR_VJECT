export class AppError extends Error {
  constructor(code, message, statusCode = 400, details = []) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
  }

  console.error(err)
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] },
  })
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
