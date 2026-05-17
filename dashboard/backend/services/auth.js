// ─────────────────────────────────────────────────────────────
// LocalChain – Authentication Service
// API key management, shared-secret validation, TLS config.
// ─────────────────────────────────────────────────────────────
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const AUTH_DB_PATH = process.env.AUTH_DB_PATH || path.join(__dirname, "../../data", "auth.db");

let db = null;
let insertKeyStmt, findKeyStmt, getAllKeysStmt, getKeyByIdStmt, deleteKeyStmt, updateLastUsedStmt, logUsageStmt, getUsageCountStmt;

function initDb() {
  if (db) return db;

  const dbDir = path.dirname(AUTH_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(AUTH_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      permissions TEXT NOT NULL DEFAULT '["read","write"]'
    );

    CREATE INDEX IF NOT EXISTS idx_key_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_status ON api_keys(status);
    CREATE INDEX IF NOT EXISTS idx_expires ON api_keys(expires_at);

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      status_code INTEGER,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (key_id) REFERENCES api_keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_key ON usage_log(key_id);
    CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_log(timestamp);
  `);

  insertKeyStmt = db.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, label, created_by, expires_at, rate_limit, rate_window, permissions)
    VALUES (@key_hash, @key_prefix, @label, @created_by, @expires_at, @rate_limit, @rate_window, @permissions)
  `);

  findKeyStmt = db.prepare("SELECT * FROM api_keys WHERE key_hash = ? AND status = 'active'");
  getAllKeysStmt = db.prepare("SELECT id, key_prefix, label, created_by, created_at, last_used_at, expires_at, status, rate_limit, rate_window, permissions FROM api_keys ORDER BY created_at DESC");
  getKeyByIdStmt = db.prepare("SELECT id, key_prefix, label, created_by, created_at, last_used_at, expires_at, status, rate_limit, rate_window, permissions FROM api_keys WHERE id = ?");
  deleteKeyStmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
  updateLastUsedStmt = db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?");
  logUsageStmt = db.prepare(`
    INSERT INTO usage_log (key_id, endpoint, method, ip, user_agent, status_code)
    VALUES (@key_id, @endpoint, @method, @ip, @user_agent, @status_code)
  `);
  getUsageCountStmt = db.prepare(`
    SELECT COUNT(*) as count FROM usage_log
    WHERE key_id = ? AND timestamp > datetime('now', '-' || ? || ' seconds')
  `);

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
    insertKeyStmt = null;
    findKeyStmt = null;
    getAllKeysStmt = null;
    getKeyByIdStmt = null;
    deleteKeyStmt = null;
    updateLastUsedStmt = null;
    logUsageStmt = null;
    getUsageCountStmt = null;
  }
}

function ensureDb() {
  if (!db) initDb();
}

function generateApiKey() {
  const raw = `lc_${crypto.randomBytes(24).toString("base64url")}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.substring(0, 8);
  return { raw, hash, prefix };
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function createKey(options = {}) {
  ensureDb();
  const { raw, hash, prefix } = generateApiKey();

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86400000).toISOString()
    : null;

  insertKeyStmt.run({
    key_hash: hash,
    key_prefix: prefix,
    label: options.label || "unnamed",
    created_by: options.createdBy || null,
    expires_at: expiresAt,
    rate_limit: options.rateLimit || 1000,
    rate_window: options.rateWindow || 3600,
    permissions: JSON.stringify(options.permissions || ["read", "write"]),
  });

  return {
    raw,
    prefix,
    label: options.label,
    expires_at: expiresAt,
    rate_limit: options.rateLimit || 1000,
  };
}

function validateKey(key) {
  ensureDb();
  const hash = hashKey(key);
  const row = findKeyStmt.get(hash);

  if (!row) return { valid: false, reason: "invalid_key" };

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, key: row };
}

function revokeKey(id) {
  ensureDb();
  const result = deleteKeyStmt.run(id);
  return { success: result.changes > 0 };
}

function listKeys() {
  ensureDb();
  return getAllKeysStmt.all();
}

function getKey(id) {
  ensureDb();
  return getKeyByIdStmt.get(id);
}

function recordUsage(keyId, req, statusCode) {
  ensureDb();
  logUsageStmt.run({
    key_id: keyId,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    user_agent: req.headers["user-agent"] || "",
    status_code: statusCode,
  });
}

function checkRateLimit(keyId, rateLimit, rateWindow) {
  ensureDb();
  const row = getUsageCountStmt.get(keyId, rateWindow);
  return row.count < rateLimit;
}

function getTlsConfig() {
  const enabled = process.env.TLS_ENABLED === "1" || process.env.TLS_ENABLED === "true";
  if (!enabled) return null;

  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;

  if (!certPath || !keyPath) return null;
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) return null;

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

function requireAuth(req, res, next) {
  const skipPaths = ["/health", "/api/broadcast/status", "/api/nodes/select", "/api/nodes/pool/stats", "/api/auth/validate"];
  if (skipPaths.includes(req.path)) return next();

  const apiKey = req.headers["x-api-key"];

  if (!apiKey && process.env.AUTH_REQUIRED === "1") {
    return res.status(401).json({ error: "API key required. Set X-API-Key header." });
  }

  if (apiKey) {
    const result = validateKey(apiKey);
    if (!result.valid) {
      return res.status(401).json({ error: `Invalid API key: ${result.reason}` });
    }

    if (!checkRateLimit(result.key.id, result.key.rate_limit, result.key.rate_window)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    req.apiKey = result.key;
    recordUsage(result.key.id, req, 200);
    updateLastUsedStmt.run(result.key.id);
  }

  next();
}

function validateSharedSecret(req, res, next) {
  const secret = req.headers["x-validator-secret"];
  const expected = process.env.VALIDATOR_SHARED_SECRET;

  if (!expected) return next();

  if (!secret || secret !== expected) {
    return res.status(403).json({ error: "Invalid shared secret" });
  }

  next();
}

module.exports = {
  createKey,
  validateKey,
  revokeKey,
  listKeys,
  getKey,
  recordUsage,
  checkRateLimit,
  getTlsConfig,
  requireAuth,
  validateSharedSecret,
  closeDb,
  initDb,
};
