const rateLimit = require("express-rate-limit");

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_RECORD_SUBMISSIONS = 10;
const DEFAULT_MAX_API_REQUESTS = 100;
const DEFAULT_MAX_TX_QUERIES = 50;

function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || DEFAULT_WINDOW_MS,
    max: options.max || DEFAULT_MAX_API_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((options.windowMs || DEFAULT_WINDOW_MS) / 1000),
    },
  });
}

const recordSubmissionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: DEFAULT_MAX_RECORD_SUBMISSIONS,
});

const apiRequestLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: DEFAULT_MAX_API_REQUESTS,
});

const txQueryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: DEFAULT_MAX_TX_QUERIES,
});

function createAddressBasedLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_MAX_RECORD_SUBMISSIONS;
  const submissions = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, data] of submissions.entries()) {
      if (now - data.windowStart > windowMs) {
        submissions.delete(key);
      }
    }
  }

  setInterval(cleanup, windowMs);

  return function addressLimiter(req, res, next) {
    const address = req.body?.creator || req.ip || "unknown";
    const now = Date.now();

    if (!submissions.has(address)) {
      submissions.set(address, { count: 1, windowStart: now });
      return next();
    }

    const data = submissions.get(address);
    if (now - data.windowStart > windowMs) {
      data.count = 1;
      data.windowStart = now;
      return next();
    }

    data.count++;
    if (data.count > max) {
      return res.status(429).json({
        error: "Rate limit exceeded for this address",
        address,
        limit: max,
        windowMs,
        retryAfter: Math.ceil((windowMs - (now - data.windowStart)) / 1000),
      });
    }

    next();
  };
}

function getRateLimitStatus() {
  return {
    defaultWindowMs: DEFAULT_WINDOW_MS,
    defaultMaxRecordSubmissions: DEFAULT_MAX_RECORD_SUBMISSIONS,
    defaultMaxApiRequests: DEFAULT_MAX_API_REQUESTS,
    defaultMaxTxQueries: DEFAULT_MAX_TX_QUERIES,
  };
}

module.exports = {
  createRateLimiter,
  recordSubmissionLimiter,
  apiRequestLimiter,
  txQueryLimiter,
  createAddressBasedLimiter,
  getRateLimitStatus,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX_RECORD_SUBMISSIONS,
  DEFAULT_MAX_API_REQUESTS,
  DEFAULT_MAX_TX_QUERIES,
};
