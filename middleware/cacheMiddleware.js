const NodeCache = require('node-cache');

// cacheDuration is in seconds
const cacheMiddleware = (cacheDuration) => {
  const cache = new NodeCache({ stdTTL: cacheDuration, checkperiod: 60 });

  return (req, res, next) => {
    const key = req.originalUrl || req.url;

    // Check for the "x-bypass-cache" header
    if (req.headers['x-bypass-cache'] === 'true') {
      return next(); // Skip cache and fetch fresh data
    }

    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse); // Serve cached response
    } else {
      res.sendResponse = res.json;
      res.json = (body) => {
        cache.set(key, body, cacheDuration); // Cache response
        res.sendResponse(body);
      };
      next(); // Proceed to next middleware/route
    }
  };
};

module.exports = cacheMiddleware;
