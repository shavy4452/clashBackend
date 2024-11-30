// middleware/cacheMiddleware.js
const NodeCache = require('node-cache');

// cacheDuration is in seconds
const cacheMiddleware = (cacheDuration) => {
  const cache = new NodeCache({ stdTTL: cacheDuration, checkperiod: 120 });

  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    } else {
      res.sendResponse = res.json;
      res.json = (body) => {
        cache.set(key, body, cacheDuration);
        res.sendResponse(body);
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;
