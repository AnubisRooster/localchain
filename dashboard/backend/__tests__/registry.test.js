const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let registerNode, updateNodeHealth, markNodeOffline, getAllNodes, getNodeById, deleteNodeById, getStats, getStaleNodes, getOnlineEndpoints, closeDb;

beforeAll(() => {
  process.env.REGISTRY_DB_PATH = TEST_DB;
  jest.resetModules();
  const mod = require("../services/registry");
  registerNode = mod.registerNode;
  updateNodeHealth = mod.updateNodeHealth;
  markNodeOffline = mod.markNodeOffline;
  getAllNodes = mod.getAllNodes;
  getNodeById = mod.getNodeById;
  deleteNodeById = mod.deleteNodeById;
  getStats = mod.getStats;
  getStaleNodes = mod.getStaleNodes;
  getOnlineEndpoints = mod.getOnlineEndpoints;
  closeDb = mod.closeDb;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("registerNode", () => {
  it("registers a new validator node", () => {
    const result = registerNode({
      node_id: "test-node-1",
      moniker: "Test Validator 1",
      public_endpoint: "10.0.0.1",
      rpc_port: 26657,
      rest_port: 1317,
      p2p_port: 26656,
      version: "0.1.0",
      network: "localchain",
    });
    expect(result.success).toBe(true);
    expect(result.node_id).toBe("test-node-1");
    expect(result.changes).toBe(1);
  });

  it("upserts on duplicate node_id", () => {
    registerNode({
      node_id: "test-node-1",
      moniker: "Old Moniker",
      public_endpoint: "10.0.0.1",
    });
    const result = registerNode({
      node_id: "test-node-1",
      moniker: "Updated Moniker",
      public_endpoint: "10.0.0.2",
      version: "0.2.0",
    });
    expect(result.success).toBe(true);
    expect(result.changes).toBe(1);

    const node = getNodeById("test-node-1");
    expect(node.moniker).toBe("Updated Moniker");
    expect(node.public_endpoint).toBe("10.0.0.2");
    expect(node.version).toBe("0.2.0");
  });

  it("uses default ports when not provided", () => {
    const result = registerNode({
      node_id: "test-node-defaults",
      moniker: "Default Ports",
      public_endpoint: "10.0.0.99",
    });
    expect(result.success).toBe(true);

    const node = getNodeById("test-node-defaults");
    expect(node.rpc_port).toBe(26657);
    expect(node.rest_port).toBe(1317);
    expect(node.p2p_port).toBe(26656);
  });
});

describe("getAllNodes", () => {
  it("returns all registered nodes ordered by registration time", () => {
    const nodes = getAllNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    expect(nodes[0]).toHaveProperty("node_id");
    expect(nodes[0]).toHaveProperty("moniker");
    expect(nodes[0]).toHaveProperty("public_endpoint");
    expect(nodes[0]).toHaveProperty("status");
  });
});

describe("getNodeById", () => {
  it("returns a specific node by node_id", () => {
    const node = getNodeById("test-node-1");
    expect(node).toBeDefined();
    expect(node.node_id).toBe("test-node-1");
    expect(node.moniker).toBe("Updated Moniker");
  });

  it("returns undefined for non-existent node", () => {
    const node = getNodeById("non-existent");
    expect(node).toBeUndefined();
  });
});

describe("updateNodeHealth", () => {
  it("updates health fields for a registered node", () => {
    updateNodeHealth("test-node-1", {
      status: "online",
      block_height: 12345,
      catching_up: false,
      latency_ms: 42,
    });

    const node = getNodeById("test-node-1");
    expect(node.status).toBe("online");
    expect(node.block_height).toBe(12345);
    expect(node.catching_up).toBe(0);
    expect(node.latency_ms).toBe(42);
    expect(node.last_seen).not.toBeNull();
  });

  it("marks node as catching_up", () => {
    updateNodeHealth("test-node-1", {
      status: "online",
      block_height: 100,
      catching_up: true,
      latency_ms: 100,
    });

    const node = getNodeById("test-node-1");
    expect(node.catching_up).toBe(1);
  });
});

describe("markNodeOffline", () => {
  it("marks a node as offline", () => {
    markNodeOffline("test-node-1");
    const node = getNodeById("test-node-1");
    expect(node.status).toBe("offline");
  });
});

describe("deleteNodeById", () => {
  it("deletes an existing node", () => {
    registerNode({
      node_id: "to-delete",
      moniker: "Delete Me",
      public_endpoint: "10.0.0.50",
    });

    const result = deleteNodeById("to-delete");
    expect(result.success).toBe(true);
    expect(result.node_id).toBe("to-delete");

    const node = getNodeById("to-delete");
    expect(node).toBeUndefined();
  });

  it("returns success false for non-existent node", () => {
    const result = deleteNodeById("ghost-node");
    expect(result.success).toBe(false);
  });
});

describe("getStats", () => {
  it("returns aggregate statistics", () => {
    const stats = getStats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("online");
    expect(stats).toHaveProperty("offline");
    expect(stats).toHaveProperty("unknown");
    expect(stats).toHaveProperty("max_height");
    expect(stats).toHaveProperty("avg_latency");
    expect(stats.total).toBeGreaterThanOrEqual(2);
  });
});

describe("getStaleNodes", () => {
  it("returns nodes that have not been seen recently", () => {
    registerNode({
      node_id: "stale-node",
      moniker: "Stale",
      public_endpoint: "10.0.0.60",
    });
    const stale = getStaleNodes();
    expect(stale).toContain("stale-node");
  });
});

describe("getOnlineEndpoints", () => {
  it("returns only online nodes", () => {
    updateNodeHealth("test-node-1", {
      status: "online",
      block_height: 100,
      catching_up: false,
      latency_ms: 10,
    });

    const endpoints = getOnlineEndpoints();
    const found = endpoints.find((e) => e.public_endpoint === "10.0.0.2");
    expect(found).toBeDefined();
  });
});
