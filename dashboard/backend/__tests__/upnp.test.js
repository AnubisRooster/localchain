const fs = require("fs");
const path = require("path");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `lc-upnp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

let getLocalIp, getStatus, closeDb, registerNode, getAllNodes;

beforeAll(() => {
  process.env.AUTH_DB_PATH = TEST_DB;
  process.env.REGISTRY_DB_PATH = TEST_DB;
  jest.resetModules();

  const registry = require("../services/registry");
  registerNode = registry.registerNode;
  getAllNodes = registry.getAllNodes;
  closeDb = registry.closeDb;

  const upnp = require("../services/upnp");
  getLocalIp = upnp.getLocalIp;
  getStatus = upnp.getStatus;
});

afterAll(() => {
  closeDb();
  [TEST_DB, TEST_DB + "-wal", TEST_DB + "-shm"].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

describe("getLocalIp", () => {
  it("returns a valid IPv4 address", () => {
    const ip = getLocalIp();
    expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(ip).not.toBe("127.0.0.1");
  });
});

describe("getStatus", () => {
  it("returns status object with expected fields", async () => {
    const status = await getStatus();
    expect(status).toHaveProperty("enabled");
    expect(status).toHaveProperty("initialized");
    expect(status).toHaveProperty("externalIp");
    expect(status).toHaveProperty("mappedPorts");
    expect(status).toHaveProperty("localIp");
    expect(status).toHaveProperty("localNetworks");
    expect(status).toHaveProperty("discoveryLog");
    expect(status).toHaveProperty("discoveryIntervalMs");
    expect(Array.isArray(status.localNetworks)).toBe(true);
    expect(Array.isArray(status.mappedPorts)).toBe(true);
  });

  it("shows UPnP disabled by default", async () => {
    delete process.env.UPNP_ENABLED;
    const status = await getStatus();
    expect(status.enabled).toBe(false);
  });

  it("shows UPnP enabled when env var set", async () => {
    process.env.UPNP_ENABLED = "1";
    const status = await getStatus();
    expect(status.enabled).toBe(true);
    delete process.env.UPNP_ENABLED;
  });
});

describe("autoRegisterDiscovered", () => {
  it("registers discovered nodes that are not already in registry", async () => {
    const { autoRegisterDiscovered } = require("../services/upnp");

    const discovered = [
      {
        host: "192.168.68.100",
        rpcPort: 26657,
        restPort: 1317,
        p2pPort: 26656,
        nodeId: "test-node-1",
        moniker: "Test Node 1",
        network: "localchain",
      },
    ];

    const registered = await autoRegisterDiscovered(discovered);
    expect(registered.length).toBe(1);
    expect(registered[0].node_id).toBe("test-node-1");

    const nodes = getAllNodes();
    const found = nodes.find((n) => n.node_id === "test-node-1");
    expect(found).toBeDefined();
    expect(found.public_endpoint).toBe("192.168.68.100");
  });

  it("skips nodes already in registry", async () => {
    const { autoRegisterDiscovered } = require("../services/upnp");

    registerNode({
      node_id: "existing-node",
      moniker: "Existing",
      public_endpoint: "192.168.68.200",
    });

    const discovered = [
      {
        host: "192.168.68.200",
        rpcPort: 26657,
        restPort: 1317,
        p2pPort: 26656,
        nodeId: "existing-node",
        moniker: "Existing",
        network: "localchain",
      },
    ];

    const registered = await autoRegisterDiscovered(discovered);
    expect(registered.length).toBe(0);
  });
});
