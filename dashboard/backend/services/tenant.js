// ─────────────────────────────────────────────────────────────
// LocalChain – Multi-Tenant Service
// Tenant management, isolation, and tenant-aware routing.
// ─────────────────────────────────────────────────────────────
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const TENANT_DB_PATH = process.env.TENANT_DB_PATH || path.join(__dirname, "../../data", "tenants.db");

let db = null;
let insertTenantStmt, findTenantStmt, getAllTenantsStmt, getTenantByIdStmt, updateTenantStmt, deleteTenantStmt;
let findTenantByKeyStmt, getTenantStatsStmt;

function initDb() {
  if (db) return db;

  const dbDir = path.dirname(TENANT_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(TENANT_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active',
      max_nodes INTEGER DEFAULT 10,
      max_api_keys INTEGER DEFAULT 20,
      rate_limit INTEGER DEFAULT 1000,
      rate_window INTEGER DEFAULT 3600,
      metadata TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_id ON tenants(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_status ON tenants(status);

    CREATE TABLE IF NOT EXISTS tenant_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      label TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      rate_limit INTEGER DEFAULT 1000,
      rate_window INTEGER DEFAULT 3600,
      permissions TEXT NOT NULL DEFAULT '["read","write"]',
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_key_hash ON tenant_api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_tenant_key_tenant ON tenant_api_keys(tenant_id);

    CREATE TABLE IF NOT EXISTS tenant_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      key_id INTEGER,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      ip TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_usage_time ON tenant_usage(timestamp);
  `);

  insertTenantStmt = db.prepare(`
    INSERT INTO tenants (tenant_id, name, description, max_nodes, max_api_keys, rate_limit, rate_window, metadata)
    VALUES (@tenant_id, @name, @description, @max_nodes, @max_api_keys, @rate_limit, @rate_window, @metadata)
  `);

  findTenantStmt = db.prepare("SELECT * FROM tenants WHERE tenant_id = ?");
  getAllTenantsStmt = db.prepare("SELECT * FROM tenants ORDER BY created_at DESC");
  getTenantByIdStmt = db.prepare("SELECT * FROM tenants WHERE id = ?");
  updateTenantStmt = db.prepare(`
    UPDATE tenants SET name = @name, description = @description, max_nodes = @max_nodes,
      max_api_keys = @max_api_keys, rate_limit = @rate_limit, rate_window = @rate_window,
      metadata = @metadata WHERE tenant_id = @tenant_id
  `);
  deleteTenantStmt = db.prepare("UPDATE tenants SET status = 'suspended' WHERE tenant_id = ?");

  findTenantByKeyStmt = db.prepare(`
    SELECT t.*, k.id as key_id, k.key_hash, k.key_prefix, k.label as key_label,
           k.rate_limit as key_rate_limit, k.rate_window as key_rate_window, k.permissions
    FROM tenants t
    JOIN tenant_api_keys k ON t.tenant_id = k.tenant_id
    WHERE k.key_hash = ? AND k.status = 'active' AND t.status = 'active'
  `);

  getTenantStatsStmt = db.prepare(`
    SELECT
      COUNT(DISTINCT t.id) as total_tenants,
      SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) as active_tenants,
      COUNT(DISTINCT k.id) as total_keys,
      COUNT(DISTINCT u.id) as total_requests
    FROM tenants t
    LEFT JOIN tenant_api_keys k ON t.tenant_id = k.tenant_id
    LEFT JOIN tenant_usage u ON t.tenant_id = u.tenant_id
  `);

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    insertTenantStmt = null;
    findTenantStmt = null;
    getAllTenantsStmt = null;
    getTenantByIdStmt = null;
    updateTenantStmt = null;
    deleteTenantStmt = null;
    findTenantByKeyStmt = null;
    getTenantStatsStmt = null;
  }
}

function ensureDb() {
  if (!db) initDb();
}

function generateTenantId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
}

function createTenant(options = {}) {
  ensureDb();
  const tenantId = options.tenantId || generateTenantId(options.name);

  insertTenantStmt.run({
    tenant_id: tenantId,
    name: options.name,
    description: options.description || null,
    max_nodes: options.maxNodes || 10,
    max_api_keys: options.maxApiKeys || 20,
    rate_limit: options.rateLimit || 1000,
    rate_window: options.rateWindow || 3600,
    metadata: JSON.stringify(options.metadata || {}),
  });

  return getTenant(tenantId);
}

function getTenant(tenantId) {
  ensureDb();
  return findTenantStmt.get(tenantId);
}

function getTenantById(id) {
  ensureDb();
  return getTenantByIdStmt.get(id);
}

function listTenants() {
  ensureDb();
  return getAllTenantsStmt.all();
}

function updateTenant(tenantId, updates) {
  ensureDb();
  const existing = findTenantStmt.get(tenantId);
  if (!existing) return null;

  updateTenantStmt.run({
    tenant_id: tenantId,
    name: updates.name || existing.name,
    description: updates.description !== undefined ? updates.description : existing.description,
    max_nodes: updates.maxNodes !== undefined ? updates.maxNodes : existing.max_nodes,
    max_api_keys: updates.maxApiKeys !== undefined ? updates.maxApiKeys : existing.max_api_keys,
    rate_limit: updates.rateLimit !== undefined ? updates.rateLimit : existing.rate_limit,
    rate_window: updates.rateWindow !== undefined ? updates.rateWindow : existing.rate_window,
    metadata: updates.metadata ? JSON.stringify(updates.metadata) : existing.metadata,
  });

  return getTenant(tenantId);
}

function suspendTenant(tenantId) {
  ensureDb();
  const result = deleteTenantStmt.run(tenantId);
  return { success: result.changes > 0 };
}

function resolveTenantFromApiKey(apiKey) {
  ensureDb();
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const row = findTenantByKeyStmt.get(hash);

  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    keyId: row.key_id,
    keyLabel: row.key_label,
    permissions: JSON.parse(row.permissions || '["read","write"]'),
    rateLimit: row.key_rate_limit || row.rate_limit,
    rateWindow: row.key_rate_window || row.rate_window,
  };
}

function recordUsage(tenantId, keyId, req) {
  ensureDb();
  const stmt = db.prepare(`
    INSERT INTO tenant_usage (tenant_id, key_id, endpoint, method, ip)
    VALUES (@tenant_id, @key_id, @endpoint, @method, @ip)
  `);
  stmt.run({
    tenant_id: tenantId,
    key_id: keyId || null,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
  });
}

function getTenantUsage(tenantId, hours = 24) {
  ensureDb();
  const stmt = db.prepare(`
    SELECT COUNT(*) as total_requests,
           COUNT(DISTINCT key_id) as active_keys,
           COUNT(DISTINCT ip) as unique_ips
    FROM tenant_usage
    WHERE tenant_id = ? AND timestamp > datetime('now', '-' || ? || ' hours')
  `);
  return stmt.get(tenantId, hours);
}

function getGlobalStats() {
  ensureDb();
  return getTenantStatsStmt.get();
}

function tenantMiddleware(req, res, next) {
  const skipPaths = ["/health", "/api/broadcast/status", "/api/nodes/select", "/api/nodes/pool/stats", "/api/auth/validate", "/api/upnp/status", "/api/tenants/stats"];
  if (skipPaths.includes(req.path)) return next();

  const tenantHeader = req.headers["x-tenant-id"];
  const apiKey = req.headers["x-api-key"];

  if (apiKey) {
    const tenantInfo = resolveTenantFromApiKey(apiKey);
    if (tenantInfo) {
      req.tenant = tenantInfo;
      recordUsage(tenantInfo.tenantId, tenantInfo.keyId, req);
      return next();
    }
  }

  if (tenantHeader) {
    const tenant = getTenant(tenantHeader);
    if (tenant && tenant.status === "active") {
      req.tenant = {
        tenantId: tenant.tenant_id,
        name: tenant.name,
        status: tenant.status,
        rateLimit: tenant.rate_limit,
        rateWindow: tenant.rate_window,
        permissions: JSON.parse(tenant.metadata || "{}").permissions || ["read", "write"],
      };
      recordUsage(tenant.tenant_id, null, req);
      return next();
    }
  }

  if (process.env.TENANT_REQUIRED === "1") {
    return res.status(401).json({ error: "Tenant required. Set X-Tenant-ID header or use a tenant-scoped API key." });
  }

  next();
}

module.exports = {
  createTenant,
  getTenant,
  getTenantById,
  listTenants,
  updateTenant,
  suspendTenant,
  resolveTenantFromApiKey,
  recordUsage,
  getTenantUsage,
  getGlobalStats,
  tenantMiddleware,
  closeDb,
  initDb,
};
