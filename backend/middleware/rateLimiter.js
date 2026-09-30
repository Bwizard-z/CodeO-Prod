// middleware/rateLimiter.js - Production-grade rate limiting powered by express-rate-limit
const rateLimit = require('express-rate-limit');

/**
 * Factory for creating standardized express-rate-limit middleware
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 30,
  limit,
  max,
  message = 'Too many requests. Please try again later.',
  keyGenerator,
} = {}) {
  const maxHits = limit || max || maxRequests;
  const msgText = typeof message === 'string' ? message : 'Too many requests. Please try again later.';

  return rateLimit({
    windowMs,
    limit: maxHits,
    standardHeaders: 'draft-7', // Sends standard RateLimit-* headers
    legacyHeaders: false,
    statusCode: 429,
    message: {
      success: false,
      error: msgText,
      code: 'RATE_LIMIT_EXCEEDED',
    },
    validate: false,
    ...(keyGenerator ? { keyGenerator } : {}),
  });
}

// 1. Authentication Limiter (Brute-force protection for login, signup, passwords)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,          // 30 attempts per 15 minutes per IP
  message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
});

// 2. Gemini Code Explanation Limiter (protects AI token quotas)
const explainLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,     // 10 explanation requests per minute
  message: 'Too many explanation requests. Please wait a minute and try again.',
});

// 3. Judge0 Code Execution Limiter (protects server CPU, containers & compiler resources)
const executeLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 code executions per minute
  message: 'Too many code execution attempts. Please wait a minute before executing code again.',
});

// 4. Baseline Global API Limiter (broad Layer 7 anti-scraping & flood protection)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500,         // 500 requests per 15 min per IP
  message: 'Too many API requests from this IP. Please slow down and try again later.',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  explainLimiter,
  executeLimiter,
  apiLimiter,
};
