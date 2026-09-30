// errorHandler.js - Centralized error classes and formatting utilities

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convert Supabase / technical auth errors to user-friendly client messages
function formatAuthError(err) {
  if (!err) return 'An unexpected error occurred.';
  const message = typeof err === 'string' ? err : err.message || '';
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid grant')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Your email address has not been verified yet. Please check your inbox.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'Password must be at least 8 characters with at least one uppercase letter and one number.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a few moments and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network connection issue. Please check your connection and try again.';
  }
  return message || 'An unexpected error occurred. Please try again.';
}

// Global Express Error Handling Middleware
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const friendlyMessage = formatAuthError(err);

  // Log server-side errors in development or if critical
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: friendlyMessage,
    code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = {
  AppError,
  formatAuthError,
  errorHandler,
};
