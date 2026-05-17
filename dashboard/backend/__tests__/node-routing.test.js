// ─────────────────────────────────────────────
// Integration tests: ?node= routing
// Verifies that proxy endpoints route to specific
// registered validators via the ?node= query param.
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-node-routing-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

jest.mock("axios", () => {
  const create = jest.fn(() => ({
    get: jest.fn(),
  }));
  return { create };
});

let app;

beforeAll(() => {
  process.env.REGISTRY_DB_PATH = TEST_DB;

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

  const { registerNode, updateNodeHealth } = require("../services/registry");
  registerNode({ node_id: "test-node", moniker: "Test Node", public_endpoint: "localhost", rpc_port: 26657, rest_port: 1317 });
  updateNodeHealth("test-node", { status: "online", block_height: 100, catching_up: false, latency_ms: 5 });

  const { clearPool } = require("../services/node-selector");
  clearPool();
});

afterAll(() => {
  const { closeDb } = require("../services/registry");
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

describe("GET /health?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/health?node=ghost-node");
    expect(res.status).toBe(404);
    expect(res.body.message).toContain("ghost-node");
  });

  it("routes to localhost when no node param provided", async () => {
    const axiosMod = require("axios");
    const tmMock = axiosMod.__tendermintMock;
    tmMock.get.mockResolvedValue({
      data: {
        result: {
          node_info: { network: "localchain", id: "abc" },
          sync_info: { latest_block_height: "42", catching_up: false },
        },
      },
    });

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.node).toBe("localhost");
  });
});

describe("GET /api/block/:height?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/block/1?node=ghost");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("ghost");
  });
});

describe("GET /api/blocks/latest?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/blocks/latest?node=ghost");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/tx/:hash?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/tx/abc123?node=ghost");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/txs?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/txs?node=ghost");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("ghost");
  });
});

describe("GET /api/validators?node=", () => {
  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/validators?node=ghost");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/nodes/select", () => {
  it("returns selected node with strategy", async () => {
    const res = await request(app).get("/api/nodes/select?strategy=lowest-latency");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("strategy");
  });

  it("supports round-robin strategy", async () => {
    const res = await request(app).get("/api/nodes/select?strategy=round-robin");
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe("round-robin");
  });
});

describe("GET /api/nodes/pool/stats", () => {
  it("returns connection pool statistics", async () => {
    const res = await request(app).get("/api/nodes/pool/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("size");
    expect(res.body).toHaveProperty("keys");
    expect(Array.isArray(res.body.keys)).toBe(true);
  });
});
