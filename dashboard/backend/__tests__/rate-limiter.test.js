const {
  createRateLimiter,
  createAddressBasedLimiter,
  getRateLimitStatus,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX_RECORD_SUBMISSIONS,
  DEFAULT_MAX_API_REQUESTS,
  DEFAULT_MAX_TX_QUERIES,
} = require("../middleware/rate-limiter");

describe("createRateLimiter", () => {
  it("creates a rate limiter with default options", () => {
    const limiter = createRateLimiter();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe("function");
  });

  it("creates a rate limiter with custom options", () => {
    const limiter = createRateLimiter({ windowMs: 30000, max: 5 });
    expect(limiter).toBeDefined();
  });
});

describe("createAddressBasedLimiter", () => {
  it("creates an address-based rate limiter", () => {
    const limiter = createAddressBasedLimiter();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe("function");
  });

  it("allows requests within limit", (done) => {
    const limiter = createAddressBasedLimiter({ windowMs: 60000, max: 3 });
    const req = { body: { creator: "addr1" }, ip: "127.0.0.1" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
    done();
  });

  it("blocks requests exceeding limit", (done) => {
    const limiter = createAddressBasedLimiter({ windowMs: 60000, max: 2 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const req1 = { body: { creator: "addr2" }, ip: "127.0.0.1" };
    const req2 = { body: { creator: "addr2" }, ip: "127.0.0.1" };
    const req3 = { body: { creator: "addr2" }, ip: "127.0.0.1" };

    limiter(req1, res, jest.fn());
    limiter(req2, res, jest.fn());
    limiter(req3, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Rate limit exceeded for this address",
        address: "addr2",
      })
    );
    done();
  });

  it("tracks different addresses separately", (done) => {
    const limiter = createAddressBasedLimiter({ windowMs: 60000, max: 1 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const req1 = { body: { creator: "addrA" }, ip: "127.0.0.1" };
    const req2 = { body: { creator: "addrB" }, ip: "127.0.0.1" };

    limiter(req1, res, jest.fn());
    const nextB = jest.fn();
    limiter(req2, res, nextB);

    expect(nextB).toHaveBeenCalled();
    done();
  });

  it("uses IP when no creator address", (done) => {
    const limiter = createAddressBasedLimiter({ windowMs: 60000, max: 1 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    const req1 = { ip: "10.0.0.1" };
    const req2 = { ip: "10.0.0.1" };

    limiter(req1, res, jest.fn());
    limiter(req2, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(429);
    done();
  });

  it("returns retryAfter in response", (done) => {
    const limiter = createAddressBasedLimiter({ windowMs: 60000, max: 1 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    limiter({ ip: "10.0.0.2" }, res, jest.fn());
    limiter({ ip: "10.0.0.2" }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        retryAfter: expect.any(Number),
      })
    );
    done();
  });
});

describe("getRateLimitStatus", () => {
  it("returns configuration status", () => {
    const status = getRateLimitStatus();
    expect(status.defaultWindowMs).toBe(DEFAULT_WINDOW_MS);
    expect(status.defaultMaxRecordSubmissions).toBe(DEFAULT_MAX_RECORD_SUBMISSIONS);
    expect(status.defaultMaxApiRequests).toBe(DEFAULT_MAX_API_REQUESTS);
    expect(status.defaultMaxTxQueries).toBe(DEFAULT_MAX_TX_QUERIES);
  });
});

describe("constants", () => {
  it("has correct default window", () => {
    expect(DEFAULT_WINDOW_MS).toBe(60000);
  });

  it("has correct default record submission limit", () => {
    expect(DEFAULT_MAX_RECORD_SUBMISSIONS).toBe(10);
  });

  it("has correct default API request limit", () => {
    expect(DEFAULT_MAX_API_REQUESTS).toBe(100);
  });

  it("has correct default TX query limit", () => {
    expect(DEFAULT_MAX_TX_QUERIES).toBe(50);
  });
});
