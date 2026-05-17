// ─────────────────────────────────────────────
// Integration tests: Auth API
// POST /api/auth/keys, GET /api/auth/keys,
// DELETE /api/auth/keys/:id, GET /api/auth/validate
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-auth-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

jest.mock("axios", () => {
  const create = jest.fn(() => ({
    get: jest.fn(),
  }));
  return { create };
});

jest.mock("../services/broadcast", () => ({
  broadcastRecord: jest.fn().mockResolvedValue({ txhash: "mock-tx", height: 100, code: 0, raw_log: "" }),
  resetClient: jest.fn(),
  getSignerAddress: jest.fn(() => "cosmos1mock"),
  initClient: jest.fn().mockResolvedValue({}),
  MSG_TYPE_URL: "/localchain.records.v1.MsgCreateRecord",
}));

let app;

beforeAll(() => {
  process.env.AUTH_DB_PATH = TEST_DB;

  const mockGet = jest.fn();
  axios.create.mockReturnValue({ get: mockGet });

  jest.resetModules();
  jest.mock("axios", () => {
    const cosmosMock = { get: jest.fn() };
    const tendermintMock = { get: jest.fn() };
    let callCount = 0;
    return {
      create: jest.fn(() => {
        callCount++;
        return callCount === 1 ? cosmosMock : tendermintMock;
      }),
      get: jest.fn(),
      __cosmosMock: cosmosMock,
      __tendermintMock: tendermintMock,
    };
  });

  const server = require("../server");
  app = server.app;
});

afterAll(() => {
  const { closeDb } = require("../services/auth");
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
  jest.useFakeTimers();
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/keys", () => {
  it("creates a new API key", async () => {
    const res = await request(app)
      .post("/api/auth/keys")
      .send({ label: "integration-test", expiresInDays: 30, rateLimit: 500 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("raw");
    expect(res.body.raw).toMatch(/^lc_[A-Za-z0-9_-]+$/);
    expect(res.body).toHaveProperty("prefix");
    expect(res.body.label).toBe("integration-test");
  });

  it("creates with defaults", async () => {
    const res = await request(app)
      .post("/api/auth/keys")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.rate_limit).toBe(1000);
  });
});

describe("GET /api/auth/keys", () => {
  it("lists all keys", async () => {
    const res = await request(app).get("/api/auth/keys");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("keys");
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/auth/keys/:id", () => {
  it("returns a specific key", async () => {
    const listRes = await request(app).get("/api/auth/keys");
    const id = listRes.body.keys[0].id;

    const res = await request(app).get(`/api/auth/keys/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("returns 404 for non-existent key", async () => {
    const res = await request(app).get("/api/auth/keys/99999");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/auth/keys/:id", () => {
  it("revokes a key", async () => {
    const createRes = await request(app)
      .post("/api/auth/keys")
      .send({ label: "to-revoke" });

    const listRes = await request(app).get("/api/auth/keys");
    const key = listRes.body.keys.find((k) => k.key_prefix === createRes.body.prefix);

    const res = await request(app).delete(`/api/auth/keys/${key.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 for non-existent key", async () => {
    const res = await request(app).delete("/api/auth/keys/99999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/auth/validate", () => {
  it("validates a correct key", async () => {
    const createRes = await request(app)
      .post("/api/auth/keys")
      .send({ label: "validate-test" });

    const res = await request(app)
      .get("/api/auth/validate")
      .set("X-API-Key", createRes.body.raw);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it("rejects invalid key", async () => {
    const res = await request(app)
      .get("/api/auth/validate")
      .set("X-API-Key", "lc_invalid");

    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.valid).toBe(false);
    }
  });

  it("returns 400 without header", async () => {
    const res = await request(app).get("/api/auth/validate");
    expect(res.status).toBe(400);
  });
});
