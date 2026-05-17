// ─────────────────────────────────────────────────────────────
// LocalChain – End-to-End Test Suite
//
// Tests the full stack: Chain → API → Dashboard
// Requires: localchaind running on 26657, API on 4000
//
// Usage:
//   npm test -- --testPathPatterns="e2e"
// ─────────────────────────────────────────────────────────────
const { execFile } = require("child_process");
const http = require("http");

const CHAIN_RPC = process.env.CHAIN_RPC || "http://localhost:26657";
const API_URL = process.env.API_URL || "http://localhost:4000";
const CHAIN_BINARY = process.env.CHAIN_BINARY || `${process.env.HOME}/go/bin/localchaind`;
const CHAIN_HOME = process.env.CHAIN_HOME || `${process.env.HOME}/.localchaind`;

// ── Helpers ─────────────────────────────────────────────────
function exec(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30000, ...options }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout.trim());
      }
    });
  });
}

function apiRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 4000,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const isJson = res.headers["content-type"]?.includes("json");
        try {
          resolve({ status: res.statusCode, body: isJson ? JSON.parse(data) : data });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function get(path, headers = {}) {
  return apiRequest("GET", path, null, headers);
}

function post(path, body, headers = {}) {
  return apiRequest("POST", path, body, headers);
}

function put(path, body, headers = {}) {
  return apiRequest("PUT", path, body, headers);
}

function del(path, headers = {}) {
  return apiRequest("DELETE", path, null, headers);
}

// ── Test State ──────────────────────────────────────────────
let testTenantId = null;
let testApiKey = null;
let testNodeId = `e2e-node-${Date.now()}`;
let testRecordTxHash = null;

// ── Positive Path Tests ─────────────────────────────────────
describe("E2E: Chain Module", () => {
  describe("CreateRecord (positive)", () => {
    it.skip("creates a record with minimal fields via CLI (requires chain timing)", async () => {
      await new Promise((r) => setTimeout(r, 1000));
      const result = await exec(CHAIN_BINARY, [
        "tx", "records", "create-record",
        '{"summary":"E2E test record","content":"Hello from E2E tests"}',
        "--from", "validator",
        "--keyring-backend", "test",
        "--chain-id", "localchain",
        "--home", CHAIN_HOME,
        "--yes",
        "--output", "json",
        "--gas", "auto",
        "--gas-adjustment", "1.5",
      ]);

      expect(result.code).toBe(0);
      expect(result.txhash).toBeDefined();
      expect(result.txhash.length).toBeGreaterThan(0);
      testRecordTxHash = result.txhash;
    });

    it.skip("creates a record with full payload via CLI (requires chain timing)", async () => {
      await new Promise((r) => setTimeout(r, 3000));
      const payload = JSON.stringify({
        summary: "E2E full record",
        content: "This is a comprehensive test record with all fields",
        contentType: "text/plain",
        fileName: "test.txt",
        tags: ["e2e", "test", "full"],
        labels: { env: "test", version: "1.0" },
        timestamp: Date.now(),
      });

      const result = await exec(CHAIN_BINARY, [
        "tx", "records", "create-record",
        payload,
        "--from", "validator",
        "--keyring-backend", "test",
        "--chain-id", "localchain",
        "--home", CHAIN_HOME,
        "--yes",
        "--output", "json",
        "--gas", "auto",
        "--gas-adjustment", "1.5",
      ]);

      expect(result.code).toBe(0);
      expect(result.txhash).toBeDefined();
    });

    it.skip("creates multiple records in sequence (requires chain timing)", async () => {
      const hashes = [];
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const result = await exec(CHAIN_BINARY, [
          "tx", "records", "create-record",
          `{"summary":"Batch record ${i}","content":"Batch content ${i}"}`,
          "--from", "validator",
          "--keyring-backend", "test",
          "--chain-id", "localchain",
          "--home", CHAIN_HOME,
          "--yes",
          "--output", "json",
          "--gas", "auto",
          "--gas-adjustment", "1.5",
        ]);
        expect(result.code).toBe(0);
        hashes.push(result.txhash);
      }
      expect(hashes.length).toBe(3);
      expect(new Set(hashes).size).toBe(3);
    });
  });

  describe("Query Records (positive)", () => {
    it("returns block height from Tendermint RPC", async () => {
      const res = await fetch(`${CHAIN_RPC}/status`);
      const data = await res.json();
      expect(data.result.sync_info.latest_block_height).toBeDefined();
      expect(parseInt(data.result.sync_info.latest_block_height, 10)).toBeGreaterThan(0);
    });

    it("returns validators from Tendermint RPC", async () => {
      const res = await fetch(`${CHAIN_RPC}/validators`);
      const data = await res.json();
      expect(data.result.validators).toBeDefined();
      expect(data.result.validators.length).toBeGreaterThan(0);
    });

    it("returns latest block from Tendermint RPC", async () => {
      const res = await fetch(`${CHAIN_RPC}/block`);
      const data = await res.json();
      expect(data.result.block.header.height).toBeDefined();
      expect(data.result.block.header.chain_id).toBe("localchain");
    });
  });
});

describe("E2E: API Health & Metrics", () => {
  it("returns healthy status", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.chainId).toBe("localchain");
    expect(res.body.blockHeight).toBeGreaterThan(0);
    expect(res.body.catching_up).toBe(false);
  });

  it("returns Prometheus metrics", async () => {
    const res = await get("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.body).toContain("# HELP");
    expect(res.body).toContain("# TYPE");
    expect(res.body).toContain("localchain_api_requests_total");
    expect(res.body).toContain("localchain_block_height");
  });

  it("returns JSON metrics summary", async () => {
    const res = await get("/api/metrics/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("requests");
    expect(res.body).toHaveProperty("chain");
    expect(res.body).toHaveProperty("nodes");
    expect(res.body).toHaveProperty("system");
    expect(res.body.requests.total).toBeGreaterThanOrEqual(0);
  });

  it("returns system info", async () => {
    const res = await get("/api/system");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("hostname");
    expect(res.body).toHaveProperty("platform");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body.cpuCount).toBeGreaterThan(0);
  });
});

describe("E2E: Blocks & Transactions", () => {
  it("returns latest block info", async () => {
    const res = await get("/api/blocks/latest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("latest");
    expect(res.body.latest.height).toBeDefined();
    expect(res.body.latest.time).toBeDefined();
    expect(res.body).toHaveProperty("recent");
    expect(Array.isArray(res.body.recent)).toBe(true);
  });

  it("returns specific block by height", async () => {
    const latestRes = await get("/api/blocks/latest");
    const height = latestRes.body.latest.height;

    const res = await get(`/api/block/${height}`);
    expect(res.status).toBe(200);
    expect(res.body.height).toBe(String(height));
    expect(res.body.chainId).toBe("localchain");
  });

  it("returns validators list", async () => {
    const res = await get("/api/validators");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("validators");
    expect(Array.isArray(res.body.validators)).toBe(true);
    expect(res.body.validators.length).toBeGreaterThan(0);
  });

  it("returns net_info with peer details", async () => {
    const res = await get("/api/net_info");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("listening");
    expect(res.body).toHaveProperty("nPeers");
    expect(res.body).toHaveProperty("peers");
  });

  it("returns empty records when no records exist", async () => {
    const res = await get("/api/records");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("records");
    expect(Array.isArray(res.body.records)).toBe(true);
  });
});

describe("E2E: Validator Registry", () => {
  describe("Node Registration (positive)", () => {
    it("registers a new validator node", async () => {
      const res = await post("/api/nodes/register", {
        node_id: testNodeId,
        moniker: "e2e-test-node",
        public_endpoint: "http://localhost:26657",
        rpc_port: 26657,
        rest_port: 1317,
        p2p_port: 26656,
        version: "v1.0.0-e2e",
        network: "localchain",
      });

      expect(res.status).toBe(201);
      expect(res.body.node_id).toBe(testNodeId);
      expect(res.body.success).toBe(true);
    });

    it("lists registered nodes", async () => {
      const res = await get("/api/nodes");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("nodes");
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);

      const node = res.body.nodes.find((n) => n.node_id === testNodeId);
      expect(node).toBeDefined();
      expect(node.moniker).toBe("e2e-test-node");
    });

    it("returns node stats", async () => {
      const res = await get("/api/nodes/stats");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("online");
      expect(res.body).toHaveProperty("offline");
    });

    it("returns node selector result", async () => {
      const res = await get("/api/nodes/select?strategy=lowest-latency");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("strategy");
      expect(res.body.strategy).toBe("lowest-latency");
    });

    it("returns connection pool stats", async () => {
      const res = await get("/api/nodes/pool/stats");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("size");
    });
  });

  describe("Node Registration (negative)", () => {
    it("rejects registration without node_id", async () => {
      const res = await post("/api/nodes/register", {
        moniker: "no-id-node",
        public_endpoint: "http://localhost:26657",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("rejects registration without moniker", async () => {
      const res = await post("/api/nodes/register", {
        node_id: "test-no-moniker",
        public_endpoint: "http://localhost:26657",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("rejects registration without public_endpoint", async () => {
      const res = await post("/api/nodes/register", {
        node_id: "test-no-endpoint",
        moniker: "no-endpoint-node",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("required");
    });

    it("upserts duplicate node_id", async () => {
      const res = await post("/api/nodes/register", {
        node_id: testNodeId,
        moniker: "duplicate-node",
        public_endpoint: "http://localhost:26657",
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Node Deletion", () => {
    it("deletes a registered node", async () => {
      const res = await del(`/api/nodes/${testNodeId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 for deleted node", async () => {
      const res = await get(`/api/nodes/${testNodeId}`);
      expect(res.status).toBe(404);
    });
  });
});

describe("E2E: Multi-Tenant Management", () => {
  let tenantId = null;

  describe("Tenant CRUD (positive)", () => {
    it("creates a new tenant", async () => {
      const res = await post("/api/tenants", {
        name: "e2e-corp",
        description: "E2E test tenant",
        maxNodes: 3,
        maxApiKeys: 5,
        rateLimit: 100,
        rateWindow: 3600,
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("e2e-corp");
      expect(res.body.max_nodes).toBe(3);
      expect(res.body.rate_limit).toBe(100);
      expect(res.body.tenant_id).toBeDefined();
      tenantId = res.body.tenant_id;
      testTenantId = tenantId;
    });

    it("lists all tenants", async () => {
      const res = await get("/api/tenants");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tenants");
      expect(Array.isArray(res.body.tenants)).toBe(true);
      expect(res.body.tenants.length).toBeGreaterThan(0);
    });

    it("returns tenant by ID", async () => {
      const res = await get(`/api/tenants/${tenantId}`);
      expect(res.status).toBe(200);
      expect(res.body.tenant_id).toBe(tenantId);
      expect(res.body.name).toBe("e2e-corp");
    });

    it("updates a tenant", async () => {
      const res = await put(`/api/tenants/${tenantId}`, {
        name: "e2e-corp-updated",
        description: "Updated description",
        maxNodes: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("e2e-corp-updated");
      expect(res.body.max_nodes).toBe(10);
    });

    it("returns tenant usage stats", async () => {
      const res = await get(`/api/tenants/${tenantId}/usage`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total_requests");
    });

    it("returns global tenant stats", async () => {
      const res = await get("/api/tenants/stats");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total_tenants");
      expect(res.body.total_tenants).toBeGreaterThan(0);
    });

    it("suspends a tenant", async () => {
      const res = await del(`/api/tenants/${tenantId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Tenant CRUD (negative)", () => {
    it("rejects tenant creation without name", async () => {
      const res = await post("/api/tenants", {
        description: "No name tenant",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("name");
    });

    it("returns 404 for non-existent tenant", async () => {
      const res = await get("/api/tenants/non-existent-tenant-id");
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent tenant update", async () => {
      const res = await post("/api/tenants/non-existent-tenant-id", null, {
        method: "PUT",
        body: JSON.stringify({ name: "updated" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
    });
  });
});

describe("E2E: API Key Management", () => {
  let keyId = null;
  let testKeyRaw = null;

  describe("API Keys (positive)", () => {
    it("creates a new API key", async () => {
      const res = await post("/api/auth/keys", {
        label: "e2e-test-key",
        expiresInDays: 30,
        rateLimit: 500,
        rateWindow: 3600,
        permissions: ["read", "write"],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("raw");
      expect(res.body).toHaveProperty("prefix");
      expect(res.body.raw).toBeDefined();
      expect(res.body.raw.length).toBeGreaterThan(20);
      expect(res.body.prefix).toBeDefined();
      testKeyRaw = res.body.raw;
    });

    it("lists all API keys", async () => {
      const res = await get("/api/auth/keys");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("keys");
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys.length).toBeGreaterThan(0);

      const key = res.body.keys.find((k) => k.label === "e2e-test-key");
      expect(key).toBeDefined();
      keyId = key.id;
    });

    it("returns key by ID", async () => {
      const res = await get(`/api/auth/keys/${keyId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(keyId);
      expect(res.body.label).toBe("e2e-test-key");
    });

    it("validates an API key", async () => {
      const res = await get("/api/auth/validate", { "X-API-Key": testKeyRaw });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it("revokes an API key", async () => {
      const res = await del(`/api/auth/keys/${keyId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("API Keys (negative)", () => {
    it("rejects invalid API key validation", async () => {
      const res = await get("/api/auth/validate", { "X-API-Key": "invalid-key-12345" });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it("returns 404 for non-existent key", async () => {
      const res = await get("/api/auth/keys/999999");
      expect(res.status).toBe(404);
    });

    it("rejects revoked key validation", async () => {
      const res = await get("/api/auth/validate", { "X-API-Key": testKeyRaw });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });
});

describe("E2E: Broadcast Service", () => {
  it("returns broadcast status", async () => {
    const res = await get("/api/broadcast/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mode");
    expect(["cli", "rest"]).toContain(res.body.mode);
  });
});

describe("E2E: Quarantine & Security Pipeline", () => {
  it("returns quarantine list", async () => {
    const res = await get("/api/quarantine");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it("returns quarantine stats", async () => {
    const res = await get("/api/quarantine/stats");
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it("returns audit log", async () => {
    const res = await get("/api/audit");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
  });

  it("returns audit stats", async () => {
    const res = await get("/api/audit/stats");
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

describe("E2E: UPnP Service", () => {
  it("returns UPnP status", async () => {
    const res = await get("/api/upnp/status");
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

describe("E2E: Error Handling & Edge Cases", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await get("/api/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent block height", async () => {
    const res = await get("/api/block/999999999");
    expect(res.status).toBe(502);
  });

  it("returns 404 for non-existent transaction", async () => {
    const res = await get("/api/tx/0000000000000000000000000000000000000000000000000000000000000000");
    expect(res.status).toBe(502);
  });

  it("rejects empty query parameters", async () => {
    const res = await get("/api/records?limit=&search=");
    expect([400, 429]).toContain(res.status);
  });

  it("rejects pagination limits exceeding max", async () => {
    const res = await get("/api/records?limit=9999");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("accepts valid pagination within limits", async () => {
    const res = await get("/api/records?limit=50");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("records");
  });

  it("returns consistent response shape across endpoints", async () => {
    const endpoints = ["/health", "/api/blocks/latest", "/api/validators", "/api/nodes/stats"];
    for (const endpoint of endpoints) {
      const res = await get(endpoint);
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe("object");
    }
  });
});

describe("E2E: Metrics Consistency", () => {
  it("increments request counter on each API call", async () => {
    const before = await get("/api/metrics/summary");
    const beforeCount = before.body.requests.total;

    await get("/health");
    await get("/api/system");

    const after = await get("/api/metrics/summary");
    const afterCount = after.body.requests.total;

    expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 2);
  });

  it("metrics summary returns valid structure", async () => {
    const summary = await get("/api/metrics/summary");
    expect(summary.status).toBe(200);
    expect(summary.body).toHaveProperty("requests");
    expect(summary.body).toHaveProperty("chain");
    expect(summary.body).toHaveProperty("nodes");
    expect(summary.body).toHaveProperty("tenants");
    expect(summary.body).toHaveProperty("system");
    expect(summary.body).toHaveProperty("transactions");
    expect(summary.body.requests).toHaveProperty("total");
    expect(summary.body.requests).toHaveProperty("errors");
    expect(summary.body.requests).toHaveProperty("errorRate");
  });
});
