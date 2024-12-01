const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  },
});

module.exports = limiter;
