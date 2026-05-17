const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let createKey, validateKey, revokeKey, listKeys, getKey, checkRateLimit, closeDb;

beforeAll(() => {
  process.env.AUTH_DB_PATH = TEST_DB;
  jest.resetModules();
  const mod = require("../services/auth");
  createKey = mod.createKey;
  validateKey = mod.validateKey;
  revokeKey = mod.revokeKey;
  listKeys = mod.listKeys;
  getKey = mod.getKey;
  checkRateLimit = mod.checkRateLimit;
  closeDb = mod.closeDb;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("createKey", () => {
  it("generates a new API key", () => {
    const result = createKey({ label: "test-key" });
    expect(result.raw).toMatch(/^lc_[A-Za-z0-9_-]+$/);
    expect(result.prefix).toHaveLength(8);
    expect(result.label).toBe("test-key");
    expect(result.rate_limit).toBe(1000);
  });

  it("sets expiry when expiresInDays provided", () => {
    const result = createKey({ label: "expiring", expiresInDays: 7 });
    expect(result.expires_at).not.toBeNull();
    const expiry = new Date(result.expires_at);
    const now = new Date();
    const diffDays = (expiry - now) / 86400000;
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThan(8);
  });

  it("uses custom rate limits", () => {
    const result = createKey({ label: "limited", rateLimit: 100, rateWindow: 600 });
    expect(result.rate_limit).toBe(100);
  });
});

describe("validateKey", () => {
  it("validates a correct key", () => {
    const { raw } = createKey({ label: "valid-test" });
    const result = validateKey(raw);
    expect(result.valid).toBe(true);
    expect(result.key.label).toBe("valid-test");
  });

  it("rejects invalid keys", () => {
    const result = validateKey("lc_invalidkey123");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_key");
  });

  it("rejects expired keys", () => {
    const { raw } = createKey({ label: "expired-test", expiresInDays: -1 });
    const result = validateKey(raw);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });
});

describe("revokeKey", () => {
  it("revokes an existing key", () => {
    const { raw } = createKey({ label: "revoke-test" });
    const { key } = validateKey(raw);
    const result = revokeKey(key.id);
    expect(result.success).toBe(true);

    const validateResult = validateKey(raw);
    expect(validateResult.valid).toBe(false);
  });

  it("returns false for non-existent key", () => {
    const result = revokeKey(99999);
    expect(result.success).toBe(false);
  });
});

describe("listKeys", () => {
  it("returns all keys without raw values", () => {
    createKey({ label: "list-test-1" });
    createKey({ label: "list-test-2" });

    const keys = listKeys();
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys[0]).not.toHaveProperty("key_hash");
    expect(keys[0]).toHaveProperty("key_prefix");
    expect(keys[0]).toHaveProperty("label");
  });
});

describe("getKey", () => {
  it("returns a specific key by id", () => {
    createKey({ label: "get-test" });
    const keys = listKeys();
    const key = keys.find((k) => k.label === "get-test");
    expect(key).toBeDefined();
    expect(key.label).toBe("get-test");
  });

  it("returns undefined for non-existent id", () => {
    const key = getKey(99999);
    expect(key).toBeUndefined();
  });
});

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    const { raw } = createKey({ label: "rate-test", rateLimit: 5, rateWindow: 60 });
    const { key } = validateKey(raw);
    const allowed = checkRateLimit(key.id, 5, 60);
    expect(allowed).toBe(true);
  });
});
