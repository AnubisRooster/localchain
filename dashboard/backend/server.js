// ─────────────────────────────────────────────────────────────
// LocalChain – Dashboard Backend API
// Express server that proxies Cosmos REST + Tendermint RPC
// and adds tag/label query support.
// ─────────────────────────────────────────────────────────────
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const axios = require("axios");
const os = require("os");
const { execFile } = require("child_process");
const config = require("../shared/config");

const { validateRecord, validateRecordsQuery, validateTxQuery } = require("./middleware/validation");
const { sanitizeRecord, sanitizeQuery } = require("./middleware/sanitization");
const { scanRecord } = require("./middleware/injection-scanner");
const { auditMiddleware, queryAuditLog, getAuditStats } = require("./middleware/audit-logger");
const { recordSubmissionLimiter, apiRequestLimiter, txQueryLimiter, createAddressBasedLimiter } = require("./middleware/rate-limiter");
const { reputationMiddleware, updateReputation, getReputation } = require("./services/reputation");
const { contentAnalysisMiddleware } = require("./services/content-analyzer");
const { quarantineMiddleware, queryQuarantine, getQuarantineCount, reviewEntry, deleteEntry, getQuarantineStats } = require("./services/quarantine");
const { registerNode, getAllNodes, getNodeById, deleteNodeById, getStats: getRegistryStats, pollAllNodes } = require("./services/registry");
const { selectNode, getNodeById: getNodeFromPool, getTendermintClient, getRestClient, routeRequest, clearPool, getPoolStats } = require("./services/node-selector");
const { broadcastRecord: broadcastRecordRest, resetClient: resetBroadcastClient, getSignerAddress } = require("./services/broadcast");
const { createKey, validateKey, revokeKey, listKeys, getKey, getTlsConfig, requireAuth, validateSharedSecret } = require("./services/auth");
const { initGateway, mapAllPorts, unmapAllPorts, startDiscoveryLoop, stopDiscoveryLoop, getStatus: getUpnpStatus, runDiscovery } = require("./services/upnp");
const { createTenant, getTenant, listTenants, updateTenant, suspendTenant, getTenantUsage, getGlobalStats, tenantMiddleware } = require("./services/tenant");
const { detectAddresses, buildEndpoints, buildApiUrls, getLocalIp } = require("./services/network");
const metrics = require("./services/metrics");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(apiRequestLimiter);
app.use(requireAuth);
app.use(tenantMiddleware);
app.use(metrics.httpMiddleware);

const cosmos = axios.create({ baseURL: config.cosmosRest, timeout: 8000 });
const tendermint = axios.create({ baseURL: config.tendermintRpc, timeout: 8000 });

function getClientForRequest(req, type = "tendermint") {
  const nodeId = req.query.node;
  if (!nodeId) return type === "tendermint" ? tendermint : cosmos;

  const node = getNodeFromPool(nodeId);
  if (!node) return null;

  return type === "tendermint" ? getTendermintClient(node) : getRestClient(node);
}

// ══════════════════════════════════════════════════════════
// Health
// ══════════════════════════════════════════════════════════
app.get("/health", async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ status: "error", message: `Node '${req.query.node}' not found` });
    }

    const start = Date.now();
    const status = await client.get("/status");
    const latency = Date.now() - start;
    const info = status.data.result;

    metrics.updateChainMetrics({
      blockHeight: parseInt(info.sync_info.latest_block_height, 10),
      peers: parseInt(info.node_info.id ? 1 : 0, 10),
      catchingUp: info.sync_info.catching_up,
    });

    metrics.nodeLatency.observe(latency / 1000);

    res.json({
      status: "ok",
      chainId: info.node_info.network,
      blockHeight: parseInt(info.sync_info.latest_block_height, 10),
      peers: parseInt(info.node_info.id ? 1 : 0, 10),
      latency,
      catching_up: info.sync_info.catching_up,
      node: req.query.node || "localhost",
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Audit log query endpoint
// ══════════════════════════════════════════════════════════
app.get("/api/audit", async (req, res) => {
  try {
    const filters = {};
    if (req.query.action) filters.action = req.query.action;
    if (req.query.signerAddress) filters.signerAddress = req.query.signerAddress;
    if (req.query.threatLevel) filters.threatLevel = req.query.threatLevel;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.txHash) filters.txHash = req.query.txHash;
    if (req.query.minRiskScore) filters.minRiskScore = parseInt(req.query.minRiskScore, 10);
    if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);

    const entries = queryAuditLog(filters);
    res.json({ entries, total: entries.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to query audit log", details: err.message });
  }
});

app.get("/api/audit/stats", async (_req, res) => {
  try {
    const stats = getAuditStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to get audit stats", details: err.message });
  }
});

app.get("/api/reputation/:address", async (req, res) => {
  try {
    const rep = getReputation(req.params.address);
    res.json(rep);
  } catch (err) {
    res.status(500).json({ error: "Failed to get reputation", details: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Quarantine – blocked/threatened items review
// ══════════════════════════════════════════════════════════
app.get("/api/quarantine", async (req, res) => {
  try {
    const filters = {};
    if (req.query.threatLevel) filters.threatLevel = req.query.threatLevel;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.sourceIp) filters.sourceIp = req.query.sourceIp;
    if (req.query.minRiskScore) filters.minRiskScore = parseInt(req.query.minRiskScore, 10);
    if (req.query.pattern) filters.pattern = req.query.pattern;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);
    if (req.query.offset) filters.offset = parseInt(req.query.offset, 10);

    const entries = queryQuarantine(filters);
    const total = getQuarantineCount(filters);
    res.json({ entries, total });
  } catch (err) {
    res.status(500).json({ error: "Failed to query quarantine", details: err.message });
  }
});

app.get("/api/quarantine/stats", async (_req, res) => {
  try {
    const stats = getQuarantineStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to get quarantine stats", details: err.message });
  }
});

app.post("/api/quarantine/:id/review", async (req, res) => {
  try {
    const { status, reviewedBy, notes } = req.body;
    if (!["reviewed", "dismissed", "false_positive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be: reviewed, dismissed, or false_positive" });
    }
    if (!reviewedBy) {
      return res.status(400).json({ error: "reviewedBy is required" });
    }
    const success = reviewEntry(req.params.id, status, reviewedBy, notes || "");
    if (!success) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to review entry", details: err.message });
  }
});

app.delete("/api/quarantine/:id", async (req, res) => {
  try {
    const success = deleteEntry(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete entry", details: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Records – query create-record transactions via Cosmos REST
// ══════════════════════════════════════════════════════════

function parseRecordData(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { summary: "", content: raw || "", contentType: "text" };
  }
}

app.get("/api/records", sanitizeQuery, validateRecordsQuery, async (req, res) => {
  try {
    const client = getClientForRequest(req, "rest");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found`, records: [], total: 0 });
    }

    const query = req.validatedQuery || req.query;
    const response = await client.get("/cosmos/tx/v1beta1/txs", {
      params: {
        query: "message.action='/localchain.records.v1.MsgCreateRecord'",
        order_by: "ORDER_BY_DESC",
        "pagination.limit": String(query.limit || 50),
      },
    });

    const txResponses = response.data.tx_responses || [];
    const txs = response.data.txs || [];

    let records = txResponses.map((txResp, i) => {
      const tx = txs[i];
      const msg = tx?.body?.messages?.[0] || {};
      const data = parseRecordData(msg.data);

      return {
        txHash: txResp.txhash,
        height: txResp.height,
        time: txResp.timestamp,
        creator: msg.creator,
        summary: data.summary || "",
        content: data.content || "",
        contentType: data.contentType || "text",
        fileName: data.fileName || null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        labels: data.labels && typeof data.labels === "object" ? data.labels : {},
        code: txResp.code,
      };
    });

    if (query.search) {
      const s = query.search.toLowerCase();
      records = records.filter(
        (r) =>
          r.summary.toLowerCase().includes(s) ||
          r.txHash.toLowerCase().includes(s) ||
          (r.content || "").toLowerCase().includes(s) ||
          r.tags.some((t) => t.toLowerCase().includes(s))
      );
    }

    if (query.tag) {
      const t = query.tag.toLowerCase();
      records = records.filter((r) =>
        r.tags.some((tag) => tag.toLowerCase() === t)
      );
    }

    const labelKeys = Object.keys(req.query).filter((k) => k.startsWith("label."));
    for (const key of labelKeys) {
      const labelName = key.replace("label.", "");
      const labelValue = req.query[key];
      records = records.filter(
        (r) => r.labels && r.labels[labelName] === labelValue
      );
    }

    res.json({ records, total: records.length });
  } catch (err) {
    res.json({ records: [], total: 0, note: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Records – submit a new record transaction
// ══════════════════════════════════════════════════════════

function broadcastRecordCli(jsonData) {
  return new Promise((resolve, reject) => {
    const args = [
      "tx", "records", "create-record", jsonData,
      "--from", config.signerKey,
      "--keyring-backend", config.keyringBackend,
      "--chain-id", config.chainId,
      "--home", config.chainHome,
      "--yes",
      "--output", "json",
      "--gas", "auto",
      "--gas-adjustment", "1.5",
    ];

    execFile(config.chainBinary, args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ raw: stdout });
      }
    });
  });
}

async function broadcastRecord(jsonData, nodeId) {
  if (process.env.USE_CLI_BROADCAST === "1") {
    return broadcastRecordCli(jsonData);
  }
  return broadcastRecordRest(jsonData, nodeId);
}

const addressLimiter = createAddressBasedLimiter({ windowMs: 60000, max: 10 });

app.post(
  "/api/records",
  recordSubmissionLimiter,
  addressLimiter,
  validateRecord,
  sanitizeRecord,
  reputationMiddleware,
  contentAnalysisMiddleware,
  quarantineMiddleware,
  scanRecord,
  auditMiddleware,
  async (req, res) => {
    try {
      const body = req.sanitizedBody || req.validatedBody || req.body;
      const { summary, content, contentType, fileName, tags, labels } = body;

      if (!summary || !content) {
        return res.status(400).json({ error: "Summary and content are required." });
      }

      const payload = JSON.stringify({
        summary,
        content,
        contentType: contentType || "text",
        fileName: fileName || null,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        labels: labels && typeof labels === "object" ? labels : {},
        timestamp: Date.now(),
      });

      const result = await broadcastRecord(payload, req.query.node);
      metrics.txBroadcastTotal.inc({ status: "total" });

      if (result.code && result.code !== 0) {
        metrics.txBroadcastTotal.inc({ status: "failed" });
        const address = req.body?.creator || req.ip;
        if (address) {
          updateReputation(address, "failedTx", "Transaction rejected by chain");
        }
        return res.status(422).json({
          error: "Transaction rejected by chain",
          code: result.code,
          rawLog: result.raw_log,
        });
      }

      metrics.txBroadcastTotal.inc({ status: "success" });

      const address = req.body?.creator || req.ip;
      if (address) {
        updateReputation(address, "successfulTx", "Transaction accepted by chain");
      }

      res.json({
        success: true,
        txHash: result.txhash,
        height: result.height,
        code: result.code,
        riskScore: req.scanResults?.riskScore || 0,
        contentAnalysis: req.contentAnalysis || null,
      });
    } catch (err) {
      res.status(500).json({ error: "Transaction broadcast failed", details: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════
// Blocks
// ══════════════════════════════════════════════════════════
app.get("/api/blocks/latest", async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found` });
    }

    const [latest, blockchain] = await Promise.all([
      client.get("/block"),
      client.get("/blockchain?minHeight=1&maxHeight=20"),
    ]);

    const latestBlock = latest.data.result.block;
    const blockMetas = blockchain.data.result.block_metas || [];

    res.json({
      latest: {
        height: latestBlock.header.height,
        time: latestBlock.header.time,
        txCount: latestBlock.data.txs ? latestBlock.data.txs.length : 0,
        proposer: latestBlock.header.proposer_address,
      },
      recent: blockMetas.map((bm) => ({
        height: bm.header.height,
        time: bm.header.time,
        txCount: bm.num_txs,
        hash: bm.block_id.hash,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/block/:height", async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found` });
    }

    const { height } = req.params;
    const response = await client.get(`/block?height=${height}`);
    const block = response.data.result.block;

    res.json({
      height: block.header.height,
      chainId: block.header.chain_id,
      time: block.header.time,
      proposer: block.header.proposer_address,
      txCount: block.data.txs ? block.data.txs.length : 0,
      txs: block.data.txs || [],
      lastBlockHash: block.header.last_block_id.hash,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Transactions
// ══════════════════════════════════════════════════════════
app.get("/api/tx/:hash", txQueryLimiter, async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found` });
    }

    const { hash } = req.params;
    const response = await client.get(`/tx?hash=0x${hash}`);
    res.json(response.data.result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/txs", txQueryLimiter, validateTxQuery, async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found`, txs: [], total: 0 });
    }

    const q = req.validatedTxQuery || req.query;
    const page = q.page || 1;
    const perPage = q.per_page || 30;
    const query = q.query || "tx.height>0";

    const response = await client.get("/tx_search", {
      params: { query: `"${query}"`, page, per_page: perPage, order_by: '"desc"' },
    });

    const result = response.data.result;
    res.json({
      txs: result.txs || [],
      total: result.total_count,
    });
  } catch (err) {
    res.json({ txs: [], total: 0, note: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Validators
// ══════════════════════════════════════════════════════════
app.get("/api/validators", async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found` });
    }

    const response = await client.get("/validators");
    const result = response.data.result;

    res.json({
      blockHeight: result.block_height,
      validators: result.validators.map((v) => ({
        address: v.address,
        pubKey: v.pub_key,
        votingPower: v.voting_power,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Auth – API key management
// ══════════════════════════════════════════════════════════
app.post("/api/auth/keys", (req, res) => {
  const { label, expiresInDays, rateLimit, rateWindow, permissions } = req.body;

  try {
    const result = createKey({
      label: label || "api-key",
      expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : null,
      rateLimit: rateLimit ? parseInt(rateLimit, 10) : 1000,
      rateWindow: rateWindow ? parseInt(rateWindow, 10) : 3600,
      permissions,
      createdBy: req.ip,
    });
    metrics.apiKeysCreatedTotal.inc();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/keys", (_req, res) => {
  res.json({ keys: listKeys() });
});

app.get("/api/auth/keys/:id", (req, res) => {
  const key = getKey(parseInt(req.params.id, 10));
  if (!key) {
    return res.status(404).json({ error: "Key not found" });
  }
  res.json(key);
});

app.delete("/api/auth/keys/:id", (req, res) => {
  const result = revokeKey(parseInt(req.params.id, 10));
  if (!result.success) {
    return res.status(404).json({ error: "Key not found" });
  }
  metrics.apiKeysRevokedTotal.inc();
  res.json(result);
});

app.get("/api/auth/validate", (req, res) => {
  const key = req.headers["x-api-key"];
  if (!key) {
    return res.status(400).json({ error: "X-API-Key header required" });
  }
  const result = validateKey(key);
  res.json(result);
});

// ══════════════════════════════════════════════════════════
// UPnP – auto-discovery and port mapping
// ══════════════════════════════════════════════════════════
app.get("/api/upnp/status", async (_req, res) => {
  res.json(await getUpnpStatus());
});

app.post("/api/upnp/discover", async (_req, res) => {
  try {
    const result = await runDiscovery();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/upnp/map", async (_req, res) => {
  try {
    const result = await mapAllPorts();
    res.json({ success: true, mappings: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/upnp/unmap", async (_req, res) => {
  try {
    await unmapAllPorts();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Bootstrap – zero-touch node joining
// ══════════════════════════════════════════════════════════

// GET /api/genesis — serves the chain's genesis file (public)
app.get("/api/genesis", (_req, res) => {
  const fs = require("fs");
  const path = require("path");
  const genesisPath = path.join(config.chainHome, "config", "genesis.json");

  try {
    if (!fs.existsSync(genesisPath)) {
      return res.status(500).json({ error: "Genesis not found. Is the chain initialized?" });
    }
    const genesis = JSON.parse(fs.readFileSync(genesisPath, "utf-8"));
    res.json(genesis);
  } catch (err) {
    res.status(500).json({ error: "Failed to read genesis file", details: err.message });
  }
});

// GET /api/bootstrap — returns everything a new node needs to join (shared secret auth)
app.get("/api/bootstrap", validateSharedSecret, async (_req, res) => {
  const fs = require("fs");
  const path = require("path");

  try {
    // Read genesis
    const genesisPath = path.join(config.chainHome, "config", "genesis.json");
    let genesis = null;
    if (fs.existsSync(genesisPath)) {
      genesis = JSON.parse(fs.readFileSync(genesisPath, "utf-8"));
    }

    // Get chain ID from genesis or config
    const chainId = genesis?.chain_id || config.chainId || "localchain";

    // Query local node status
    let nodeStatus = null;
    try {
      const status = await axios.get(`http://localhost:${config.tendermintRpc.split(":").pop()}/status`, { timeout: 5000 });
      nodeStatus = status.data.result;
    } catch {}

    // Query net_info for peers
    let netInfo = null;
    try {
      const net = await axios.get(`http://localhost:${config.tendermintRpc.split(":").pop()}/net_info`, { timeout: 5000 });
      netInfo = net.data.result;
    } catch {}

    // Detect addresses
    const upnpStatus = await getUpnpStatus();
    const externalIp = upnpStatus.externalIp || null;
    const addresses = await detectAddresses(externalIp);

    // Build seed peers from registered nodes + local node
    const seedPeers = [];

    // Add local node as a seed peer
    if (nodeStatus) {
      const localNodeId = nodeStatus.node_info?.id || "";
      if (localNodeId) {
        seedPeers.push({
          node_id: localNodeId,
          addresses: buildEndpoints(addresses, 26656),
        });
      }
    }

    // Add registered nodes
    const registeredNodes = getAllNodes();
    for (const node of registeredNodes) {
      if (node.status === "online") {
        seedPeers.push({
          node_id: node.node_id,
          addresses: [{ type: "public", address: `${node.public_endpoint}:${node.p2p_port || 26656}` }],
        });
      }
    }

    // Build API endpoints
    const apiEndpoints = buildApiUrls(addresses, config.apiPort);

    res.json({
      chain_id: chainId,
      genesis,
      seed_peers: seedPeers,
      api_endpoints: apiEndpoints,
      network_info: {
        block_height: nodeStatus ? parseInt(nodeStatus.sync_info?.latest_block_height || "0", 10) : 0,
        peers: netInfo ? parseInt(netInfo.n_peers || "0", 10) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to build bootstrap bundle", details: err.message });
  }
});

// POST /api/join-token — generates a join token for new nodes
// NOTE: The token contains the shared secret in base64 (not encrypted).
// This is intentional — the token is meant to be shared deliberately with
// trusted devices, similar to Tailscale pre-auth keys.
app.post("/api/join-token", requireAuth, async (_req, res) => {
  try {
    const sharedSecret = process.env.VALIDATOR_SHARED_SECRET || "";
    const chainId = config.chainId || "localchain";

    // Detect addresses
    const upnpStatus = await getUpnpStatus();
    const externalIp = upnpStatus.externalIp || null;
    const addresses = await detectAddresses(externalIp);
    const apiUrls = buildApiUrls(addresses, config.apiPort);

    // Build token payload
    const payload = {
      v: 1,
      api: apiUrls.map((a) => a.url),
      secret: sharedSecret,
      chain_id: chainId,
      created_at: new Date().toISOString(),
    };

    // Base64url encode
    const token = Buffer.from(JSON.stringify(payload)).toString("base64url");

    res.json({
      token,
      expires_at: null,
      api_urls: apiUrls.map((a) => a.url),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate join token", details: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Tenants – multi-tenant management
// ══════════════════════════════════════════════════════════
app.post("/api/tenants", (req, res) => {
  const { name, description, maxNodes, maxApiKeys, rateLimit, rateWindow, metadata } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const tenant = createTenant({
      name,
      description,
      maxNodes: maxNodes ? parseInt(maxNodes, 10) : undefined,
      maxApiKeys: maxApiKeys ? parseInt(maxApiKeys, 10) : undefined,
      rateLimit: rateLimit ? parseInt(rateLimit, 10) : undefined,
      rateWindow: rateWindow ? parseInt(rateWindow, 10) : undefined,
      metadata,
    });
    metrics.tenantsCreatedTotal.inc();
    res.status(201).json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tenants", (_req, res) => {
  res.json({ tenants: listTenants() });
});

app.get("/api/tenants/stats", (_req, res) => {
  res.json(getGlobalStats());
});

app.get("/api/tenants/:tenantId", (req, res) => {
  const tenant = getTenant(req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  res.json(tenant);
});

app.put("/api/tenants/:tenantId", (req, res) => {
  const tenant = updateTenant(req.params.tenantId, req.body);
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  res.json(tenant);
});

app.delete("/api/tenants/:tenantId", (req, res) => {
  const result = suspendTenant(req.params.tenantId);
  if (!result.success) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  res.json(result);
});

app.get("/api/tenants/:tenantId/usage", (req, res) => {
  const tenant = getTenant(req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  const hours = req.query.hours ? parseInt(req.query.hours, 10) : 24;
  res.json(getTenantUsage(req.params.tenantId, hours));
});

// ══════════════════════════════════════════════════════════
// Validator Registry – self-service node registration
// ══════════════════════════════════════════════════════════
app.post("/api/nodes/register", validateSharedSecret, (req, res) => {
  const { node_id, moniker, public_endpoint, rpc_port, rest_port, p2p_port, version, network } = req.body;

  if (!node_id || !moniker || !public_endpoint) {
    return res.status(400).json({ error: "node_id, moniker, and public_endpoint are required" });
  }

  try {
    const result = registerNode({
      node_id,
      moniker,
      public_endpoint,
      rpc_port: parseInt(rpc_port, 10) || 26657,
      rest_port: parseInt(rest_port, 10) || 1317,
      p2p_port: parseInt(p2p_port, 10) || 26656,
      version,
      network,
    });
    metrics.nodeRegistrationsTotal.inc();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/nodes", async (_req, res) => {
  const registryNodes = getAllNodes();

  const results = registryNodes.map((node) => ({
    id: node.id,
    node_id: node.node_id,
    moniker: node.moniker,
    public_endpoint: node.public_endpoint,
    rpc_port: node.rpc_port,
    rest_port: node.rest_port,
    p2p_port: node.p2p_port,
    status: node.status,
    block_height: node.block_height,
    catching_up: !!node.catching_up,
    latency_ms: node.latency_ms,
    version: node.version,
    network: node.network,
    registered_at: node.registered_at,
    last_seen: node.last_seen,
  }));

  res.json({ nodes: results, total: results.length });
});

app.get("/api/nodes/stats", (_req, res) => {
  res.json(getRegistryStats());
});

app.get("/api/nodes/select", (req, res) => {
  const strategy = req.query.strategy || "lowest-latency";
  const node = selectNode(strategy);
  if (!node) {
    return res.json({ node: null, message: "No online nodes available" });
  }
  res.json({ node, strategy });
});

app.get("/api/nodes/pool/stats", (_req, res) => {
  res.json(getPoolStats());
});

app.get("/api/nodes/:nodeId", (req, res) => {
  const node = getNodeById(req.params.nodeId);
  if (!node) {
    return res.status(404).json({ error: "Node not found" });
  }
  res.json(node);
});

app.delete("/api/nodes/:nodeId", (req, res) => {
  const result = deleteNodeById(req.params.nodeId);
  if (!result.success) {
    return res.status(404).json({ error: "Node not found" });
  }
  metrics.nodeDeregistrationsTotal.inc();
  clearPool();
  resetBroadcastClient();
  res.json(result);
});

app.get("/api/broadcast/status", (req, res) => {
  res.json({
    mode: process.env.USE_CLI_BROADCAST === "1" ? "cli" : "rest",
    signerAddress: getSignerAddress() || null,
    node: req.query.node || "auto",
  });
});

// ══════════════════════════════════════════════════════════
// Nodes – legacy aggregate health from known Tailscale peers
// ══════════════════════════════════════════════════════════
app.get("/api/nodes/legacy", async (_req, res) => {
  const nodes = config.knownNodes.length
    ? config.knownNodes
    : ["localhost"];

  const results = await Promise.allSettled(
    nodes.map(async (host) => {
      const start = Date.now();
      try {
        const status = await axios.get(
          `http://${host}:${config.tendermintRpc.split(":").pop()}/status`,
          { timeout: 5000 }
        );
        const info = status.data.result;
        return {
          host,
          status: "online",
          nodeId: info.node_info.id,
          moniker: info.node_info.moniker,
          blockHeight: info.sync_info.latest_block_height,
          catching_up: info.sync_info.catching_up,
          latency: Date.now() - start,
        };
      } catch {
        return { host, status: "offline", latency: Date.now() - start };
      }
    })
  );

  res.json({
    nodes: results.map((r) => (r.status === "fulfilled" ? r.value : r.reason)),
  });
});

// ══════════════════════════════════════════════════════════
// Net Info (peer details)
// ══════════════════════════════════════════════════════════
app.get("/api/net_info", async (req, res) => {
  try {
    const client = getClientForRequest(req, "tendermint");
    if (!client) {
      return res.status(404).json({ error: `Node '${req.query.node}' not found` });
    }

    const response = await client.get("/net_info");
    const result = response.data.result;

    res.json({
      listening: result.listening,
      nPeers: result.n_peers,
      peers: (result.peers || []).map((p) => ({
        nodeId: p.node_info.id,
        moniker: p.node_info.moniker,
        remoteIp: p.remote_ip,
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// System metrics (for the dashboard + Prometheus)
// ══════════════════════════════════════════════════════════
app.get("/api/system", (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    cpuCount: cpus.length,
    memTotal: totalMem,
    memFree: freeMem,
    memUsedPercent: ((1 - freeMem / totalMem) * 100).toFixed(1),
  });
});

// Prometheus-compatible text metrics
app.get("/api/metrics", async (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4");
  res.send(await metrics.generatePrometheusText());
});

// JSON metrics summary for dashboard
app.get("/api/metrics/summary", (_req, res) => {
  res.json(metrics.getJsonSummary());
});

// ══════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════
if (require.main === module) {
  // ── Security warnings on startup ──────────────────────────
  const warnings = [];

  if (config.keyringBackend === "test") {
    warnings.push("⚠ KEYRING_BACKEND=test: Keys stored unencrypted on disk. Use 'file' or 'os' for production.");
  }

  if (!process.env.VALIDATOR_SHARED_SECRET || process.env.VALIDATOR_SHARED_SECRET === "change-this-to-a-secure-secret") {
    warnings.push("⚠ VALIDATOR_SHARED_SECRET: Using default value. Node registration is unprotected.");
  }

  if (!process.env.TLS_ENABLED || process.env.TLS_ENABLED !== "1") {
    warnings.push("⚠ TLS not enabled: API traffic is unencrypted. Set TLS_ENABLED=1 for production.");
  }

  if (!process.env.AUTH_DB_PATH) {
    warnings.push("⚠ AUTH_DB_PATH not set: Using default path. Configure for production deployments.");
  }

  if (warnings.length > 0) {
    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    console.log("  SECURITY WARNINGS");
    console.log("═══════════════════════════════════════════════════════");
    warnings.forEach((w) => console.log(`  ${w}`));
    console.log("═══════════════════════════════════════════════════════");
    console.log("");
  }

  const tlsConfig = getTlsConfig();

  if (tlsConfig) {
    const https = require("https");
    https.createServer(tlsConfig, app).listen(config.apiPort, config.apiHost, () => {
      console.log(`✔ LocalChain API (HTTPS) listening on https://${config.apiHost}:${config.apiPort}`);
      console.log(`  → Cosmos REST : ${config.cosmosRest}`);
      console.log(`  → Tendermint  : ${config.tendermintRpc}`);
    });
  } else {
    app.listen(config.apiPort, config.apiHost, () => {
      console.log(`✔ LocalChain API listening on http://${config.apiHost}:${config.apiPort}`);
      console.log(`  → Cosmos REST : ${config.cosmosRest}`);
      console.log(`  → Tendermint  : ${config.tendermintRpc}`);
    });
  }

  // Background health poller – probe registered nodes every 30s
  const POLL_INTERVAL_MS = parseInt(process.env.NODE_POLL_INTERVAL_MS, 10) || 30_000;
  console.log(`  → Validator health poller: every ${POLL_INTERVAL_MS / 1000}s`);

  async function pollRegistry() {
    try {
      const results = await pollAllNodes();
      if (results.length > 0) {
        const online = results.filter((r) => r.status === "online").length;
        const offline = results.length - online;
        console.log(`[registry-poll] ${online}/${results.length} nodes online`);
        metrics.updateNodePoolMetrics({ total: results.length, online, offline });
      }
    } catch (err) {
      console.error(`[registry-poll] Error: ${err.message}`);
    }
  }

  // Initial poll after 5s, then recurring
  setTimeout(() => {
    pollRegistry();
    setInterval(pollRegistry, POLL_INTERVAL_MS);
  }, 5000);

  // Background metrics updater – refresh chain/tenant metrics every 15s
  async function refreshMetrics() {
    try {
      const status = await tendermint.get("/status");
      const info = status.data.result;
      metrics.updateChainMetrics({
        blockHeight: parseInt(info.sync_info.latest_block_height, 10),
        peers: parseInt(info.sync_info.latest_block_height, 10) > 0 ? 1 : 0,
        catchingUp: info.sync_info.catching_up,
      });
    } catch {}

    try {
      const tenantStats = getGlobalStats();
      metrics.updateTenantMetrics(tenantStats);
    } catch {}
  }

  setTimeout(() => {
    refreshMetrics();
    setInterval(refreshMetrics, 15_000);
  }, 8000);

  // UPnP auto-config
  if (config.upnpEnabled) {
    console.log("  → UPnP auto-discovery: enabled");

    (async () => {
      const gwResult = await initGateway();
      if (gwResult.success) {
        console.log(`  → UPnP gateway: ${gwResult.gatewayType} (${gwResult.externalIp})`);
        await mapAllPorts();
        startDiscoveryLoop();
      } else {
        console.log(`  → UPnP: ${gwResult.reason} (discovery-only mode)`);
        startDiscoveryLoop();
      }
    })();
  }
}

// Cleanup on exit
process.on("SIGTERM", () => {
  stopDiscoveryLoop();
  unmapAllPorts().catch(() => {});
  process.exit(0);
});

process.on("SIGINT", () => {
  stopDiscoveryLoop();
  unmapAllPorts().catch(() => {});
  process.exit(0);
});

module.exports = { app, metrics };
