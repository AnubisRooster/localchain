// ─────────────────────────────────────────────
// Integration tests: Validator Registry API
// POST /api/nodes/register, GET /api/nodes, GET /api/nodes/stats,
// GET /api/nodes/:nodeId, DELETE /api/nodes/:nodeId
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-registry-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

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

describe("POST /api/nodes/register", () => {
  it("registers a new validator node", async () => {
    const res = await request(app)
      .post("/api/nodes/register")
      .send({
        node_id: "api-test-node-1",
        moniker: "API Test Validator",
        public_endpoint: "192.168.1.10",
        rpc_port: 26657,
        rest_port: 1317,
        p2p_port: 26656,
        version: "0.1.0",
        network: "localchain",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.node_id).toBe("api-test-node-1");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/nodes/register")
      .send({ moniker: "Incomplete" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("upserts on duplicate node_id", async () => {
    await request(app)
      .post("/api/nodes/register")
      .send({
        node_id: "api-test-node-1",
        moniker: "Updated Moniker",
        public_endpoint: "192.168.1.20",
      });

    const res = await request(app).get("/api/nodes/api-test-node-1");
    expect(res.status).toBe(200);
    expect(res.body.moniker).toBe("Updated Moniker");
    expect(res.body.public_endpoint).toBe("192.168.1.20");
  });
});

describe("GET /api/nodes", () => {
  it("returns all registered nodes", async () => {
    const res = await request(app).get("/api/nodes");

    expect(res.status).toBe(200);
    expect(res.body.nodes).toBeInstanceOf(Array);
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    const node = res.body.nodes.find((n) => n.node_id === "api-test-node-1");
    expect(node).toBeDefined();
    expect(node.moniker).toBe("Updated Moniker");
  });
});

describe("GET /api/nodes/stats", () => {
  it("returns aggregate registry statistics", async () => {
    const res = await request(app).get("/api/nodes/stats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("online");
    expect(res.body).toHaveProperty("offline");
    expect(res.body).toHaveProperty("unknown");
    expect(res.body).toHaveProperty("max_height");
    expect(res.body).toHaveProperty("avg_latency");
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/nodes/:nodeId", () => {
  it("returns a specific node", async () => {
    const res = await request(app).get("/api/nodes/api-test-node-1");

    expect(res.status).toBe(200);
    expect(res.body.node_id).toBe("api-test-node-1");
    expect(res.body.moniker).toBe("Updated Moniker");
  });

  it("returns 404 for non-existent node", async () => {
    const res = await request(app).get("/api/nodes/non-existent-node");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Node not found");
  });
});

describe("DELETE /api/nodes/:nodeId", () => {
  it("deletes a registered node", async () => {
    await request(app)
      .post("/api/nodes/register")
      .send({
        node_id: "to-be-deleted",
        moniker: "Delete Me",
        public_endpoint: "10.0.0.1",
      });

    const res = await request(app).delete("/api/nodes/to-be-deleted");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const verify = await request(app).get("/api/nodes/to-be-deleted");
    expect(verify.status).toBe(404);
  });

  it("returns 404 when deleting non-existent node", async () => {
    const res = await request(app).delete("/api/nodes/ghost-node");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Node not found");
  });
});
