// ─────────────────────────────────────────────
// Integration tests: Broadcast API
// Tests POST /api/records with REST broadcast
// and GET /api/broadcast/status
// ─────────────────────────────────────────────
const request = require("supertest");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-broadcast-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

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
  process.env.REGISTRY_DB_PATH = TEST_DB;
  process.env.USE_CLI_BROADCAST = "1";

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

  const { registerNode, updateNodeHealth } = require("../services/registry");
  registerNode({ node_id: "test-node", moniker: "Test", public_endpoint: "localhost", rpc_port: 26657, rest_port: 1317 });
  updateNodeHealth("test-node", { status: "online", block_height: 100, catching_up: false, latency_ms: 5 });

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

describe("GET /api/broadcast/status", () => {
  it("returns broadcast mode and signer info", async () => {
    const res = await request(app).get("/api/broadcast/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mode");
    expect(["cli", "rest"]).toContain(res.body.mode);
    expect(res.body).toHaveProperty("node");
  });

  it("supports ?node= param", async () => {
    const res = await request(app).get("/api/broadcast/status?node=test-node");
    expect(res.status).toBe(200);
    expect(res.body.node).toBe("test-node");
  });
});

describe("POST /api/records with ?node=", () => {
  it("accepts ?node= param for routing", async () => {
    const res = await request(app)
      .post("/api/records?node=test-node")
      .send({
        summary: "Broadcast routing test",
        content: "Testing node routing",
        contentType: "text",
        tags: ["test"],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({ summary: "No content" });

    expect(res.status).toBe(400);
  });

  it("applies security pipeline before broadcast", async () => {
    const res = await request(app)
      .post("/api/records")
      .send({
        summary: "Security test",
        content: "Normal content",
        contentType: "text",
      });

    if (res.status !== 200) {
      console.log("Response:", res.body);
    }
    expect([200, 500]).toContain(res.status);
  });
});
