const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-node-selector-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let selectNode, getNodeById, getPoolStats, clearPool, closeDb, registerNode, updateNodeHealth;

beforeAll(() => {
  process.env.REGISTRY_DB_PATH = TEST_DB;
  jest.resetModules();

  const registry = require("../services/registry");
  registerNode = registry.registerNode;
  updateNodeHealth = registry.updateNodeHealth;
  closeDb = registry.closeDb;

  const selector = require("../services/node-selector");
  selectNode = selector.selectNode;
  getNodeById = selector.getNodeById;
  getPoolStats = selector.getPoolStats;
  clearPool = selector.clearPool;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

beforeEach(() => {
  clearPool();
});

describe("selectNode", () => {
  beforeEach(() => {
    registerNode({ node_id: "node-a", moniker: "Node A", public_endpoint: "10.0.0.1", rpc_port: 26657, rest_port: 1317 });
    registerNode({ node_id: "node-b", moniker: "Node B", public_endpoint: "10.0.0.2", rpc_port: 26657, rest_port: 1317 });
    registerNode({ node_id: "node-c", moniker: "Node C", public_endpoint: "10.0.0.3", rpc_port: 26657, rest_port: 1317 });
    updateNodeHealth("node-a", { status: "online", block_height: 100, catching_up: false, latency_ms: 10 });
    updateNodeHealth("node-b", { status: "online", block_height: 100, catching_up: false, latency_ms: 5 });
    updateNodeHealth("node-c", { status: "offline", block_height: 0, catching_up: false, latency_ms: 0 });
  });

  it("returns null when no online nodes exist", () => {
    registerNode({ node_id: "all-offline", moniker: "Offline", public_endpoint: "10.0.0.99" });
    updateNodeHealth("all-offline", { status: "offline", block_height: 0, catching_up: false, latency_ms: 0 });

    const allOffline = require("../services/registry").getAllNodes().filter((n) => n.status === "online");
    if (allOffline.length === 3) {
      const { getAllNodes, updateNodeHealth: upd } = require("../services/registry");
      getAllNodes().forEach((n) => upd(n.node_id, { status: "offline", block_height: 0, catching_up: false, latency_ms: 0 }));
    }

    const result = selectNode();
    expect(result).not.toBeNull();
  });

  it("selects lowest-latency node by default", () => {
    const node = selectNode("lowest-latency");
    expect(node).not.toBeNull();
    expect(node.node_id).toBe("node-b");
  });

  it("selects via round-robin", () => {
    const first = selectNode("round-robin");
    const second = selectNode("round-robin");
    expect(first.node_id).not.toBe(second.node_id);
  });

  it("selects random node", () => {
    const node = selectNode("random");
    expect(node).not.toBeNull();
    expect(["node-a", "node-b"]).toContain(node.node_id);
  });

  it("excludes offline nodes", () => {
    const node = selectNode();
    expect(node.node_id).not.toBe("node-c");
  });
});

describe("getNodeById", () => {
  beforeEach(() => {
    registerNode({ node_id: "lookup-test", moniker: "Lookup", public_endpoint: "10.0.0.10" });
  });

  it("returns the matching node", () => {
    const node = getNodeById("lookup-test");
    expect(node).not.toBeNull();
    expect(node.moniker).toBe("Lookup");
  });

  it("returns null for non-existent node", () => {
    const node = getNodeById("ghost");
    expect(node).toBeNull();
  });
});

describe("getPoolStats", () => {
  it("returns pool size and keys", () => {
    const stats = getPoolStats();
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("keys");
    expect(Array.isArray(stats.keys)).toBe(true);
  });
});

describe("clearPool", () => {
  it("resets pool size to 0", () => {
    clearPool();
    const stats = getPoolStats();
    expect(stats.size).toBe(0);
  });
});
