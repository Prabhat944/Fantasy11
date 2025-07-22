const rateLimit = require('express-rate-limit');

// A general limiter for most API calls.
// Allows 100 requests per 15 minutes from a single IP.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7', // Recommended setting for RateLimit headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// A stricter limiter for sensitive actions like joining contests or creating teams.
// Allows 20 requests per 15 minutes.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many attempts to join contests or create teams. Please try again later.'
});

const financialLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many financial transactions from this IP. Please try again after an hour.'
  });

module.exports = {
  generalLimiter,
  sensitiveActionLimiter,
  financialLimiter
};