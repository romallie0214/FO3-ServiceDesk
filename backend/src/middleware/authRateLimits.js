const { rateLimit } = require('express-rate-limit');
const make = (limit, windowMs) => rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please wait before trying again.' } });
module.exports = { loginLimiter: make(30, 15 * 60000), verifyLimiter: make(30, 10 * 60000), resendLimiter: make(3, 60000), setupLimiter: make(10, 10 * 60000) };
