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

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(apiRequestLimiter);

const cosmos = axios.create({ baseURL: config.cosmosRest, timeout: 8000 });
const tendermint = axios.create({ baseURL: config.tendermintRpc, timeout: 8000 });

// ── In-memory metrics for Prometheus scraping ───────────────
let metrics = { requestCount: 0, errorCount: 0, lastBlockHeight: 0 };

// ──────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  metrics.requestCount++;
  next();
});

// ══════════════════════════════════════════════════════════
// Health
// ══════════════════════════════════════════════════════════
app.get("/health", async (_req, res) => {
  try {
    const start = Date.now();
    const status = await tendermint.get("/status");
    const latency = Date.now() - start;
    const info = status.data.result;

    metrics.lastBlockHeight = parseInt(info.sync_info.latest_block_height, 10);

    res.json({
      status: "ok",
      chainId: info.node_info.network,
      blockHeight: metrics.lastBlockHeight,
      peers: parseInt(info.node_info.id ? 1 : 0, 10),
      latency,
      catching_up: info.sync_info.catching_up,
    });
  } catch (err) {
    metrics.errorCount++;
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
    const query = req.validatedQuery || req.query;
    const response = await cosmos.get("/cosmos/tx/v1beta1/txs", {
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
    metrics.errorCount++;
    res.json({ records: [], total: 0, note: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Records – submit a new record transaction
// ══════════════════════════════════════════════════════════

function broadcastRecord(jsonData) {
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

      const result = await broadcastRecord(payload);

      if (result.code && result.code !== 0) {
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
      metrics.errorCount++;
      res.status(500).json({ error: "Transaction broadcast failed", details: err.message });
    }
  }
);

// ══════════════════════════════════════════════════════════
// Blocks
// ══════════════════════════════════════════════════════════
app.get("/api/blocks/latest", async (_req, res) => {
  try {
    const [latest, blockchain] = await Promise.all([
      tendermint.get("/block"),
      tendermint.get("/blockchain?minHeight=1&maxHeight=20"),
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
    metrics.errorCount++;
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/block/:height", async (req, res) => {
  try {
    const { height } = req.params;
    const response = await tendermint.get(`/block?height=${height}`);
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
    metrics.errorCount++;
    res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Transactions
// ══════════════════════════════════════════════════════════
app.get("/api/tx/:hash", txQueryLimiter, async (req, res) => {
  try {
    const { hash } = req.params;
    const response = await tendermint.get(`/tx?hash=0x${hash}`);
    res.json(response.data.result);
  } catch (err) {
    metrics.errorCount++;
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/txs", txQueryLimiter, validateTxQuery, async (req, res) => {
  try {
    const q = req.validatedTxQuery || req.query;
    const page = q.page || 1;
    const perPage = q.per_page || 30;
    const query = q.query || "tx.height>0";

    const response = await tendermint.get("/tx_search", {
      params: { query: `"${query}"`, page, per_page: perPage, order_by: '"desc"' },
    });

    const result = response.data.result;
    res.json({
      txs: result.txs || [],
      total: result.total_count,
    });
  } catch (err) {
    metrics.errorCount++;
    res.json({ txs: [], total: 0, note: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Validators
// ══════════════════════════════════════════════════════════
app.get("/api/validators", async (_req, res) => {
  try {
    const response = await tendermint.get("/validators");
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
    metrics.errorCount++;
    res.status(502).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// Nodes – aggregate health from known Tailscale peers
// ══════════════════════════════════════════════════════════
app.get("/api/nodes", async (_req, res) => {
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
app.get("/api/net_info", async (_req, res) => {
  try {
    const response = await tendermint.get("/net_info");
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
    metrics.errorCount++;
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
app.get("/api/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(
    [
      `# HELP localchain_api_requests_total Total API requests`,
      `# TYPE localchain_api_requests_total counter`,
      `localchain_api_requests_total ${metrics.requestCount}`,
      `# HELP localchain_api_errors_total Total API errors`,
      `# TYPE localchain_api_errors_total counter`,
      `localchain_api_errors_total ${metrics.errorCount}`,
      `# HELP localchain_last_block_height Last known block height`,
      `# TYPE localchain_last_block_height gauge`,
      `localchain_last_block_height ${metrics.lastBlockHeight}`,
      `# HELP localchain_system_mem_used_percent System memory usage percent`,
      `# TYPE localchain_system_mem_used_percent gauge`,
      `localchain_system_mem_used_percent ${((1 - os.freemem() / os.totalmem()) * 100).toFixed(1)}`,
    ].join("\n") + "\n"
  );
});

// ══════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════
if (require.main === module) {
  app.listen(config.apiPort, config.apiHost, () => {
    console.log(`✔ LocalChain API listening on http://${config.apiHost}:${config.apiPort}`);
    console.log(`  → Cosmos REST : ${config.cosmosRest}`);
    console.log(`  → Tendermint  : ${config.tendermintRpc}`);
  });
}

module.exports = { app, metrics };
