// ─────────────────────────────────────────────────────────────
// LocalChain – Validator Registry Service
// Persistent SQLite-backed registry for remote validators.
// Replaces the static KNOWN_NODES env var with self-registration.
// ─────────────────────────────────────────────────────────────
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const REGISTRY_DB_PATH = process.env.REGISTRY_DB_PATH || path.join(__dirname, "../../data", "registry.db");

let db = null;
let insertNode, updateHealth, markOffline, stmtGetAll, stmtGetById, stmtDelete, stmtGetStats, stmtGetStale;

function initDb(dbPath) {
  if (db) return db;

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS validator_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE NOT NULL,
      moniker TEXT NOT NULL,
      public_endpoint TEXT NOT NULL,
      rpc_port INTEGER NOT NULL DEFAULT 26657,
      rest_port INTEGER NOT NULL DEFAULT 1317,
      p2p_port INTEGER NOT NULL DEFAULT 26656,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      block_height INTEGER DEFAULT 0,
      catching_up INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      version TEXT,
      network TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_node_id ON validator_nodes(node_id);
    CREATE INDEX IF NOT EXISTS idx_status ON validator_nodes(status);
    CREATE INDEX IF NOT EXISTS idx_last_seen ON validator_nodes(last_seen);
  `);

  insertNode = db.prepare(`
    INSERT INTO validator_nodes (node_id, moniker, public_endpoint, rpc_port, rest_port, p2p_port, version, network)
    VALUES (@node_id, @moniker, @public_endpoint, @rpc_port, @rest_port, @p2p_port, @version, @network)
    ON CONFLICT(node_id) DO UPDATE SET
      moniker = excluded.moniker,
      public_endpoint = excluded.public_endpoint,
      rpc_port = excluded.rpc_port,
      rest_port = excluded.rest_port,
      p2p_port = excluded.p2p_port,
      version = excluded.version,
      network = excluded.network,
      updated_at = datetime('now')
  `);

  updateHealth = db.prepare(`
    UPDATE validator_nodes SET
      last_seen = datetime('now'),
      status = @status,
      block_height = @block_height,
      catching_up = @catching_up,
      latency_ms = @latency_ms,
      updated_at = datetime('now')
    WHERE node_id = @node_id
  `);

  markOffline = db.prepare(`
    UPDATE validator_nodes SET
      status = 'offline',
      updated_at = datetime('now')
    WHERE node_id = @node_id
  `);

  stmtGetAll = db.prepare("SELECT * FROM validator_nodes ORDER BY registered_at ASC");
  stmtGetById = db.prepare("SELECT * FROM validator_nodes WHERE node_id = ?");
  stmtDelete = db.prepare("DELETE FROM validator_nodes WHERE node_id = ?");
  stmtGetStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
      SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown,
      MAX(block_height) as max_height,
      AVG(CASE WHEN status = 'online' THEN latency_ms ELSE NULL END) as avg_latency
    FROM validator_nodes
  `);
  stmtGetStale = db.prepare(`
    SELECT node_id FROM validator_nodes
    WHERE last_seen IS NULL OR last_seen < datetime('now', '-5 minutes')
  `);

  return db;
}

function getDb() {
  return initDb(REGISTRY_DB_PATH);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    insertNode = null;
    updateHealth = null;
    markOffline = null;
    stmtGetAll = null;
    stmtGetById = null;
    stmtDelete = null;
    stmtGetStats = null;
    stmtGetStale = null;
  }
}

function ensureDb() {
  if (!db) initDb(REGISTRY_DB_PATH);
}

// ── Public API ──────────────────────────────────────────────

function registerNode(data) {
  ensureDb();
  const result = insertNode.run({
    node_id: data.node_id,
    moniker: data.moniker,
    public_endpoint: data.public_endpoint,
    rpc_port: data.rpc_port || 26657,
    rest_port: data.rest_port || 1317,
    p2p_port: data.p2p_port || 26656,
    version: data.version || null,
    network: data.network || null,
  });
  return { success: true, node_id: data.node_id, changes: result.changes };
}

function updateNodeHealth(node_id, health) {
  ensureDb();
  return updateHealth.run({
    node_id,
    status: health.status,
    block_height: health.block_height || 0,
    catching_up: health.catching_up ? 1 : 0,
    latency_ms: health.latency_ms || 0,
  });
}

function markNodeOffline(node_id) {
  ensureDb();
  return markOffline.run({ node_id });
}

function getAllNodes() {
  ensureDb();
  return stmtGetAll.all();
}

function getNodeById(node_id) {
  ensureDb();
  return stmtGetById.get(node_id);
}

function deleteNodeById(node_id) {
  ensureDb();
  const result = stmtDelete.run(node_id);
  return { success: result.changes > 0, node_id };
}

function getStats() {
  ensureDb();
  const row = stmtGetStats.get();
  return {
    total: row.total || 0,
    online: row.online || 0,
    offline: row.offline || 0,
    unknown: row.unknown || 0,
    max_height: row.max_height || 0,
    avg_latency: row.avg_latency ? Math.round(row.avg_latency) : 0,
  };
}

function getStaleNodes() {
  ensureDb();
  return stmtGetStale.all().map((r) => r.node_id);
}

function getOnlineEndpoints() {
  ensureDb();
  return db.prepare("SELECT public_endpoint, rpc_port FROM validator_nodes WHERE status = 'online'").all();
}

// ── Health check helper ─────────────────────────────────────
async function probeNode(node) {
  const axios = require("axios");
  const start = Date.now();
  try {
    const response = await axios.get(
      `http://${node.public_endpoint}:${node.rpc_port}/status`,
      { timeout: 5000 }
    );
    const info = response.data.result;
    return {
      status: "online",
      block_height: parseInt(info.sync_info.latest_block_height, 10),
      catching_up: info.sync_info.catching_up,
      latency_ms: Date.now() - start,
      version: info.node_info.version,
      network: info.node_info.network,
    };
  } catch {
    return { status: "offline", latency_ms: Date.now() - start };
  }
}

async function pollAllNodes() {
  ensureDb();
  const nodes = stmtGetAll.all();
  const results = [];

  for (const node of nodes) {
    const health = await probeNode(node);
    updateHealth.run({
      node_id: node.node_id,
      status: health.status,
      block_height: health.block_height || 0,
      catching_up: health.catching_up ? 1 : 0,
      latency_ms: health.latency_ms || 0,
    });
    results.push({ node_id: node.node_id, ...health });
  }

  return results;
}

module.exports = {
  registerNode,
  updateNodeHealth,
  markNodeOffline,
  getAllNodes,
  getNodeById,
  deleteNodeById,
  getStats,
  getStaleNodes,
  getOnlineEndpoints,
  pollAllNodes,
  getDb,
  closeDb,
  initDb,
};
