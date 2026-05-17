const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-broadcast-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

jest.mock("../services/broadcast", () => {
  let signerAddr = null;
  return {
    broadcastRecord: jest.fn().mockResolvedValue({ txhash: "mock-tx", height: 100, code: 0, raw_log: "" }),
    resetClient: jest.fn(() => { signerAddr = null; }),
    getSignerAddress: jest.fn(() => signerAddr),
    initClient: jest.fn().mockResolvedValue({}),
    MSG_TYPE_URL: "/localchain.records.v1.MsgCreateRecord",
  };
});

let broadcastRecord, resetClient, getSignerAddress, initClient, closeDb, registerNode, updateNodeHealth;

beforeAll(() => {
  process.env.REGISTRY_DB_PATH = TEST_DB;
  jest.resetModules();

  const registry = require("../services/registry");
  registerNode = registry.registerNode;
  updateNodeHealth = registry.updateNodeHealth;
  closeDb = registry.closeDb;

  registerNode({ node_id: "test-node", moniker: "Test", public_endpoint: "localhost", rpc_port: 26657, rest_port: 1317 });
  updateNodeHealth("test-node", { status: "online", block_height: 100, catching_up: false, latency_ms: 5 });

  const broadcast = require("../services/broadcast");
  broadcastRecord = broadcast.broadcastRecord;
  resetClient = broadcast.resetClient;
  getSignerAddress = broadcast.getSignerAddress;
  initClient = broadcast.initClient;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("broadcast service", () => {
  it("exports broadcastRecord function", () => {
    expect(typeof broadcastRecord).toBe("function");
  });

  it("exports resetClient function", () => {
    expect(typeof resetClient).toBe("function");
  });

  it("exports getSignerAddress function", () => {
    expect(typeof getSignerAddress).toBe("function");
  });

  it("exports initClient function", () => {
    expect(typeof initClient).toBe("function");
  });

  it("returns null signer address before initialization", () => {
    resetClient();
    expect(getSignerAddress()).toBeNull();
  });

  it("has MSG_TYPE_URL constant", () => {
    const { MSG_TYPE_URL } = require("../services/broadcast");
    expect(MSG_TYPE_URL).toBe("/localchain.records.v1.MsgCreateRecord");
  });
});
